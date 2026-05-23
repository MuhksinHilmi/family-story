import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db_helper';
import { SignJWT } from 'jose';

export async function POST(request: NextRequest) {
  const client = await pool.connect();
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Token diperlukan' }, { status: 400 });
    }

    // =====================================================
    // Self-registration activation (current simple flow)
    // =====================================================
    const userResult = await client.query(
      `SELECT id, uuid, full_name, email, created_at 
       FROM users 
       WHERE activation_token = $1`,
      [token]
    );

    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      const createdAt = new Date(user.created_at);
      const expiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);

      if (new Date() > expiresAt) {
        return NextResponse.json({ error: 'Token aktivasi telah kadaluarsa' }, { status: 400 });
      }

      await client.query(
        `UPDATE users 
         SET is_email_verified = true, 
             activation_status = 'active',
             activation_token = NULL,
             updated_at = NOW()
         WHERE id = $1`,
        [user.id]
      );

      return NextResponse.json({ 
        message: 'Akun berhasil diaktivasi. Silakan login.' 
      });
    }

    // =====================================================
    // Invitation activation (akan kita kerjakan nanti)
    // =====================================================
    // Untuk saat ini kita kembalikan pesan bahwa fitur undangan belum aktif
    return NextResponse.json({ 
      error: 'Token tidak dikenali atau fitur undangan belum diaktifkan' 
    }, { status: 400 });

  } catch (error) {
    console.error('Activate error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan' }, { status: 500 });
  } finally {
    client.release();
  }
}

