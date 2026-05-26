"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotifications = async () => {
      setLoading(true);
      const res = await apiFetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
      setLoading(false);
    };
    fetchNotifications();
  }, []);

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-[#3B2F1E]">Notifikasi</h1>
        <Link
          href="/feeds/new"
          className="inline-flex items-center gap-2 bg-[#4A7C59] text-white px-4 py-2 rounded-2xl text-sm"
        >
          + Bagikan Momen
        </Link>
      </div>

      {loading ? (
        <div className="text-[#9C8B75]">Memuat notifikasi...</div>
      ) : notifications.length === 0 ? (
        <div className="bg-[#FDFAF5] border border-[#D4C4A8] rounded-2xl p-8 text-center">
          <img src="/images/logo-cerita-keluarga.png" alt="logo" className="mx-auto mb-4 w-20 h-20 object-contain" />
          <h2 className="text-lg font-semibold text-[#3B2F1E] mb-2">Belum ada notifikasi</h2>
          <p className="text-sm text-[#6B5B45] max-w-md mx-auto">Notifikasi akan muncul di sini ketika anggota keluarga menyebut Anda, mengomentari postingan Anda, atau berinteraksi dengan cerita keluarga.</p>
          <div className="mt-4">
            <Link href="/feeds/new" className="inline-flex items-center gap-2 bg-[#4A7C59] text-white px-4 py-2 rounded-2xl text-sm">
              Bagikan Momen Pertama
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`flex items-start gap-4 p-4 rounded-2xl border ${n.is_read ? 'bg-[#FDFAF5] border-[#D4C4A8]' : 'bg-[#F5F0E8] border-[#D4C4A8] shadow-sm'}`}
            >
              <Avatar className="w-12 h-12 flex-shrink-0">
                {n.actor_photo && <AvatarImage src={n.actor_photo} alt={n.actor_name} />}
                <AvatarFallback className="bg-[#D6EAD9] text-[#2E5239]">{n.actor_name ? n.actor_name[0].toUpperCase() : 'C'}</AvatarFallback>
              </Avatar>

              <div className="flex-1">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm text-[#3B2F1E] font-semibold">
                      {n.actor_name || 'Seseorang'}{n.type === 'mention' ? ' menyebut Anda' : n.type === 'comment' ? ' mengomentari' : ''}
                    </div>
                    <div className="text-xs text-[#6B5B45] mt-1 line-clamp-2">{n.feed_caption}</div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className="text-[11px] text-[#9C8B75]">{new Date(n.created_at).toLocaleString()}</div>
                    {!n.is_read && <div className="mt-2 inline-block text-xs bg-[#D6EAD9] text-[#2E5239] px-2 py-0.5 rounded-full">Baru</div>}
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <Link href={`/feeds?focus=${n.feed_id}`} className="text-xs bg-[#4A7C59] text-white px-3 py-1 rounded-md">Lihat Postingan</Link>
                  <button
                    className="text-xs text-[#6B5B45] px-3 py-1 rounded-md border border-[#D4C4A8] bg-[#FDFAF5]"
                    onClick={async () => {
                      // optimistic mark as read locally
                      setNotifications((prev) => prev.map((it) => it.id === n.id ? { ...it, is_read: true } : it));
                      try {
                        await apiFetch(`/api/notifications/${n.id}/read`, { method: 'POST' });
                      } catch (e) {
                        // ignore
                      }
                    }}
                  >
                    Tandai Sudah Dibaca
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
