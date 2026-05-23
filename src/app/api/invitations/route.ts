import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db_helper';
import { requireAuth } from '@/lib/auth';
import { randomBytes } from 'crypto';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const status = searchParams.get('status') || 'pending';

  const client = await pool.connect();

  try {
    // Public lookup by token (untuk halaman register user baru)
    if (token) {
      const res = await client.query(
        `SELECT 
           i.id,
           i.uuid,
           i.token,
           i.relationship_type,
           i.status,
           i.expires_at,
           i.created_at,
           n.full_name as inviter_name,
           n.gender as inviter_gender
         FROM invitations i
         JOIN nodes n ON n.id = i.invited_by_node_id
         WHERE i.token = $1`,
        [token]
      );

      if (res.rows.length === 0) {
        return NextResponse.json({ error: 'Undangan tidak ditemukan' }, { status: 404 });
      }

      const row = res.rows[0];

      return NextResponse.json({
        invitation: {
          id: row.id,
          uuid: row.uuid,
          token: row.token,
          relationship_type: row.relationship_type,
          status: row.status,
          expires_at: row.expires_at,
          created_at: row.created_at,
          inviter: {
            full_name: row.inviter_name,
            gender: row.inviter_gender,
          },
        },
      });
    }

    // Protected: list invitations for logged-in user
    const auth = await requireAuth(request);
    if ('error' in auth) {
      return auth.error;
    }

    const { userId } = auth;

    const nodesRes = await client.query('SELECT id FROM nodes WHERE user_id = $1', [userId]);
    const userNodeIds = nodesRes.rows.map((r: any) => r.id);

    if (userNodeIds.length === 0) {
      return NextResponse.json({ invitations: [] });
    }

    const userRes = await client.query('SELECT email FROM users WHERE id = $1', [userId]);
    const userEmail = userRes.rows[0]?.email;

    const query = `
      SELECT 
        i.id,
        i.uuid,
        i.token,
        i.relationship_type,
        i.status,
        i.expires_at,
        i.created_at,
        n.full_name as inviter_name,
        n.gender as inviter_gender,
        n.id as inviter_node_id
      FROM invitations i
      JOIN nodes n ON n.id = i.invited_by_node_id
      WHERE 
        (i.invitee_node_id = ANY($1) OR i.invitee_email = $2)
        AND i.status = $3
      ORDER BY i.created_at DESC
    `;

    const invitationsRes = await client.query(query, [userNodeIds, userEmail, status]);

    return NextResponse.json({
      invitations: invitationsRes.rows.map((row: any) => ({
        id: row.id,
        uuid: row.uuid,
        token: row.token,
        relationship_type: row.relationship_type,
        status: row.status,
        expires_at: row.expires_at,
        created_at: row.created_at,
        inviter: {
          node_id: row.inviter_node_id,
          full_name: row.inviter_name,
          gender: row.inviter_gender,
        },
      })),
    });
  } catch (error) {
    console.error('GET invitations error:', error);
    return NextResponse.json(
      { error: 'Gagal mengambil data undangan' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);

  if ('error' in auth) {
    return auth.error;
  }

  const { userId } = auth; // integer user id

  const body = await request.json();
  const {
    relationship_type,
    invitee_node_uuid,
    invitee_email,
    parent_node_uuid,
    is_share_link = false,
  } = body;

  // === Basic Validation ===
  if (!relationship_type || !['spouse', 'child'].includes(relationship_type)) {
    return NextResponse.json(
      { error: 'relationship_type harus "spouse" atau "child"' },
      { status: 400 }
    );
  }

  if (!invitee_node_uuid && !invitee_email) {
    return NextResponse.json(
      { error: 'Harus mengisi invitee_node_uuid atau invitee_email' },
      { status: 400 }
    );
  }

  if (relationship_type === 'child' && !parent_node_uuid) {
    return NextResponse.json(
      { error: 'parent_node_uuid wajib diisi jika mengundang sebagai anak' },
      { status: 400 }
    );
  }

  const client = await pool.connect();

  try {
    // === Get inviter's node + gender ===
    const inviterNodeRes = await client.query(
      'SELECT id, gender FROM nodes WHERE user_id = $1 LIMIT 1',
      [userId]
    );

    if (inviterNodeRes.rows.length === 0) {
      return NextResponse.json(
        { error: 'Anda belum memiliki node di sistem. Silakan hubungi admin.' },
        { status: 403 }
      );
    }

    const invited_by_node_id = inviterNodeRes.rows[0].id;
    const inviter_gender = inviterNodeRes.rows[0].gender;

    // === Resolve target node or email ===
    let targetNodeId: number | null = null;
    let targetEmail: string | null = null;
    let targetNodeUuid: string | null = null;

    if (invitee_node_uuid) {
      const targetRes = await client.query(
        'SELECT id, uuid, user_id FROM nodes WHERE uuid = $1',
        [invitee_node_uuid]
      );

      if (targetRes.rows.length === 0) {
        return NextResponse.json({ error: 'Node yang diundang tidak ditemukan' }, { status: 404 });
      }

      const target = targetRes.rows[0];
      targetNodeId = target.id;
      targetNodeUuid = target.uuid;

      // Cannot invite self
      if (targetNodeId === invited_by_node_id) {
        return NextResponse.json({ error: 'Tidak dapat mengundang diri sendiri' }, { status: 400 });
      }

      // Get email if user exists
      if (target.user_id) {
        const emailRes = await client.query('SELECT email FROM users WHERE id = $1', [target.user_id]);
        if (emailRes.rows.length > 0) {
          targetEmail = emailRes.rows[0].email;
        }
      }
    } else if (invitee_email) {
      targetEmail = invitee_email;

      // Check if this email already has a node
      const existingUser = await client.query(
        `SELECT n.id, n.uuid 
         FROM users u 
         LEFT JOIN nodes n ON n.user_id = u.id 
         WHERE u.email = $1`,
        [invitee_email]
      );

      if (existingUser.rows.length > 0 && existingUser.rows[0].id) {
        targetNodeId = existingUser.rows[0].id;
        targetNodeUuid = existingUser.rows[0].uuid;

        if (targetNodeId === invited_by_node_id) {
          return NextResponse.json({ error: 'Tidak dapat mengundang diri sendiri' }, { status: 400 });
        }
      }
    }

    // === Business Rules Validation ===
    // Catatan penting:
    // - Validasi ketat (gender beda, cek relasi ayah/ibu, cek pasangan aktif) HANYA dilakukan
    //   jika mengundang user yang SUDAH PUNYA AKUN (via invitee_node_uuid).
    // - Jika hanya mengirim via invitee_email (user baru / belum punya akun), kita TIDAK melakukan
    //   validasi tersebut di sini. Gender akan di-lock nanti saat registrasi, dan relasi dicek saat accept.
    if (targetNodeId) {

      // === SPOUSE via existing user ===
      if (relationship_type === 'spouse') {
        // 1. Gender harus berbeda
        const targetGenderRes = await client.query(
          'SELECT gender FROM nodes WHERE id = $1',
          [targetNodeId]
        );
        const targetGender = targetGenderRes.rows[0]?.gender;

        if (targetGender && targetGender === inviter_gender) {
          return NextResponse.json(
            { error: 'Undangan pasangan hanya boleh untuk jenis kelamin berbeda' },
            { status: 400 }
          );
        }

        // 2. Target tidak boleh sudah punya pasangan aktif
        const marriageCheck = await client.query(
          `SELECT 1 FROM marriages 
           WHERE (husband_node_id = $1 OR wife_node_id = $1) 
             AND status = 'married'`,
          [targetNodeId]
        );

        if (marriageCheck.rows.length > 0) {
          return NextResponse.json(
            { error: 'Orang yang diundang sudah memiliki pasangan aktif' },
            { status: 409 }
          );
        }
      }

      // === CHILD via existing user ===
      if (relationship_type === 'child') {
        const parentType = inviter_gender === 'male' ? 'father' : 'mother';

        // Cek apakah target sudah punya relasi dengan parent_type ini
        const existingParentRes = await client.query(
          `SELECT 1 FROM parent_child_relations 
           WHERE child_node_id = $1 AND parent_type = $2`,
          [targetNodeId, parentType]
        );

        if (existingParentRes.rows.length > 0) {
          const parentLabel = parentType === 'father' ? 'ayah' : 'ibu';
          return NextResponse.json(
            { error: `Orang ini sudah memiliki ${parentLabel}` },
            { status: 409 }
          );
        }
      }
    }

    // === Prepare invitation data ===
    let token: string | null = null;
    let expires_at: Date | null = null;

    if (is_share_link) {
      token = randomBytes(32).toString('hex');
      expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    }

    // === Insert into invitations ===
    const insertRes = await client.query(
      `INSERT INTO invitations 
        (uuid, token, invited_by_node_id, inviter_gender, invitee_email, invitee_node_id, 
         relationship_type, parent_node_id, status, expires_at, created_at, updated_at)
       VALUES 
        (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, 'pending', $8, NOW(), NOW())
       RETURNING id, uuid, token, relationship_type, status, expires_at, created_at`,
      [
        token,
        invited_by_node_id,
        inviter_gender,
        targetEmail,
        targetNodeId,
        relationship_type,
        parent_node_uuid ? (await getNodeIdFromUuid(client, parent_node_uuid)) : null,
        expires_at,
      ]
    );

    const invitation = insertRes.rows[0];

    // === Response ===
    const isNewUserInvitation = !!targetEmail && !targetNodeId;

    const responseData: any = {
      message: is_share_link
        ? 'Link undangan berhasil dibuat'
        : 'Undangan berhasil dibuat',
      invitation: {
        id: invitation.id,
        uuid: invitation.uuid,
        relationship_type: invitation.relationship_type,
        inviter_gender: inviter_gender,           // penting untuk lock gender saat registrasi
        status: invitation.status,
        created_at: invitation.created_at,
      },
      is_new_user_invitation: isNewUserInvitation,
    };

    // Untuk undangan spouse ke user baru, beritahu gender yang harus di-lock
    if (isNewUserInvitation && relationship_type === 'spouse' && inviter_gender) {
      responseData.forced_gender_for_new_user = inviter_gender === 'male' ? 'female' : 'male';
    }

    if (is_share_link && invitation.token) {
      responseData.share_link = {
        token: invitation.token,
        expires_at: invitation.expires_at,
        // Contoh URL yang bisa langsung dipakai frontend:
        // `${window.location.origin}/auth/register?invite=${invitation.token}`
      };
    }

    return NextResponse.json(responseData, { status: 201 });
  } catch (error) {
    console.error('Create invitation error:', error);
    return NextResponse.json(
      { error: 'Gagal membuat undangan' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

// Helper function
async function getNodeIdFromUuid(client: any, uuid: string): Promise<number | null> {
  const res = await client.query('SELECT id FROM nodes WHERE uuid = $1', [uuid]);
  return res.rows.length > 0 ? res.rows[0].id : null;
}
