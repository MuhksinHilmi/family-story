import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db_helper';
import { requireAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { userId } = auth;
  const body = await request.json();
  const { recipient_profile_id, message } = body;

  // Validation
  if (!recipient_profile_id) {
    return NextResponse.json(
      { error: 'recipient_profile_id wajib diisi' },
      { status: 400 }
    );
  }

  if (!message || message.trim().length < 20) {
    return NextResponse.json(
      { error: 'Pesan minimal 20 karakter' },
      { status: 400 }
    );
  }

  const client = await pool.connect();

  try {
    // Get sender's taaruf profile
    const senderProfileRes = await client.query(
      'SELECT id, user_id FROM taaruf_profiles WHERE user_id = $1 AND status = \'active\' LIMIT 1',
      [userId]
    );

    if (senderProfileRes.rows.length === 0) {
      return NextResponse.json(
        { error: 'Profil ta\'aruf Anda belum aktif. Silakan lengkapi profil terlebih dahulu.' },
        { status: 400 }
      );
    }

    const senderProfileId = senderProfileRes.rows[0].id;

    // Check if sender already has pending application
    const existingPendingRes = await client.query(
      `SELECT id FROM taaruf_applications 
       WHERE sender_profile_id = $1 AND status = 'pending' LIMIT 1`,
      [senderProfileId]
    );

    if (existingPendingRes.rows.length > 0) {
      return NextResponse.json(
        { error: 'Anda hanya bisa mengirim 1 lamaran aktif pada satu waktu' },
        { status: 400 }
      );
    }

    // Check if already applied to this recipient
    const alreadyAppliedRes = await client.query(
      `SELECT id FROM taaruf_applications 
       WHERE sender_profile_id = $1 AND recipient_profile_id = $2 LIMIT 1`,
      [senderProfileId, recipient_profile_id]
    );

    if (alreadyAppliedRes.rows.length > 0) {
      return NextResponse.json(
        { error: 'Anda sudah mengirim lamaran ke profil ini sebelumnya' },
        { status: 400 }
      );
    }

    // Check if recipient profile is active
    const recipientProfileRes = await client.query(
      'SELECT id, user_id, node_id FROM taaruf_profiles WHERE id = $1 AND status = \'active\' LIMIT 1',
      [recipient_profile_id]
    );

    if (recipientProfileRes.rows.length === 0) {
      return NextResponse.json(
        { error: 'Profil penerima tidak ditemukan atau belum aktif' },
        { status: 404 }
      );
    }

    // Create application
    const insertRes = await client.query(
      `INSERT INTO taaruf_applications 
       (sender_profile_id, recipient_profile_id, message, status, created_at)
       VALUES ($1, $2, $3, 'pending', NOW())
       RETURNING id, sender_profile_id, recipient_profile_id, message, status, created_at`,
      [senderProfileId, recipient_profile_id, message.trim()]
    );

    const application = insertRes.rows[0];

    // TODO: Send notification to recipient (via email or in-app notification)

    return NextResponse.json({
      application: {
        id: application.id,
        recipient_profile_id: application.recipient_profile_id,
        message: application.message,
        status: application.status,
        created_at: application.created_at,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/taaruf/applications error:', error);
    return NextResponse.json(
      { error: 'Gagal mengirim lamaran ta\'aruf' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}