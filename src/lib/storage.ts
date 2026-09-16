/**
 * Supabase Storage helper
 *
 * Dipakai oleh semua upload routes sebagai pengganti fs lokal.
 * Vercel serverless tidak punya persistent filesystem — semua file
 * harus disimpan ke external storage.
 *
 * Bucket yang dibutuhkan (buat di Supabase Dashboard → Storage):
 *   - "feeds"     → Public
 *   - "profiles"  → Public
 *   - "documents" → Public (akses dikontrol via signed URL atau RLS)
 */

import { initSupabaseServer } from '@/lib/supabase-server';

export type UploadBucket = 'feeds' | 'profiles' | 'documents';

/**
 * Upload file Buffer ke Supabase Storage.
 * Mengembalikan public URL file yang bisa langsung dipakai sebagai src/href.
 */
export async function uploadToStorage(
  bucket: UploadBucket,
  path: string,         // misal: "family-uuid/userId/filename.jpg"
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  const supabase = initSupabaseServer();

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, buffer, {
      contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Storage upload gagal: ${error.message}`);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Hapus file dari Supabase Storage.
 * Path adalah storage path yang disimpan di DB (tanpa bucket prefix).
 * Tidak throw jika file tidak ditemukan — aman untuk delete yang mungkin sudah terhapus.
 */
export async function deleteFromStorage(
  bucket: UploadBucket,
  path: string,
): Promise<void> {
  const supabase = initSupabaseServer();

  const { error } = await supabase.storage.from(bucket).remove([path]);

  if (error) {
    // Log tapi tidak throw — delete failure tidak boleh block response
    console.warn(`[storage] Gagal hapus ${bucket}/${path}:`, error.message);
  }
}

/**
 * Ekstrak storage path dari public URL Supabase.
 * Dipakai saat perlu delete file lama sebelum upload yang baru.
 *
 * Contoh input:
 *   https://xxx.supabase.co/storage/v1/object/public/profiles/123-foto.jpg
 * Output:
 *   123-foto.jpg
 */
export function extractStoragePath(publicUrl: string): string | null {
  try {
    const url = new URL(publicUrl);
    // Path format: /storage/v1/object/public/{bucket}/{...filePath}
    const parts = url.pathname.split('/');
    // index: 0=""  1="storage"  2="v1"  3="object"  4="public"  5=bucket  6+=filePath
    if (parts.length < 7) return null;
    return parts.slice(6).join('/');
  } catch {
    return null;
  }
}
