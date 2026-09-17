"use client";

export const dynamic = "force-dynamic";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Users, Home, X } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { ChatMessage, User } from "@/types";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/context/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FamilyTreeLoader } from "@/components/ui/family-tree-loader";

// Local `messages` adalah sumber permanen. Supabase `messages` hanya transient (auto-delete >1 hari via pg_cron).

export default function ChatPage() {
  const { logout } = useAuth();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [rooms, setRooms] = useState<any[]>([]);
  const [currentRoom, setCurrentRoom] = useState<any>(null);
  const [user, setUser] = useState<User | null>(null);
  const [mobileRoomsOpen, setMobileRoomsOpen] = useState(false);
  const anchorRef = useRef<string | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    // Sync family_members ke Supabase dulu sebelum subscribe realtime
    // RLS Supabase cek tabel ini untuk authorize channel subscription
    apiFetch("/api/chat/sync-family-members", { method: "POST" }).catch((e) =>
      console.warn("[chat] sync-family-members failed:", e),
    );
    fetchChatRooms();
  }, [user?.id]);

  useEffect(() => {
    if (!currentRoom || !user?.id) return;

    loadInitialMessages();

    const token = localStorage.getItem("token");
    if (!token) {
      console.warn("No auth token, realtime disabled");
      return;
    }

    // Refs untuk cleanup
    let supabaseClient: ReturnType<typeof createClient> | null = null;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let destroyed = false;

    const smallId =
      currentRoom.small_family_uuid || currentRoom.small_family_id;
    const topic =
      currentRoom.scope_type === "general"
        ? `family:${currentRoom.family_uuid}:general`
        : `family:${currentRoom.family_uuid}:small:${smallId || ""}`;

    /**
     * Fetch Supabase-compatible JWT dari server kita.
     * Server verifikasi custom app JWT dulu, baru mint JWT baru
     * yang di-sign dengan SUPABASE_JWT_SECRET (HS256).
     * Token ini yang Supabase bisa verifikasi untuk RLS.
     */
    const fetchRealtimeToken = async (): Promise<{
      token: string;
      expiresAt: number;
    } | null> => {
      try {
        const res = await apiFetch("/api/chat/realtime-token");
        if (!res.ok) {
          console.error("[Realtime] Gagal fetch realtime token:", res.status);
          return null;
        }
        const data = await res.json();
        return { token: data.token, expiresAt: data.expires_at };
      } catch (err) {
        console.error("[Realtime] Error fetch realtime token:", err);
        return null;
      }
    };

    /**
     * Setup channel dengan token yang sudah di-fetch.
     * Dipanggil sekali saat mount, dan ulang saat token refresh.
     */
    const setupChannel = async () => {
      if (destroyed) return;

      const result = await fetchRealtimeToken();
      if (!result || destroyed) return;

      const { token: realtimeToken, expiresAt } = result;

      // Buat Supabase client baru dengan token ini
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );

      // Set auth token — Supabase Realtime akan verifikasi dengan JWT secret-nya
      supabase.realtime.setAuth(realtimeToken);
      supabaseClient = supabase as any;

      const channel = supabase
        .channel(topic, { config: { private: true } })
        .on("broadcast", { event: "message_created" }, (payload) => {
          const msg = payload.payload as any;
          if (!msg?.id || seenIdsRef.current.has(msg.id)) return;
          seenIdsRef.current.add(msg.id);

          const chatMsg = toChatMessage(msg);

          setMessages((prev) => {
            const withoutPending = prev.filter(
              (m) => !String(m.id).startsWith("temp-"),
            );
            return [...withoutPending, chatMsg];
          });

          // Tentukan apakah pesan realtime ini untuk room yang sedang dibuka
          const isForCurrentRoom =
            currentRoom &&
            (msg.room_id
              ? msg.room_id === currentRoom.id
              : msg.family_uuid === currentRoom.family_uuid &&
                msg.scope_type === currentRoom.scope_type &&
                (msg.small_family_id || null) ===
                  (currentRoom.small_family_uuid ||
                    currentRoom.small_family_id ||
                    null));

          if (isForCurrentRoom) {
            markRoomAsRead(currentRoom.id, msg.id);
          } else {
            setRooms((prev) =>
              prev.map((r) =>
                r.family_uuid === msg.family_uuid &&
                r.scope_type === msg.scope_type &&
                (r.small_family_uuid || r.small_family_id || null) ===
                  (msg.small_family_id || null)
                  ? { ...r, unread_count: (r.unread_count || 0) + 1 }
                  : r,
              ),
            );
          }
        })
        .subscribe((status, err) => {
          console.log(`[Realtime] ${topic} → status: ${status}`);
          if (status === "CLOSED") {
            console.warn(`[Realtime] Channel CLOSED for ${topic}.`);
          }
          if (err) {
            console.error(`[Realtime] Error on ${topic}:`, err);
          }
        });

      // Jadwalkan refresh token 5 menit sebelum expire
      // Supaya channel tidak terputus karena token expired
      const msUntilExpiry = expiresAt - Date.now();
      const refreshIn = Math.max(msUntilExpiry - 5 * 60 * 1000, 60 * 1000);

      refreshTimer = setTimeout(async () => {
        if (destroyed) return;
        console.log("[Realtime] Refreshing realtime token...");
        // Hapus channel lama, buat ulang dengan token baru
        await supabase.removeChannel(channel);
        setupChannel();
      }, refreshIn);
    };

    setupChannel();

    return () => {
      destroyed = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      if (supabaseClient) {
        // removeAllChannels untuk cleanup semua channel di client ini
        supabaseClient.removeAllChannels();
      }
    };
  }, [currentRoom, user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchChatRooms = async () => {
    try {
      const res = await apiFetch(`/api/chat/rooms`);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        // Optimistic: if we are landing on a room (on refresh or initial load), clear its badge right away
        const generalRoom = data.find((r: any) => r.scope_type === "general");
        const firstRoom = generalRoom || data[0];

        const roomsWithClearedCurrent = data.map((r: any) =>
          r.id === firstRoom?.id ? { ...r, unread_count: 0 } : r,
        );

        setRooms(roomsWithClearedCurrent);
        setCurrentRoom(firstRoom);
      }
    } catch (e) {
      console.error("Failed to fetch chat rooms:", e);
    } finally {
      setLoading(false);
    }
  };

  const selectRoom = (room: any) => {
    if (currentRoom?.id === room.id) return;

    // Optimistic: clear badge for this room immediately in the local list
    setRooms((prev) =>
      prev.map((r) => (r.id === room.id ? { ...r, unread_count: 0 } : r)),
    );

    setCurrentRoom(room);
    setMessages([]);
    seenIdsRef.current.clear();
    anchorRef.current = null;

    // Mark as read right away (will also update global dot on next sidebar fetch)
    markRoomAsRead(room.id);
  };

  // Mark room as read + update local unread_count optimistically
  const markRoomAsRead = async (roomId: string, lastReadMessageId?: string) => {
    if (!roomId) return;

    try {
      await apiFetch("/api/chat/mark-read", {
        method: "POST",
        body: JSON.stringify({
          room_id: roomId,
          last_read_message_id: lastReadMessageId || null,
        }),
      });

      // Optimistic update: set unread ke 0 di sidebar
      setRooms((prev) =>
        prev.map((r) => (r.id === roomId ? { ...r, unread_count: 0 } : r)),
      );
    } catch (e) {
      console.error("Failed to mark room as read:", e);
    }
  };

  // Helper: map raw DB row (from archive or send) to ChatMessage
  const toChatMessage = (m: any): ChatMessage => ({
    id: m.id,
    sender_id: m.sender_id,
    sender_name: m.sender_name_snapshot || null,
    sender_photo: m.sender_photo_snapshot || null,
    content: m.body ?? m.content,
    type: m.type || "text",
    created_at: m.created_at,
  });

  const loadInitialMessages = async () => {
    if (!currentRoom) return;
    setLoading(true);
    try {
      // Ambil 50 pesan TERBARU dari local DB server (permanent source of truth)
      const res = await apiFetch(
        `/api/chat/archive?room_id=${currentRoom.id}&limit=50&latest=true`,
      );

      if (!res.ok) {
        throw new Error(`Archive API error: ${res.status}`);
      }

      const raw: any[] = await res.json();
      const reversed = [...raw].reverse(); // backend returns DESC when latest=true

      const initialMessages = reversed.map(toChatMessage);
      initialMessages.forEach((m) => seenIdsRef.current.add(m.id));

      if (initialMessages.length > 0) {
        anchorRef.current = initialMessages[0].created_at;
      }

      setMessages(initialMessages);

      // Otomatis tandai sebagai sudah dibaca setelah pesan dimuat
      if (currentRoom?.id) {
        const lastMsg = initialMessages[initialMessages.length - 1];
        await markRoomAsRead(currentRoom.id, lastMsg?.id);
      }
    } catch (e) {
      console.error("Failed to load messages:", e);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreMessages = async () => {
    if (!anchorRef.current || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await apiFetch(
        `/api/chat/archive?room_id=${currentRoom.id}&limit=50&before=${anchorRef.current}`,
      );
      const more: any[] = await res.json();
      const newMessages = more
        .map(toChatMessage)
        .filter((m: ChatMessage) => !seenIdsRef.current.has(m.id));

      newMessages.forEach((m) => seenIdsRef.current.add(m.id));

      if (newMessages.length > 0) {
        // Pesan yang lebih lama muncul di atas
        anchorRef.current = newMessages[0].created_at;
        setMessages((prev) => [...newMessages, ...prev]);
      }
    } catch (e) {
      console.error("Failed to load more messages:", e);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSend = async () => {
    if (!message.trim() || !currentRoom || !(user as any)?.uuid) return;

    const contentToSend = message.trim();
    const tempId = `temp-${Date.now()}`;
    const tempMsg: ChatMessage = {
      id: tempId,
      sender_id: (user as any)?.uuid || "current-user",
      content: contentToSend,
      type: "text",
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);
    setMessage("");

    try {
      const res = await apiFetch("/api/chat/send", {
        method: "POST",
        body: JSON.stringify({
          room_id: currentRoom.id,
          content: contentToSend,
        }),
      });

      if (res.ok) {
        // Sukses simpan ke local + Supabase.
        // TAPI tidak langsung pakai response dari local untuk ditampilkan.
        // Kita hapus saja temp message, dan biarkan pesan asli muncul via Realtime Broadcast.
        // (Ini sesuai permintaan: local hanya untuk load saat refresh, bukan untuk live session)
        setMessages((prev) => prev.filter((m) => m.id !== tempId));

        // Catat id-nya supaya kalau realtime datang lebih cepat, tidak double
        const real = await res.json().catch(() => null);
        if (real?.id) {
          seenIdsRef.current.add(real.id);
        }
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        console.error("Send failed:", res.status, await res.text());
      }
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      console.error("Send error:", e);
    }
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });

  const renderRoomList = () => (
    <>
      <div className="px-3 pt-4 pb-2">
        <p className="text-[10px] font-semibold tracking-[1.2px] text-[#9C8B75] uppercase">
          Ruang Chat
        </p>
      </div>
      <div className="overflow-y-auto flex-1 px-2 pb-3">
        {rooms.length === 0 && (
          <p className="text-xs text-[#9C8B75] px-3 py-2">Belum ada room</p>
        )}

        {rooms
          .filter((r) => r.scope_type === "general")
          .map((room) => {
            const isActive = currentRoom?.id === room.id;
            return (
              <button
                key={room.id}
                onClick={() => {
                  selectRoom(room);
                  setMobileRoomsOpen(false);
                }}
                className={[
                  "w-full flex items-center gap-2.5 px-3 py-2.5 mb-1 rounded-xl text-sm transition-all text-left",
                  isActive
                    ? "bg-[#4A7C59] text-white font-medium shadow-sm"
                    : "hover:bg-[#EDE4D3] text-[#6B5B45] hover:text-[#2E5239]",
                ].join(" ")}
              >
                <Users className="h-4 w-4 flex-shrink-0" />
                <span className="truncate flex-1">{room.name}</span>

                {/* Unread badge */}
                {(room.unread_count ?? 0) > 0 && (
                  <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white">
                    {room.unread_count > 99 ? "99+" : room.unread_count}
                  </span>
                )}

                {isActive && (room.unread_count ?? 0) === 0 && (
                  <span className="h-1.5 w-1.5 rounded-full bg-white/70 flex-shrink-0" />
                )}
              </button>
            );
          })}
        {rooms.some((r) => r.scope_type === "small") && (
          <p className="text-[10px] font-semibold tracking-[1.2px] text-[#2E5239] mt-4 mb-1.5 px-3 uppercase">
            Keluarga Inti
          </p>
        )}
        {rooms
          .filter((r) => r.scope_type === "small")
          .map((room) => {
            const isActive = currentRoom?.id === room.id;
            return (
              <button
                key={room.id}
                onClick={() => {
                  selectRoom(room);
                  setMobileRoomsOpen(false);
                }}
                className={[
                  "w-full flex items-center gap-2.5 px-3 py-2.5 mb-1 rounded-xl text-sm transition-all text-left",
                  isActive
                    ? "bg-[#2E5239] text-white font-medium shadow-sm"
                    : "hover:bg-[#D6EAD9] text-[#6B5B45] hover:text-[#2E5239]",
                ].join(" ")}
              >
                <Home className="h-4 w-4 flex-shrink-0" />
                <span className="truncate flex-1">{room.name}</span>

                {/* Unread badge untuk small room */}
                {(room.unread_count ?? 0) > 0 && (
                  <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white">
                    {room.unread_count > 99 ? "99+" : room.unread_count}
                  </span>
                )}

                {isActive && (room.unread_count ?? 0) === 0 && (
                  <span className="h-1.5 w-1.5 rounded-full bg-white/70 flex-shrink-0" />
                )}
              </button>
            );
          })}
      </div>
    </>
  );

  if (!currentRoom && !loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[#9C8B75]">Anda belum terhubung dengan keluarga</p>
        </div>
      </div>
    );
  }

  return (
    /*
      ROOT: h-full so we fill exactly the space AppSidebar's <main> gives us.
      flex flex-col + overflow-hidden to start the height chain.
    */
    <div className="flex flex-col h-full overflow-hidden bg-[#FDFAF5] rounded-xl border border-[#D4C4A8] shadow-sm">
      {/* ── Top bar: "Chat Keluarga" title ── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#D4C4A8] flex-shrink-0">
        <h1 className="text-base font-semibold text-[#3B2F1E]">
          Chat Keluarga
        </h1>
      </div>

      {/* ── Body: sidebar + chat column ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex w-52 border-r border-[#D4C4A8] bg-[#F5F0E8] flex-col flex-shrink-0 overflow-hidden">
          {renderRoomList()}
        </aside>

        {/* ── Main chat column ── */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Room header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[#D4C4A8] flex-shrink-0 bg-[#FDFAF5]">
            {currentRoom && (
              <>
                <div
                  className={[
                    "flex h-9 w-9 items-center justify-center rounded-xl flex-shrink-0",
                    currentRoom.scope_type === "general"
                      ? "bg-[#D6EAD9]"
                      : "bg-[#D6EAD9]",
                  ].join(" ")}
                >
                  {currentRoom.scope_type === "general" ? (
                    <Users className="h-4 w-4 text-[#4A7C59]" />
                  ) : (
                    <Home className="h-4 w-4 text-[#2E5239]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-[#3B2F1E] truncate leading-tight">
                    {currentRoom.name}
                  </p>
                  <p className="text-[11px] text-[#9C8B75] leading-tight mt-0.5">
                    {currentRoom.scope_type === "general"
                      ? "Keluarga besar · Semua anggota"
                      : "Keluarga inti · Hanya ayah + istri + anak"}
                  </p>
                </div>
                {/* Mobile: open room drawer */}
                <Button
                  variant="outline"
                  size="sm"
                  className="md:hidden flex-shrink-0 h-8 text-xs gap-1.5"
                  onClick={() => setMobileRoomsOpen(true)}
                >
                  <Users className="h-3.5 w-3.5" />
                  Ruang
                </Button>
              </>
            )}
          </div>

          {/*
            ── Messages area ──
            THE KEY:
            • flex-1   → takes all remaining vertical space in the column
            • min-h-0  → allows flex child to shrink (default min-height: auto would overflow)
            • overflow-y-auto → scrolls internally instead of pushing layout
          */}
          <div
            ref={messagesAreaRef}
            className="flex-1 min-h-0 overflow-y-auto px-4 py-4 flex flex-col gap-1 bg-[#EDE4D3]"
          >
            {/* Load more older messages */}
            {anchorRef.current && (
              <div className="flex justify-center pb-3">
                <button
                  onClick={loadMoreMessages}
                  disabled={loadingMore}
                  className="text-xs text-[#9C8B75] hover:text-[#6B5B45] disabled:opacity-50 transition-colors px-3 py-1 rounded-full hover:bg-[#F5F0E8]"
                >
                  {loadingMore ? "Memuat..." : "↑ Muat pesan sebelumnya"}
                </button>
              </div>
            )}

            {loading ? (
              <FamilyTreeLoader
                fullscreen={false}
                size="sm"
                message="Memuat pesan..."
              />
            ) : messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3">
                <div className="h-14 w-14 rounded-full bg-[#D4C4A8] flex items-center justify-center">
                  <Users className="h-6 w-6 text-[#9C8B75]" />
                </div>
                <p className="text-sm text-[#9C8B75]">Belum ada pesan</p>
                <p className="text-xs text-[#9C8B75]">Kirim pesan pertamamu!</p>
              </div>
            ) : (
              messages.map((msg, idx) => {
                const isMine = msg.sender_id === (user as any)?.uuid;
                const prevMsg = messages[idx - 1];
                const nextMsg = messages[idx + 1];
                const sameAsPrev =
                  prevMsg && prevMsg.sender_id === msg.sender_id;
                const sameAsNext =
                  nextMsg && nextMsg.sender_id === msg.sender_id;

                return (
                  <div
                    key={msg.id}
                    className={[
                      "flex items-end gap-2",
                      isMine ? "flex-row-reverse" : "flex-row",
                      sameAsPrev ? "mt-0.5" : "mt-3",
                    ].join(" ")}
                  >
                    {/* Avatar col — only for others */}
                    {!isMine ? (
                      sameAsNext ? (
                        // Show spacer so bubble aligns (avatar appears on last msg of group)
                        <div className="w-7 flex-shrink-0" />
                      ) : (
                        <Avatar className="h-7 w-7 flex-shrink-0 self-end mb-0.5">
                          {msg.sender_photo ? (
                            <AvatarImage
                              src={msg.sender_photo}
                              alt={msg.sender_name || "User"}
                            />
                          ) : null}
                          <AvatarFallback className="text-[10px] font-semibold bg-[#D6EAD9] text-[#2E5239]">
                            {(
                              msg.sender_name?.[0] ||
                              String(msg.sender_id)?.[0] ||
                              "?"
                            ).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      )
                    ) : (
                      <div className="w-7 flex-shrink-0" />
                    )}

                    {/* Bubble */}
                    <div
                      className={[
                        "max-w-[68%] sm:max-w-[55%] px-3.5 py-2 text-sm",
                        // Rounded corners: WhatsApp style — flat corner on side closest to avatar
                        isMine
                          ? [
                              "bg-[#4A7C59] text-white",
                              sameAsPrev && sameAsNext
                                ? "rounded-2xl rounded-tr-md"
                                : sameAsPrev
                                  ? "rounded-2xl rounded-br-md"
                                  : sameAsNext
                                    ? "rounded-2xl rounded-tr-md"
                                    : "rounded-2xl rounded-tr-md",
                            ].join(" ")
                          : [
                              "bg-[#FDFAF5] border border-[#D4C4A8] text-[#3B2F1E]",
                              sameAsPrev && sameAsNext
                                ? "rounded-2xl rounded-tl-md"
                                : sameAsPrev
                                  ? "rounded-2xl rounded-bl-md"
                                  : sameAsNext
                                    ? "rounded-2xl rounded-tl-md"
                                    : "rounded-2xl rounded-tl-md",
                            ].join(" "),
                        // Temp message (optimistic) slightly faded
                        String(msg.id).startsWith("temp-") ? "opacity-60" : "",
                      ].join(" ")}
                    >
                      {/* Sender name — only for others, only first in group */}
                      {!isMine && !sameAsPrev && (
                        <p className="text-[10px] font-semibold text-[#4A7C59] mb-1 leading-none">
                          {msg.sender_name ||
                            `Anggota #${String(msg.sender_id).slice(0, 6)}`}
                        </p>
                      )}

                      <p className="leading-relaxed break-words">
                        {typeof msg.content === "string"
                          ? msg.content
                          : JSON.stringify(msg.content)}
                      </p>

                      <p
                        className={[
                          "text-[10px] mt-1 leading-none text-right",
                          isMine ? "text-white/60" : "text-[#9C8B75]",
                        ].join(" ")}
                      >
                        {formatTime(msg.created_at)}
                        {String(msg.id).startsWith("temp-") && " ·"}
                      </p>
                    </div>
                  </div>
                );
              })
            )}

            <div ref={messagesEndRef} />
          </div>

          {/*
            ── Input bar ──
            flex-shrink-0: NEVER moves, always pinned at the bottom.
            This is the other half of the scroll fix.
          */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-t border-[#D4C4A8] bg-[#FDFAF5] flex-shrink-0">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ketik pesan..."
              className="flex-1 rounded-full bg-[#EDE4D3] border-0 focus-visible:ring-1 focus-visible:ring-[#4A7C59]/30 h-10 px-4 text-sm placeholder:text-[#9C8B75]"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button
              onClick={handleSend}
              size="icon"
              className="rounded-full h-10 w-10 flex-shrink-0 shadow-sm bg-[#4A7C59] hover:bg-[#2E5239] text-white"
              disabled={!message.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {/* ── End main chat column ── */}

        {/* ── Mobile room drawer ── */}
        {mobileRoomsOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/40 md:hidden"
              onClick={() => setMobileRoomsOpen(false)}
            />
            <div className="fixed inset-y-0 left-0 z-50 w-[78%] max-w-[280px] bg-[#FDFAF5] border-r border-[#D4C4A8] shadow-xl md:hidden flex flex-col">
              <div className="flex items-center justify-between px-4 h-14 border-b flex-shrink-0">
                <p className="font-semibold text-sm text-[#9C8B75] tracking-wider uppercase text-xs">
                  Pilih Ruang Chat
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileRoomsOpen(false)}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto flex flex-col">
                {renderRoomList()}
              </div>
              <div className="px-4 py-3 border-t">
                <p className="text-[11px] text-[#9C8B75] text-center">
                  Ketuk ruang untuk bergabung
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
