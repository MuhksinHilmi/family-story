"use client";

export const dynamic = "force-dynamic";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Users, Home } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { createClient } from '@supabase/supabase-js';
import { ChatMessage, User } from "@/types";
import { getAuthHeaders } from "@/lib/api-client";
import { useAuth } from "@/context/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const CUTOFF_DAYS = 3;

function getCutoffDate() {
  const d = new Date();
  d.setDate(d.getDate() - CUTOFF_DAYS);
  return d.toISOString();
}

export default function ChatPage() {
  const { logout } = useAuth();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [rooms, setRooms] = useState<any[]>([]);
  const [currentRoom, setCurrentRoom] = useState<any>(null);
  const [user, setUser] = useState<User | null>(null);
  const anchorRef = useRef<string | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

useEffect(() => {
    if (!user?.id) return;
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

    // Create Supabase client with custom JWT for private Realtime channels (RLS)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        accessToken: async () => localStorage.getItem("token") || "",
      }
    );

    // Explicitly set the token for Realtime (helps with private channels + custom JWT)
    supabase.realtime.setAuth(token);

    // Build correct topic based on scope_type (must match DB trigger exactly)
    const smallId =
      currentRoom.small_family_uuid || currentRoom.small_family_id;
    const topic =
      currentRoom.scope_type === "general"
        ? `family:${currentRoom.family_uuid}:general`
        : `family:${currentRoom.family_uuid}:small:${smallId}`;

    const channel = supabase
      .channel(topic, { config: { private: true } })   // ← must be private to match realtime.send(..., true)
      .on("broadcast", { event: "message_created" }, (payload) => {
        const msg = payload.payload as any;
        if (!msg?.id || seenIdsRef.current.has(msg.id)) return;
        seenIdsRef.current.add(msg.id);

        const chatMsg: ChatMessage = {
          id: msg.id,
          room_id: msg.room_id ?? currentRoom?.id,
          sender_id: msg.sender_id,
          sender_name: msg.sender_name_snapshot || null,
          sender_photo: msg.sender_photo_snapshot || null,
          content: msg.body,
          type: "text",
          created_at: msg.created_at,
        };
        setMessages((prev) => {
          // Drop any still-pending optimistic temps now that we have the real message
          const withoutPending = prev.filter((m) => !String(m.id).startsWith("temp-"));
          return [...withoutPending, chatMsg];
        });
      })
      .subscribe((status, err) => {
        console.log(`[Realtime] ${topic} → status: ${status}`);
        if (status === "SUBSCRIBED") {
          console.log(`[Realtime] Successfully subscribed to ${topic}`);
        }
        if (status === "CLOSED") {
          console.warn(`[Realtime] Channel CLOSED for ${topic}. This usually means JWT lacks 'role: authenticated' or RLS on realtime.messages denied access.`);
        }
        if (err) {
          console.error(`[Realtime] Error on ${topic}:`, err);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentRoom, user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchChatRooms = async () => {
    try {
      const res = await fetch(`/api/chat/rooms`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setRooms(data);

        // Auto select General room first, or first room
        const generalRoom = data.find((r: any) => r.scope_type === "general");
        const firstRoom = generalRoom || data[0];
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
    setCurrentRoom(room);
    setMessages([]);
    seenIdsRef.current.clear();
    anchorRef.current = null;
  };

  const loadInitialMessages = async () => {
    if (!currentRoom) return;
    setLoading(true);
    try {
      const cutoff = getCutoffDate();
      const [archiveRes, realtimeRes] = await Promise.all([
        fetch(`/api/chat/archive?room_id=${currentRoom.id}&limit=50`, {
          headers: getAuthHeaders(),
        }),
        fetch(
          `/api/chat/realtime?room_id=${currentRoom.id}&cutoff=${cutoff}&limit=50`,
          { headers: getAuthHeaders() },
        ),
      ]);

      const archiveData = await archiveRes.json();
      const realtimeData = await realtimeRes.json();

      // Defensive: API bisa return {error: "..."} jika gagal
      const archive = Array.isArray(archiveData) ? archiveData : [];
      const realtime = Array.isArray(realtimeData) ? realtimeData : [];

      if (!Array.isArray(archiveData) && archiveData?.error) {
        console.error("Archive API error:", archiveData.error);
      }
      if (!Array.isArray(realtimeData) && realtimeData?.error) {
        console.error("Realtime API error:", realtimeData.error);
      }

      const allMessages: ChatMessage[] = [];
      const ids = new Set<string>();

      [...archive, ...realtime].forEach((m: any) => {
        // Support both legacy archive (user_id/content JSONB) and new messages table (sender_id/body)
        const sender = m.sender_id || m.user_id;
        const body = m.body ?? m.content;
        const msg: ChatMessage = {
          id: m.id,
          room_id: m.room_id ?? currentRoom?.id,
          sender_id: sender,
          sender_name:
            m.sender_name_snapshot ||
            m.sender_name ||
            (m.metadata?.sender_name ?? null),
          sender_photo:
            m.sender_photo_snapshot || m.metadata?.photo_url || null,
          content:
            typeof body === "string"
              ? body
              : typeof body === "object"
                ? body
                : JSON.stringify(body),
          type: m.type || "text",
          created_at: m.created_at,
        };
        if (!ids.has(msg.id)) {
          ids.add(msg.id);
          allMessages.push(msg);
        }
      });

      allMessages.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );

      allMessages.forEach((m) => seenIdsRef.current.add(m.id));

      if (allMessages.length > 0) {
        anchorRef.current = allMessages[0].created_at;
      }

      setMessages(allMessages);
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
      const res = await fetch(
        `/api/chat/archive?room_id=${currentRoom.id}&limit=50&before=${anchorRef.current}`,
        {
          headers: getAuthHeaders(),
        },
      );
      const more: any[] = await res.json();

      const newMessages = more
        .map((m: any) => {
          const sender = m.sender_id || m.user_id;
          const body = m.body ?? m.content;
          return {
            id: m.id,
            room_id: m.room_id ?? currentRoom?.id,
            sender_id: sender,
            sender_name:
              m.sender_name_snapshot ||
              m.sender_name ||
              (m.metadata?.sender_name ?? null),
            sender_photo:
              m.sender_photo_snapshot || m.metadata?.photo_url || null,
            content:
              typeof body === "string"
                ? body
                : typeof body === "object"
                  ? body
                  : JSON.stringify(body),
            type: m.type || "text",
            created_at: m.created_at,
          };
        })
        .filter((m: ChatMessage) => !seenIdsRef.current.has(m.id));

      newMessages.forEach((m) => seenIdsRef.current.add(m.id));

      if (newMessages.length > 0) {
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
    const roomIdToUse = currentRoom.id;

    const tempId = `temp-${Date.now()}`;
    const tempMsg: ChatMessage = {
      id: tempId,
      room_id: roomIdToUse,
      sender_id: (user as any)?.uuid || "current-user",
      content: contentToSend,
      type: "text",
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);
    setMessage("");

    try {
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          room_id: roomIdToUse,
          content: contentToSend,
        }),
      });

      if (res.ok) {
        const real = await res.json();
        const realMsg: ChatMessage = {
          id: real.id,
          room_id: real.room_id ?? roomIdToUse,
          sender_id: real.sender_id,
          sender_name: real.sender_name_snapshot || null,
          sender_photo: real.sender_photo_snapshot || null,
          content: real.body,
          type: "text",
          created_at: real.created_at,
        };

        seenIdsRef.current.add(real.id);

        // Replace optimistic temp message with authoritative server record
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? realMsg : m))
        );
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        const errText = await res.text();
        console.error("Send failed:", res.status, errText);
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

  if (!currentRoom) {
    return (
      <div className="flex flex-col h-screen">
        <Card className="flex-1 flex flex-col min-h-0">
          <CardHeader>
            <CardTitle>Chat Keluarga</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex items-center justify-center">
            <p className="text-gray-500">
              Anda belum terhubung dengan keluarga
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100%]">
      <Card className="flex-1 flex flex-col min-h-0">
        <CardHeader className="pb-3 flex-shrink-0">
          <CardTitle className="text-xl">Chat Keluarga</CardTitle>
          {currentRoom && (
            <p className="text-xs text-gray-500 -mt-1 truncate">
              {currentRoom.name}
            </p>
          )}
        </CardHeader>
        <CardContent className="flex-1 flex p-0 min-h-0">
          <div className="w-56 border-r bg-gray-50 flex flex-col flex-shrink-0">
            <div className="px-3 pt-3 pb-2">
              <div className="text-[10px] font-semibold tracking-[1px] text-gray-500">
                RUANG CHAT
              </div>
            </div>
            <div
              className="overflow-y-auto px-2 pb-2"
              style={{ maxHeight: "220px" }}
            >
              {rooms.length === 0 && (
                <div className="text-xs text-gray-400 px-2 py-1">
                  Belum ada room
                </div>
              )}

              {rooms
                .filter((r) => r.scope_type === "general")
                .map((room) => {
                  const isActive = currentRoom?.id === room.id;
                  return (
                    <div
                      key={room.id}
                      onClick={() => selectRoom(room)}
                      className={`group flex items-center gap-2 px-3 py-2 mb-1 rounded-lg cursor-pointer text-sm transition-all active:scale-[0.985] ${
                        isActive
                          ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                          : "hover:bg-gray-100 text-gray-700 hover:text-gray-900"
                      }`}
                      title={room.name}
                    >
                      <Users
                        className={`h-4 w-4 flex-shrink-0 ${isActive ? "text-primary-foreground" : "text-gray-500 group-hover:text-gray-600"}`}
                      />
                      <span className="truncate flex-1">{room.name}</span>
                      {isActive && (
                        <div className="ml-1 h-1.5 w-1.5 rounded-full bg-white/80" />
                      )}
                    </div>
                  );
                })}

              {rooms.some((r) => r.scope_type === "small") && (
                <div className="text-[10px] font-medium tracking-widest text-emerald-600/70 mt-3 mb-1 px-1">
                  KELUARGA INTI
                </div>
              )}
              {rooms
                .filter((r) => r.scope_type === "small")
                .map((room) => {
                  const isActive = currentRoom?.id === room.id;
                  return (
                    <div
                      key={room.id}
                      onClick={() => selectRoom(room)}
                      className={`group flex items-center gap-2 px-3 py-2 mb-1 rounded-lg cursor-pointer text-sm transition-all active:scale-[0.985] ${
                        isActive
                          ? "bg-emerald-600 text-white font-semibold shadow-sm"
                          : "hover:bg-emerald-50 text-gray-700 hover:text-emerald-900"
                      }`}
                      title={room.name}
                    >
                      <Home
                        className={`h-4 w-4 flex-shrink-0 ${isActive ? "text-white" : "text-emerald-600/70 group-hover:text-emerald-700"}`}
                      />
                      <span className="truncate flex-1">{room.name}</span>
                      {isActive && (
                        <div className="ml-1 h-1.5 w-1.5 rounded-full bg-white/80" />
                      )}
                    </div>
                  );
                })}
            </div>
          </div>

          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center gap-3 pb-3 mb-3 border-b flex-shrink-0">
              {currentRoom && (
                <>
                  {currentRoom.scope_type === "general" ? (
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100">
                      <Home className="h-5 w-5 text-emerald-600" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-base truncate">
                      {currentRoom.name}
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {currentRoom.scope_type === "general"
                        ? "Keluarga besar • Semua anggota"
                        : "Keluarga inti • Hanya ayah + istri + anak"}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1" style={{ maxHeight: "60vh" }}>
              {loading ? (
                <div className="text-center py-8">Memuat pesan...</div>
              ) : messages.length === 0 ? (
                <div className="text-center py-8">Belum ada pesan</div>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.sender_id === (user as any)?.uuid;
                  return (
                    <div
                      key={msg.id}
                      className={`flex items-start gap-2 ${isMine ? "justify-end" : ""}`}
                    >
                      {!isMine && (
                        <Avatar className="h-7 w-7 mt-0.5 flex-shrink-0">
                          {msg.sender_photo ? (
                            <AvatarImage
                              src={msg.sender_photo}
                              alt={msg.sender_name || "User"}
                            />
                          ) : null}
                          <AvatarFallback className="text-[10px] font-semibold bg-primary/10 text-primary">
                            {(
                              msg.sender_name?.[0] ||
                              String(msg.sender_id)?.[0] ||
                              "?"
                            ).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div
                        className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${isMine ? "bg-primary text-primary-foreground rounded-br-md" : "bg-white border border-gray-100"}`}
                      >
                        {!isMine && (
                          <p className="text-[10px] font-medium text-gray-500 mb-0.5">
                            {msg.sender_name ||
                              `Anggota #${String(msg.sender_id).slice(0, 8)}`}
                          </p>
                        )}
                        <p
                          className={
                            isMine ? "text-primary-foreground" : "text-gray-800"
                          }
                        >
                          {typeof msg.content === "string"
                            ? msg.content
                            : JSON.stringify(msg.content)}
                        </p>
                        <p
                          className={`text-[10px] mt-1 ${isMine ? "text-primary-foreground/70 text-right" : "text-gray-400"}`}
                        >
                          {formatTime(msg.created_at)}
                        </p>
                      </div>
                      {isMine && (
                        <div className="w-7 h-7 mt-0.5 bg-primary/80 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-semibold text-white">
                            Y
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              {loadingMore && (
                <div className="text-center py-4">Memuat lebih banyak...</div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="flex gap-2 pt-4 flex-shrink-0">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ketik pesan..."
                className="flex-1"
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
              />
              <Button onClick={handleSend}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
