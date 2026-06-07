import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import pool from '@/lib/db_helper';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_USER_STORAGE = 500 * 1024 * 1024; // 500 MB per user per family

const ALLOWED_MIME_TYPES = new Set([
  // Images
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  // PDF
  'application/pdf',
  // Microsoft Word
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  // Microsoft Excel
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  // Microsoft PowerPoint
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Audio
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
]);

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const userId = auth.userId;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const familyUuid = formData.get('family_uuid') as string | null;
    const description = (formData.get('description') as string) || null;

    // Sharing parameters
    const visibilityScope = (formData.get('visibility_scope') as string) || 'private';
    const smallFamilyUuid = (formData.get('small_family_uuid') as string) || null;
    const recipientsRaw = formData.get('recipient_user_ids') as string | null;

    if (!file || !familyUuid) {
      return NextResponse.json(
        { error: 'File dan family_uuid wajib diisi' },
        { status: 400 }
      );
    }

    // Validate visibility_scope
    const validScopes = ['private', 'family', 'small_family', 'specific_users', 'extended'];
    if (!validScopes.includes(visibilityScope)) {
      return NextResponse.json({ error: 'visibility_scope tidak valid' }, { status: 400 });
    }

    let recipientUserIds: string[] | null = null;
    if (recipientsRaw) {
      try {
        recipientUserIds = JSON.parse(recipientsRaw);
      } catch {
        return NextResponse.json({ error: 'recipient_user_ids harus berupa array JSON' }, { status: 400 });
      }
    }

    // === VALIDASI UKURAN FILE ===
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `Ukuran file maksimal 10MB. File kamu ${(file.size / 1024 / 1024).toFixed(1)}MB` },
        { status: 400 }
      );
    }

    // === VALIDASI TIPE FILE (tidak boleh video) ===
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: 'Jenis file tidak diizinkan. Hanya image, audio, PDF, Word, Excel, dan PowerPoint yang diperbolehkan.' },
        { status: 400 }
      );
    }

// === VALIDASI MEMBERSHIP === (check nuclear family membership)
     const memberCheck = await pool.query(
       `SELECT 1 FROM nuclear_family_memberships nfm
        JOIN nuclear_families nf ON nf.id = nfm.nuclear_family_id
        WHERE nfm.node_id = (SELECT id FROM nodes WHERE user_id = $1 LIMIT 1)
          AND nf.uuid = $2`,
       [userId, familyUuid]
     );

     if (memberCheck.rows.length === 0) {
       return NextResponse.json(
         { error: 'Anda bukan anggota keluarga ini' },
         { status: 403 }
       );
     }

    // === CEK KUOTA STORAGE 500MB ===
    const usageRes = await pool.query(
      `SELECT COALESCE(SUM(file_size), 0) as used
       FROM family_documents
       WHERE family_uuid = $1 AND uploaded_by = $2`,
      [familyUuid, userId]
    );

    const currentUsed = Number(usageRes.rows[0]?.used || 0);
    const newTotal = currentUsed + file.size;

    if (newTotal > MAX_USER_STORAGE) {
      const usedMB = (currentUsed / 1024 / 1024).toFixed(1);
      return NextResponse.json(
        {
          error: `Kuota storage Anda sudah penuh (500MB). Saat ini ${usedMB}MB terpakai.`,
        },
        { status: 400 }
      );
    }

    // === SIMPAN FILE KE LOCAL PUBLIC STORAGE ===
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const originalName = file.name;
    const sanitized = sanitizeFileName(originalName);
    const uniqueName = `${Date.now()}-${randomUUID().slice(0, 8)}-${sanitized}`;

    const relativeDir = `uploads/documents/${familyUuid}/${userId}`; // userId = integer from users.id
    const absoluteDir = path.join(process.cwd(), 'public', relativeDir);

    // Buat folder jika belum ada
    await mkdir(absoluteDir, { recursive: true });

    const filePath = path.join(absoluteDir, uniqueName);
    await writeFile(filePath, buffer);

    const publicPath = `${relativeDir}/${uniqueName}`;

    // === SIMPAN METADATA KE DATABASE ===
    const insertRes = await pool.query(
      `INSERT INTO family_documents 
        (family_uuid, uploaded_by, file_name, original_name, file_path, file_size, mime_type, 
         visibility_scope, small_family_uuid, recipient_user_ids, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, created_at`,
      [
        familyUuid,
        userId,
        uniqueName,
        originalName,
        publicPath,
        file.size,
        file.type,
        visibilityScope,
        visibilityScope === 'small_family' ? smallFamilyUuid : null,
        visibilityScope === 'specific_users' ? recipientUserIds : null,
        description,
      ]
    );

    const newDoc = insertRes.rows[0];

    return NextResponse.json(
      {
        success: true,
        document: {
          id: newDoc.id,
          file_name: uniqueName,
          original_name: originalName,
          file_path: publicPath,
          file_size: file.size,
          mime_type: file.type,
          public_url: `/${publicPath}`,
          created_at: newDoc.created_at,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Document upload error:', error);
    return NextResponse.json(
      { error: 'Gagal mengupload dokumen' },
      { status: 500 }
    );
  }
}

// GET - List documents for a family (with basic access control)
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const userId = auth.userId;
  const { searchParams } = new URL(request.url);
  const familyUuid = searchParams.get('family_uuid');

  if (!familyUuid) {
    return NextResponse.json({ error: 'family_uuid wajib' }, { status: 400 });
  }

// Pastikan user adalah anggota keluarga
   const memberCheck = await pool.query(
     `SELECT 1 FROM nuclear_family_memberships nfm
      JOIN nuclear_families nf ON nf.id = nfm.nuclear_family_id
      WHERE nfm.node_id = (SELECT id FROM nodes WHERE user_id = $1 LIMIT 1)
        AND nf.uuid = $2`,
     [userId, familyUuid]
   );

   if (memberCheck.rows.length === 0) {
     return NextResponse.json({ error: 'Bukan anggota keluarga' }, { status: 403 });
   }

// Ambil dokumen yang boleh dilihat user ini + nama uploader
    // 'family' = nuclear family members only  
    // 'extended' = all extended family members (via node_extended_groups)
    
    const docsRes = await pool.query(
      `SELECT 
         d.id, d.family_uuid, d.uploaded_by, d.file_name, d.original_name, 
         d.file_path, d.file_size, d.mime_type, d.visibility_scope, 
         d.small_family_uuid, d.recipient_user_ids, d.description, d.created_at,
         u.full_name as uploader_name
       FROM family_documents d
       LEFT JOIN users u ON u.id = d.uploaded_by
       WHERE d.family_uuid = $1
         AND (
           d.uploaded_by = $2
           OR d.visibility_scope = 'family'
           OR d.visibility_scope = 'extended'
           OR (d.visibility_scope = 'small_family' AND EXISTS (
                 SELECT 1 FROM chat_rooms cr
                 WHERE cr.family_uuid = $1
                   AND cr.scope_type = 'small'
                   AND cr.small_family_uuid = d.small_family_uuid
               ))
           OR (d.visibility_scope = 'specific_users' AND $2 = ANY(d.recipient_user_ids))
         )
       ORDER BY d.created_at DESC`,
      [familyUuid, userId]
    );

  const documents = docsRes.rows.map((d) => ({
    ...d,
    public_url: `/${d.file_path}`,
    uploader_name: d.uploader_name,
  }));

  return NextResponse.json({ documents });
}

