import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
// Menggunakan built-in crypto (lebih ringan)

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 });
    }

    // Validasi tipe file
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Hanya file JPG, PNG, atau WebP yang diperbolehkan' }, { status: 400 });
    }

    // Validasi ukuran
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Ukuran file maksimal 2MB' }, { status: 400 });
    }

    // Buat folder uploads (flat structure, no family_uuid anymore)
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'feeds');
    await mkdir(uploadDir, { recursive: true });

    // Generate nama file unik
    const ext = file.name.split('.').pop();
    const fileName = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const filePath = path.join(uploadDir, fileName);

    // Tulis file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // URL yang bisa diakses publik
    const publicUrl = `/uploads/feeds/${fileName}`;

    return NextResponse.json({
      success: true,
      url: publicUrl,
      fileName,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Gagal mengupload file' }, { status: 500 });
  }
}
