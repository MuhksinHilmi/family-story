import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db_helper';
import { requireAuth } from '@/lib/auth';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const body = await request.json();
    const { inviteId, newGroupName } = body;

    if (!inviteId) {
      return NextResponse.json({ error: 'ID undangan diperlukan' }, { status: 400 });
    }

    await pool.query('BEGIN');

    try {
      // 1. Fetch the invitation
      const inviteRes = await pool.query(
        `SELECT * FROM halaqah_invites WHERE id = $1 AND status = 'pending'`,
        [inviteId]
      );
      const invite = inviteRes.rows[0];

      if (!invite) {
        throw new Error('Undangan tidak ditemukan atau sudah diproses');
      }

      // 2. Identify the two nuclear families involved
      // Sender family
      const senderNodeRes = await pool.query(
        `SELECT current_nuclear_family_id FROM nodes WHERE id = $1`,
        [invite.sender_node_id]
      );
      const senderNfId = senderNodeRes.rows[0]?.current_nuclear_family_id;

      // Target family
      const targetNfId = invite.target_nuclear_family_id;

      if (!senderNfId || !targetNfId) {
        throw new Error('Informasi keluarga inti tidak lengkap');
      }

      // 3. Create the Halaqah group
      const halaqahRes = await pool.query(
        `INSERT INTO halaqahs
        (nuclear_family_id, name, description, type, topics, status)
        VALUES ($1, $2, $3, $4, $5, 'active')
        RETURNING id, uuid`,
        [
          targetNfId, // Admin is usually the target family if they accept
          newGroupName || `Halaqah ${invite.theme || 'Belajar'}`,
          `Grup belajar bersama berdasarkan undangan.`,
          invite.theme || 'umum',
          invite.suggested_skills || [],
        ]
      );
      const halaqah = halaqahRes.rows[0];

      // 4. Create the Chat Room
      const chatRoomUuid = randomUUID();
      await pool.query(
        `INSERT INTO chat_rooms (id, scope_type, name, created_at, updated_at)
         VALUES ($1, 'general', $2, NOW(), NOW())`,
        [chatRoomUuid, newGroupName || `Halaqah ${invite.theme || 'Belajar'}`]
      );

      // Link chat room to halaqah
      await pool.query(
        `UPDATE halaqahs SET chat_room_uuid = $1 WHERE id = $2`,
        [chatRoomUuid, halaqah.id]
      );

      // 5. Add members to Halaqah and Chat Room
      const allNfIds = [senderNfId, targetNfId];

      // Get all users belonging to these nuclear families
      const membersRes = await pool.query(
        `SELECT n.user_id, n.id as node_id
         FROM nodes n
         JOIN nuclear_family_memberships nfm ON n.id = nfm.node_id
         WHERE nfm.nuclear_family_id = ANY($1::int[])`,
        [allNfIds]
      );
      const allMembers = membersRes.rows;

      for (const member of allMembers) {
        // Add to halaqah_members
        await pool.query(
          `INSERT INTO halaqah_members (halaqah_id, node_id, status, is_admin)
           VALUES ($1, $2, 'active', $3)`,
          [halaqah.id, member.node_id, member.node_id === (await pool.query(`SELECT head_node_id FROM nuclear_families WHERE id = $1`, [targetNfId])).rows[0]?.head_node_id]
        ).catch(() => {}); // Ignore unique constraint if already exists

        // Add to room_memberships (chat)
        await pool.query(
          `INSERT INTO room_memberships (chat_room_id, user_id)
           VALUES ($1, $2)`,
          [chatRoomUuid, member.user_id]
        ).catch(() => {});
      }

      // 6. Mark invitation as accepted
      await pool.query(
        `UPDATE halaqah_invites SET status = 'accepted', updated_at = NOW() WHERE id = $1`,
        [inviteId]
      );

      await pool.query('COMMIT');
      return NextResponse.json({
        message: 'Halaqah berhasil dibuat!',
        halaqahId: halaqah.id,
        chatRoomUuid: chatRoomUuid
      });

    } catch (error: any) {
      await pool.query('ROLLBACK');
      console.error('Accept Invite error:', error);
      return NextResponse.json({ error: error.message || 'Terjadi kesalahan' }, { status: 500 });
    }
  }
}
