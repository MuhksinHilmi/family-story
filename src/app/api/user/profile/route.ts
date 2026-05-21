import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db_helper';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const userId = auth.userId;
    const result = await pool.query(
      'SELECT id, full_name, email, phone, gender, birth_date, photo_url FROM users WHERE id = $1',
      [userId]
    );
    return NextResponse.json({ user: result.rows[0] || null });
  } catch (error) {
    console.error('Profile GET error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const userId = auth.userId;

    const contentType = request.headers.get('content-type') || '';
    let full_name: string | undefined;
    let email: string | undefined;
    let phone: string | undefined;
    let gender: string | undefined;
    let birth_date: string | undefined;
    let photoFile: File | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const profileJson = formData.get('profile') as string;
      if (profileJson) {
        const parsed = JSON.parse(profileJson);
        full_name = parsed.full_name;
        email = parsed.email;
        phone = parsed.phone;
        gender = parsed.gender;
        birth_date = parsed.birth_date;
      }
      photoFile = formData.get('photo') as File | null;
    } else {
      const body = await request.json();
      full_name = body.full_name;
      email = body.email;
      phone = body.phone;
      gender = body.gender;
      birth_date = body.birth_date;
    }

    let photoUrl: string | undefined;

    if (photoFile) {
      const bytes = await photoFile.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'profiles');
      await mkdir(uploadDir, { recursive: true });

      const fileExt = photoFile.name.split('.').pop() || 'jpg';
      const fileName = `${userId}-${Date.now()}-${randomUUID()}.${fileExt}`;
      const filePath = path.join(uploadDir, fileName);

      await writeFile(filePath, buffer);

      photoUrl = `/uploads/profiles/${fileName}`;
    }

    const updateFields = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (full_name !== undefined) {
      updateFields.push(`full_name = $${paramIndex++}`);
      values.push(full_name);
    }
    if (email !== undefined) {
      updateFields.push(`email = $${paramIndex++}`);
      values.push(email);
    }
    if (phone !== undefined) {
      updateFields.push(`phone = $${paramIndex++}`);
      values.push(phone);
    }
    if (gender !== undefined) {
      updateFields.push(`gender = $${paramIndex++}`);
      values.push(gender);
    }
    if (birth_date !== undefined) {
      updateFields.push(`birth_date = $${paramIndex++}`);
      values.push(birth_date);
    }
    if (photoUrl) {
      updateFields.push(`photo_url = $${paramIndex++}`);
      values.push(photoUrl);
    }

    if (updateFields.length === 0) {
      return NextResponse.json({ message: 'Tidak ada perubahan' });
    }

    updateFields.push(`updated_at = NOW()`);
    values.push(userId);

    const query = `
      UPDATE users 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, full_name, email, phone, gender, birth_date, photo_url
    `;

    const result = await pool.query(query, values);

    // Also update family_nodes if needed
    await pool.query(
      `UPDATE family_nodes SET 
         full_name = COALESCE($1, full_name), 
         gender = COALESCE($2, gender), 
         birth_date = COALESCE($3, birth_date)
       WHERE user_id = $4`,
      [full_name, gender, birth_date, userId]
    );

    return NextResponse.json({
      message: 'Profil berhasil diperbarui',
      user: result.rows[0],
    });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan' }, { status: 500 });
  }
}