// DELETE - Only owner can delete their own document
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const userId = auth.userId;
  const { searchParams } = new URL(request.url);
  const docId = searchParams.get('id');

  if (!docId) {
    return NextResponse.json({ error: 'Document id wajib' }, { status: 400 });
  }

  // Cek kepemilikan
  const ownerCheck = await pool.query(
    `SELECT file_path FROM family_documents WHERE id = $1 AND uploaded_by = $2`,
    [docId, userId]
  );

  if (ownerCheck.rows.length === 0) {
    return NextResponse.json({ error: 'Dokumen tidak ditemukan atau bukan milik Anda' }, { status: 404 });
  }

  const filePath = ownerCheck.rows[0].file_path;

  // Hapus record dari DB
  await pool.query(`DELETE FROM family_documents WHERE id = $1`, [docId]);

  // Opsional: hapus file fisik (bisa di-comment jika ingin keep untuk audit)
  try {
    const fs = await import('fs/promises');
    const absolutePath = path.join(process.cwd(), 'public', filePath);
    await fs.unlink(absolutePath);
  } catch (e) {
    console.warn('Gagal hapus file fisik:', e);
  }

  return NextResponse.json({ success: true });
}

// PATCH - Update visibility / sharing settings (hanya pemilik)
export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const userId = auth.userId;

  try {
    const body = await request.json();
    const { id, visibility_scope, small_family_uuid, recipient_user_ids } = body;

    if (!id || !visibility_scope) {
      return NextResponse.json({ error: 'id dan visibility_scope wajib' }, { status: 400 });
    }

    const validScopes = ['private', 'family', 'small_family', 'specific_users', 'extended'];
    if (!validScopes.includes(visibility_scope)) {
      return NextResponse.json({ error: 'visibility_scope tidak valid' }, { status: 400 });
    }

    // Pastikan user adalah pemilik
    const ownerCheck = await pool.query(
      `SELECT 1 FROM family_documents WHERE id = $1 AND uploaded_by = $2`,
      [id, userId]
    );

    if (ownerCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Bukan pemilik dokumen' }, { status: 403 });
    }

    await pool.query(
      `UPDATE family_documents
       SET visibility_scope = $1,
           small_family_uuid = $2,
           recipient_user_ids = $3
       WHERE id = $4`,
      [
        visibility_scope,
        visibility_scope === 'small_family' ? small_family_uuid : null,
        visibility_scope === 'specific_users' ? recipient_user_ids : null,
        id,
      ]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Document share update error:', error);
    return NextResponse.json({ error: 'Gagal memperbarui sharing' }, { status: 500 });
  }
}
