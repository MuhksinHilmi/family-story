"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  Heart,
  MessageCircle,
  MoreHorizontal,
  Image,
  Users,
  Calendar,
  Plus,
  RefreshCw,
  Lock,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api-client";

interface Feed {
  id: string;
  family_uuid: string;
  user_id: string;
  caption: string | null;
  created_at: string;
  user_name: string;
  user_photo: string | null;
  like_count: number;
  comment_count: number;
  has_liked: boolean;
  scope_type: string;
  small_family_uuid: string | null;
  media: Array<{
    id: string;
    media_url: string;
    media_type: string;
    sort_order: number;
  }>;
}

export default function FeedsPage() {
  const [families, setFamilies] = useState<any[]>([]);
  const [selectedFamilyUuid, setSelectedFamilyUuid] = useState<string>("");
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingFamilies, setLoadingFamilies] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [newFeedsCount, setNewFeedsCount] = useState(0);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { user } = useAuth();
  const firstName = user?.full_name?.split(" ")[0] || "Kamu";

  // Infinite scroll handler (on internal container, not window)
  useEffect(() => {
    const handleScroll = () => {
      const el = scrollContainerRef.current;
      if (!el) return;
      if (
        el.scrollTop + el.clientHeight >= el.scrollHeight - 400 &&
        !loadingMore &&
        hasMore &&
        !refreshing
      ) {
        loadMore();
      }
    };

    const el = scrollContainerRef.current;
    if (el) {
      el.addEventListener("scroll", handleScroll);
    }
    return () => {
      if (el) el.removeEventListener("scroll", handleScroll);
    };
  }, [loadingMore, hasMore, refreshing]);

  // Fetch user's families
  useEffect(() => {
    const fetchFamilies = async () => {
      setLoadingFamilies(true);
      try {
        const res = await apiFetch("/api/user/families");
        if (res.ok) {
          const data = await res.json();
          setFamilies(data);
          if (data.length > 0) {
            setSelectedFamilyUuid(data[0].uuid);
          }
        }
      } catch (err) {
        console.error("Failed to load families", err);
      } finally {
        setLoadingFamilies(false);
      }
    };
    fetchFamilies();
  }, []);

  // Fetch initial feeds (10 terbaru)
  const fetchFeeds = async (isRefresh = false) => {
    if (!selectedFamilyUuid) {
      if (!isRefresh) setLoading(false);
      return;
    }

    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await apiFetch(
        `/api/feeds?family_uuid=${selectedFamilyUuid}&limit=10`,
      );
      if (res.ok) {
        const data = await res.json();

        if (isRefresh) {
          const existingIds = new Set(feeds.map((f) => f.id));
          const newOnes = data.filter((f: Feed) => !existingIds.has(f.id));

          if (newOnes.length > 0) {
            setFeeds((prev) => [...newOnes, ...prev]);
          }
        } else {
          setFeeds(data);
          setHasMore(data.length === 10);
        }
      }
    } catch (err) {
      console.error("Failed to load feeds", err);
    } finally {
      if (isRefresh) setRefreshing(false);
      else setLoading(false);
    }
  };

  // Fetch feeds when family changes
  useEffect(() => {
    if (!selectedFamilyUuid) return;
    fetchFeeds();
  }, [selectedFamilyUuid]);

  const toggleLike = async (feedId: string, currentlyLiked: boolean) => {
    try {
      const method = currentlyLiked ? "DELETE" : "POST";
      const res = await apiFetch(`/api/feeds/${feedId}/like`, { method });

      if (res.ok) {
        setFeeds((prev) =>
          prev.map((f) =>
            f.id === feedId
              ? {
                  ...f,
                  has_liked: !currentlyLiked,
                  like_count: currentlyLiked
                    ? Number(f.like_count) - 1
                    : Number(f.like_count) + 1,
                }
              : f,
          ),
        );
      }
    } catch (err) {
      console.error("Like error", err);
    }
  };

  // Load more older feeds (10 per click)
  const loadMore = async () => {
    if (!selectedFamilyUuid || loadingMore || !hasMore || feeds.length === 0)
      return;

    setLoadingMore(true);

    const oldestFeed = feeds[feeds.length - 1];

    try {
      const res = await apiFetch(
        `/api/feeds?family_uuid=${selectedFamilyUuid}&limit=10&before=${oldestFeed.created_at}`,
      );
      if (res.ok) {
        const data = await res.json();
        if (data.length > 0) {
          setFeeds((prev) => [...prev, ...data]);
          setHasMore(data.length === 10);
        } else {
          setHasMore(false);
        }
      }
    } catch (err) {
      console.error("Load more error", err);
    } finally {
      setLoadingMore(false);
    }
  };

  // Pull to refresh / muat ulang feed terbaru
  const handleRefresh = async () => {
    if (!selectedFamilyUuid || refreshing) return;

    setRefreshing(true);
    setNewFeedsCount(0);

    try {
      const res = await apiFetch(
        `/api/feeds?family_uuid=${selectedFamilyUuid}&limit=15`,
      );
      if (res.ok) {
        const newData: Feed[] = await res.json();

        const existingIds = new Set(feeds.map((f) => f.id));
        const trulyNew = newData.filter((f) => !existingIds.has(f.id));

        if (trulyNew.length > 0) {
          setFeeds((prev) => [...trulyNew, ...prev]);
          setNewFeedsCount(trulyNew.length);

          // Auto hide the "X feed baru" banner after 4 seconds
          setTimeout(() => setNewFeedsCount(0), 4000);
        }
      }
    } catch (err) {
      console.error("Refresh error", err);
    } finally {
      setRefreshing(false);
    }
  };

  // New scope icon (replaces getScopeLabel + getScopeColor)
  const getScopeIcon = (feed: Feed) => {
    if (feed.scope_type === "small") {
      return (
        <div
          title="Keluarga Inti"
          className="w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center"
        >
          <Lock size={13} className="text-white" />
        </div>
      );
    }
    return (
      <div
        title="Keluarga Besar"
        className="w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center"
      >
        <Users size={13} className="text-white" />
      </div>
    );
  };

  // Updated renderMedia (no borders, no rounded on wrappers, relative grid for +N)
  const renderMedia = (media: Feed["media"]) => {
    if (!media || media.length === 0) return null;

    const count = media.length;

    if (count === 1) {
      return (
        <div>
          <img
            src={media[0].media_url}
            alt="feed media"
            className="w-full max-h-[460px] object-cover"
          />
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 gap-0.5 relative">
        {media.slice(0, 4).map((m, idx) => (
          <div key={idx} className="aspect-square">
            <img
              src={m.media_url}
              alt={`media-${idx}`}
              className="w-full h-full object-cover"
            />
          </div>
        ))}
        {count > 4 && (
          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded">
            +{count - 4} foto
          </div>
        )}
      </div>
    );
  };

  return (
    <div ref={scrollContainerRef} className="overflow-y-auto h-full">
      <div className="max-w-2xl mx-auto pb-10">
        <div className="flex items-center justify-between px-4 pt-6 pb-4 my-4 sticky top-0 bg-[#FDFAF5] z-40 border-b border-[#D4C4A8]">
          <div className="flex items-center gap-3 ">
            <h3 className="text-2xl font-semibold text-[#3B2F1E]">
              Halo, {firstName}!
            </h3>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-[#D4C4A8] hover:bg-[#F5F0E8] active:bg-[#EDE4D3] disabled:opacity-60 transition"
            >
              {refreshing ? (
                <>
                  <span className="animate-spin inline-block w-3 h-3 border-2 border-[#4A7C59] border-t-transparent rounded-full" />
                  Menyegarkan...
                </>
              ) : (
                <>
                  <RefreshCw size={16} />
                </>
              )}
            </button>
          </div>

          {families.length > 0 && (
            <Link
              href="/feeds/new"
              className="px-4 py-2 bg-[#4A7C59] hover:bg-[#2E5239] text-white rounded-xl text-sm font-medium shadow-sm"
            >
              + Momen
            </Link>
          )}
        </div>

        {/* Banner "X feed baru dimuat" */}
        {newFeedsCount > 0 && (
          <div className="mx-4 mt-3 mb-1 px-4 py-2 bg-green-100 text-green-700 text-sm rounded-xl flex items-center justify-between">
            <span>{newFeedsCount} feed baru dimuat</span>
            <button
              onClick={() => setNewFeedsCount(0)}
              className="text-green-600 hover:text-green-800"
            >
              ×
            </button>
          </div>
        )}

        {/* Family selector */}
        {families.length > 1 && (
          <div className="px-4 mb-4">
            <select
              value={selectedFamilyUuid}
              onChange={(e) => setSelectedFamilyUuid(e.target.value)}
              className="w-full border border-[#D4C4A8] rounded-xl px-4 py-2 bg-[#FDFAF5]"
            >
              {families.map((f) => (
                <option key={f.uuid} value={f.uuid}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {loadingFamilies ? (
          <div className="text-center py-10 text-[#9C8B75]">
            Memuat data keluarga...
          </div>
        ) : families.length === 0 ? (
          <div className="text-center py-16 px-6">
            <p className="text-[#6B5B45] text-lg">
              Anda belum tergabung dalam keluarga manapun.
            </p>
            <p className="text-sm text-[#9C8B75] mt-2">
              Silakan terima undangan keluarga terlebih dahulu.
            </p>
          </div>
        ) : loading ? (
          <div className="text-center py-10 text-[#9C8B75]">
            Memuat feeds...
          </div>
        ) : feeds.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="mb-8">
              <div className="relative w-64 h-40 mx-auto">
                <div className="absolute top-4 left-4 w-56 h-32 bg-[#D4C4A8] rounded-xl shadow-md rotate-[-6deg]" />
                <div className="absolute top-0 left-0 w-56 h-32 bg-[#EDE4D3] border border-[#C4B39A] rounded-xl shadow-lg flex items-center justify-center">
                  <div className="grid grid-cols-2 gap-2 p-4 w-full h-full">
                    <div className="bg-[#F5F0E8] border border-[#D4C4A8] rounded flex items-center justify-center">
                      <Image className="text-[#C4B39A]" size={28} />
                    </div>
                    <div className="bg-[#F5F0E8] border border-[#D4C4A8] rounded flex items-center justify-center">
                      <Users className="text-[#C4B39A]" size={28} />
                    </div>
                    <div className="bg-[#F5F0E8] border border-[#D4C4A8] rounded flex items-center justify-center">
                      <Calendar className="text-[#C4B39A]" size={28} />
                    </div>
                    <div className="bg-[#F5F0E8] border border-[#D4C4A8] rounded flex items-center justify-center">
                      <Heart className="text-[#C4B39A]" size={28} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <h2 className="text-2xl font-semibold text-[#3B2F1E] mb-3">
              Cerita keluarga ini baru saja dimulai
            </h2>

            <p className="max-w-md text-[#6B5B45] mb-2 leading-relaxed">
              Belum ada momen yang dibagikan. Mulailah dengan berbagi foto,
              video, atau cerita kecil hari ini.
            </p>

            <p className="max-w-md text-sm text-[#9C8B75] mb-8">
              Setiap foto dan cerita yang kamu bagikan akan menjadi bagian dari
              sejarah keluarga kita.
            </p>

            <Link
              href="/feeds/new"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#4A7C59] hover:bg-[#2E5239] text-white rounded-2xl font-medium shadow-sm transition"
            >
              <Plus size={20} />
              Bagikan Momen Pertamamu
            </Link>
          </div>
        ) : (
          <div className="space-y-6 px-4">
            {feeds.map((feed) => (
              <div
                key={feed.id}
                className="bg-white border border-[#D4C4A8] rounded-2xl overflow-hidden shadow-sm"
              >
                {/* Media area — full width, no border, no padding */}
                <div className="relative">
                  {/* Media */}
                  {renderMedia(feed.media)}

                  {/* Overlay: gradient at the top for legibility (stronger for bright images) */}
                  {feed.media && feed.media.length > 0 && (
                    <div
                      className="absolute inset-x-0 top-0 h-24 
                    bg-gradient-to-b from-black/80 via-black/50 to-transparent pointer-events-none"
                    />
                  )}

                  {/* Overlay: user info top-left */}
                  {feed.media && feed.media.length > 0 && (
                    <div className="absolute top-3 left-3 flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-full bg-[#EDE4D3] overflow-hidden 
                      ring-2 ring-white/60 flex-shrink-0"
                      >
                        {feed.user_photo && (
                          <img
                            src={feed.user_photo}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <div>
                        <p className="text-white text-xs font-semibold drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
                          {feed.user_name}
                        </p>
                        <p className="text-white/90 text-[10px] drop-shadow-[0_1px_4px_rgba(0,0,0,0.85)]">
                          {new Date(feed.created_at).toLocaleDateString(
                            "id-ID",
                            {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Overlay: scope icon top-right */}
                  {feed.media && feed.media.length > 0 && (
                    <div className="absolute top-3 right-3">
                      {getScopeIcon(feed)}
                    </div>
                  )}
                </div>

                {/* If NO media: show user info as normal card header */}
                {(!feed.media || feed.media.length === 0) && (
                  <div
                    className="flex items-center justify-between px-4 py-3 border-b 
                  border-[#D4C4A8]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#EDE4D3] overflow-hidden">
                        {feed.user_photo && (
                          <img
                            src={feed.user_photo}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">
                          {feed.user_name}
                        </p>
                        <p className="text-[10px] text-[#9C8B75]">
                          {new Date(feed.created_at).toLocaleDateString(
                            "id-ID",
                            {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </p>
                      </div>
                    </div>
                    <div>{getScopeIcon(feed)}</div>
                  </div>
                )}

                {/* Caption */}
                {feed.caption && (
                  <div className="px-4 py-3 text-sm text-[#3B2F1E] whitespace-pre-line">
                    {feed.caption}
                  </div>
                )}

                {/* Action bar */}
                <div
                  className="px-4 py-3 border-t border-[#D4C4A8] flex items-center 
                gap-5 text-sm"
                >
                  <button
                    onClick={() => toggleLike(feed.id, feed.has_liked)}
                    className={`flex items-center gap-1.5 
                    ${feed.has_liked ? "text-red-500" : "text-[#6B5B45]"}`}
                  >
                    <Heart
                      className={feed.has_liked ? "fill-current" : ""}
                      size={18}
                    />
                    <span>{feed.like_count}</span>
                  </button>
                  <div className="flex items-center gap-1.5 text-[#6B5B45]">
                    <MessageCircle size={18} />
                    <span>{feed.comment_count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Infinite scroll loading indicator */}
        {loadingMore && (
          <div className="flex justify-center py-6">
            <div className="flex items-center gap-2 text-sm text-[#9C8B75]">
              <span className="animate-spin inline-block w-4 h-4 border-2 border-[#4A7C59] border-t-transparent rounded-full" />
              Memuat lebih banyak...
            </div>
          </div>
        )}

        {!hasMore && feeds.length > 0 && !loadingMore && (
          <p className="text-center text-xs text-[#9C8B75] py-6">
            — Semua feed sudah dimuat —
          </p>
        )}
      </div>
    </div>
  );
}
