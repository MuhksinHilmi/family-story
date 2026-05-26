import { sendEmail } from '@/lib/email';

export async function processEmailQueue() {
  // @ts-ignore
  if (!(globalThis as any).emailQueue) return;
  // Work with global queue stored as any to avoid type errors
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const q: any[] = (globalThis as any).emailQueue || [];
  while (q.length > 0) {
    const item = q.shift();
    if (!item) continue;
    try {
      const { notifId, email, uid, feedId, actorUserId, caption } = item;
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
      const feedUrl = `${baseUrl}/feeds?focus=${feedId}`; // feed page should support focus param

      const html = `
        <div style="font-family: Arial, sans-serif; max-width:520px; margin:0 auto;">
          <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
            <img src="${baseUrl}/images/logo-cerita-keluarga.png" alt="logo" width="48" height="48" />
            <div>
              <strong>Cerita Keluarga</strong>
              <div style="font-size:12px;color:#666;">Seseorang menyebut Anda dalam sebuah postingan</div>
            </div>
          </div>

          <p>Hai, seseorang menyebutkan Anda dalam postingan:</p>
          <blockquote style="background:#f8f8f8;padding:12px;border-radius:6px;color:#333;">${caption}</blockquote>

          <p>
            <a href="${feedUrl}" style="display:inline-block;background:#4A7C59;color:white;padding:10px 16px;text-decoration:none;border-radius:6px;">Lihat Postingan</a>
          </p>

          <p style="font-size:12px;color:#999;margin-top:12px;">Anda menerima notifikasi karena termasuk dalam jangkauan visibilitas postingan ini.</p>
        </div>
      `;

      await sendEmail(email, 'Anda disebut dalam postingan - Cerita Keluarga', html);

      // mark notification email_sent true
      try {
        const pool = (await import('@/lib/db_helper')).default;
        await pool.query('UPDATE notifications SET email_sent = true WHERE id = $1', [notifId]);
      } catch (e) {
        console.warn('Failed to mark notification email_sent', e);
      }
    } catch (e) {
      console.warn('Error sending queued notification email', e);
    }
  }

  // put back any remaining items
  (globalThis as any).emailQueue = q;
}
