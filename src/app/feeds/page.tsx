"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from 'next/navigation';
import Link from "next/link";
import {
  Heart,
  MessageCircle,
  Image,
  Users,
  Calendar,
  Plus,
  RefreshCw,
  Lock,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api-client";
import dynamic from 'next/dynamic';
const FocusedFeedModal = dynamic(() => import('./FocusedFeedModal'), { ssr: false });
import { renderWithMentions } from '@/lib/mentions';


interface Feed {
  id: string;
  node_id: string;
  caption: string | null;
  created_at: string;
  user_name: string;
  user_photo: string | null;
  like_count: number;
  comment_count: number;
  has_liked: boolean;
  scope_type: "extended" | "nuclear" | "custom";
  media: Array<{
    id?: string;
    media_url: string;
    media_type: string;
    sort_order: number;
  }>;
  other_viewers?: Array<{
    id: number;
    full_name: string;
    photo_url: string | null;
  }>;
  other_viewer_count?: number;
}

interface CommentItem {
  id: string;
  user_name: string;
  user_photo: string | null;
  content: string;
  created_at: string;
}

export default function FeedsPage() {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [newFeedsCount, setNewFeedsCount] = useState(0);

  // Flip card comment states
  const [flippedFeedId, setFlippedFeedId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, CommentItem[]>>({});
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [loadingComments, setLoadingComments] = useState<Record<string, boolean>>({});

  // Stable flip card height measurement
  const frontRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [cardHeights, setCardHeights] = useState<Record<string, number>>({});

  // comment input refs and mention autocomplete state (single active feed at a time)
  const commentInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [extendedContacts, setExtendedContacts] = useState<any[]>([]);
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionActive, setMentionActive] = useState(0);
  const [mentionAnchorIndex, setMentionAnchorIndex] = useState<number | null>(null);
  const [mentionFeedId, setMentionFeedId] = useState<string | null>(null);

  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const res = await apiFetch('/api/user/extended-contacts');
        if (res.ok) {
          const data = await res.json();
          setExtendedContacts(data.contacts || []);
        }
      } catch (e) {
        console.warn('Failed to fetch extended contacts for feed mentions', e);
      }
    };
    fetchContacts();
  }, []);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Image preview modal state
  const [preview, setPreview] = useState<{ feed: Feed; index: number } | null>(null);

  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const firstName = user?.full_name?.split(" ")[0] || "Kamu";

  // focused feed modal state
  const [focusedFeed, setFocusedFeed] = useState<Feed | null>(null);
  const focusIdFromUrl = searchParams.get("focus");

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return "Selamat Pagi ☀️";
    if (hour >= 11 && hour < 15) return "Selamat Siang 🌤️";
    if (hour >= 15 && hour < 18) return "Selamat Sore 🌅";
    return "Selamat Malam 🌙";
  }, []);

  const todayDate = useMemo(() => {
    const date = new Date();
    const weekday = date.toLocaleDateString("id-ID", { weekday: "long" });
    const day = date.getDate();
    const month = date.toLocaleDateString("id-ID", { month: "long" });
    return `${weekday}, ${day} ${month}`;
  }, []);

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

  // Family fetching removed — feed visibility is now handled server-side via feed_viewers + extended groups + nuclear snapshots.
  // The old family selector is no longer needed for loading the feed list.

  // Fetch initial feeds (visible to current user via new visibility system)
  const fetchFeeds = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      // New endpoint: no family_uuid needed. Visibility is handled server-side via feed_viewers.
      const res = await apiFetch(`/api/feeds?limit=10`);
      if (res.ok) {
        const data = await res.json();

        if (isRefresh) {
          const existingIds = new Set(feeds.map((f) => f.id));
          const newOnes = data.feeds.filter((f: Feed) => !existingIds.has(f.id));

          if (newOnes.length > 0) {
            setFeeds((prev) => [...newOnes, ...prev]);
          }
        } else {
          setFeeds(data.feeds || data);
          setHasMore((data.feeds || data).length === 10);
        }
      }
    } catch (err) {
      console.error("Failed to load feeds", err);
    } finally {
      if (isRefresh) setRefreshing(false);
      else setLoading(false);
    }
  };

  // Initial fetch (no longer depends on selectedFamilyUuid)
  useEffect(() => {
    fetchFeeds();
  }, []);

  // If focus param present, fetch focused feed
  useEffect(() => {
    const fid = focusIdFromUrl;
    if (!fid) return;

    // wait for auth to finish loading; if user not logged in, API returns 401 and we redirect
    if (authLoading) return;

    const fetchFocused = async () => {
      try {
        console.log('DEBUG: attempting fetch focused feed, focusId=', fid);
        const res = await apiFetch(`/api/feeds/${fid}`);
        console.log('DEBUG: focused fetch status=', res.status);
        if (res.ok) {
          const data = await res.json();
          console.log('DEBUG: focused feed data=', data?.id);
          setFocusedFeed(data);
          return;
        }

        // If unauthorized, redirect to login preserving next param
        if (res.status === 401) {
          const next = encodeURIComponent(window.location.pathname + window.location.search);
          // Defer navigation to avoid interfering with React render/hook ordering
          setTimeout(() => {
            window.location.href = `/auth/login?next=${next}`;
          }, 0);
          return;
        }

        // other errors: remove focus param
        const url = new URL(window.location.href);
        url.searchParams.delete('focus');
        router.replace(url.pathname + url.search, { scroll: false });
      } catch (e) {
        console.warn('Failed to load focused feed', e);
      }
    };
    fetchFocused();
  }, [focusIdFromUrl, authLoading]);

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
    if (loadingMore || !hasMore || feeds.length === 0) return;

    setLoadingMore(true);

    const oldestFeed = feeds[feeds.length - 1];

    try {
      // New endpoint - no family_uuid
      const res = await apiFetch(
        `/api/feeds?limit=10&before=${oldestFeed.created_at}`,
      );
      if (res.ok) {
        const data = await res.json();
        const newFeeds = data.feeds || data;
        if (newFeeds.length > 0) {
          setFeeds((prev) => [...prev, ...newFeeds]);
          setHasMore(newFeeds.length === 10);
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
    if (refreshing) return;

    setRefreshing(true);
    setNewFeedsCount(0);

    try {
      // New endpoint - no family_uuid
      const res = await apiFetch(`/api/feeds?limit=15`);
      if (res.ok) {
        const data = await res.json();
        const newData: Feed[] = data.feeds || data;

        const existingIds = new Set(feeds.map((f) => f.id));
        const trulyNew = newData.filter((f) => !existingIds.has(f.id));

        if (trulyNew.length > 0) {
          setFeeds((prev) => [...trulyNew, ...prev]);
          setNewFeedsCount(trulyNew.length);

          setTimeout(() => setNewFeedsCount(0), 4000);
        }
      }
    } catch (err) {
      console.error("Refresh error", err);
    } finally {
      setRefreshing(false);
    }
  };

  // === Flip card comment handlers ===
  const fetchComments = async (feedId: string) => {
    if (comments[feedId]) return; // sudah pernah di-fetch
    setLoadingComments((prev) => ({ ...prev, [feedId]: true }));
    try {
      const res = await apiFetch(`/api/feeds/${feedId}/comments`);
      if (res.ok) {
        const data = await res.json();
        // Normalize API field "comment" → "content" for UI
        const normalized: CommentItem[] = data.map((c: any) => ({
          id: c.id,
          user_name: c.user_name,
          user_photo: c.user_photo,
          content: c.comment,
          created_at: c.created_at,
        }));
        setComments((prev) => ({ ...prev, [feedId]: normalized }));
      }
    } finally {
      setLoadingComments((prev) => ({ ...prev, [feedId]: false }));
    }
  };

  const submitComment = async (feedId: string) => {
    const text = commentText[feedId]?.trim();
    if (!text) return;
    try {
      const res = await apiFetch(`/api/feeds/${feedId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: text }),
      });
      if (res.ok) {
        const apiComment = await res.json();
        const newComment: CommentItem = {
          id: apiComment.id,
          user_name: apiComment.user_name,
          user_photo: apiComment.user_photo,
          content: apiComment.comment,
          created_at: apiComment.created_at,
        };
        setComments((prev) => ({
          ...prev,
          [feedId]: [newComment, ...(prev[feedId] || [])],
        }));
        setCommentText((prev) => ({ ...prev, [feedId]: "" }));
        // update comment_count di feed card
        setFeeds((prev) =>
          prev.map((f) =>
            f.id === feedId
              ? { ...f, comment_count: Number(f.comment_count) + 1 }
              : f,
          ),
        );
      }
    } catch (err) {
      console.error("Submit comment error", err);
    }
  };

  const toggleFlip = (feedId: string) => {
    if (flippedFeedId === feedId) {
      setFlippedFeedId(null);
    } else {
      setFlippedFeedId(feedId);
      fetchComments(feedId);
    }
  };

  // Image preview helpers
  const openPreview = (feed: Feed, index: number) => {
    setPreview({ feed, index });
  };

  const closePreview = () => {
    setPreview(null);
  };

  const goPrev = () => {
    if (!preview || preview.feed.media.length === 0) return;
    const newIndex =
      (preview.index - 1 + preview.feed.media.length) % preview.feed.media.length;
    setPreview({ ...preview, index: newIndex });
  };

  const goNext = () => {
    if (!preview || preview.feed.media.length === 0) return;
    const newIndex = (preview.index + 1) % preview.feed.media.length;
    setPreview({ ...preview, index: newIndex });
  };

  // Keyboard support for preview modal
  useEffect(() => {
    if (!preview) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePreview();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [preview]);

  // Measure front card heights for stable flip card sizing on mobile
  useEffect(() => {
    const heights: Record<string, number> = {};
    feeds.forEach((feed) => {
      const el = frontRefs.current[feed.id];
      if (el) heights[feed.id] = el.offsetHeight;
    });
    setCardHeights(heights);
  }, [feeds]);

  useEffect(() => {
    const heights: Record<string, number> = {};
    feeds.forEach((feed) => {
      const el = frontRefs.current[feed.id];
      if (el) heights[feed.id] = el.offsetHeight;
    });
    setCardHeights((prev) => ({ ...prev, ...heights }));
  }, [flippedFeedId]);

  const filteredMentionOptions = () => extendedContacts
    .filter((p: any) => p.full_name.toLowerCase().includes(mentionQuery.toLowerCase()))
    .slice(0, 8);

  const selectMentionForFeed = (feedId: string, person: any) => {
    const cur = commentText[feedId] || '';
    if (mentionAnchorIndex == null || mentionFeedId !== feedId) return;
    const before = cur.slice(0, mentionAnchorIndex);
    const afterStart = mentionAnchorIndex + 1 + (mentionQuery ? mentionQuery.length : 0);
    const after = cur.slice(afterStart);
    const insert = `@${person.full_name} `;
    const newText = before + insert + after;
    setCommentText((prev) => ({ ...prev, [feedId]: newText }));
    setShowMentionDropdown(false);
    setMentionQuery('');
    setMentionFeedId(null);

    // set caret
    setTimeout(() => {
      const el = commentInputRefs.current[feedId];
      if (el) {
        const pos = before.length + insert.length;
        el.focus();
        el.setSelectionRange(pos, pos);
      }
    }, 0);
  };


  const getScopeIcon = (feed: Feed) => {
    if (feed.scope_type === "nuclear") {
      return (
        <div
          title="Keluarga Inti"
          className="w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center"
        >
          <Lock size={13} className="text-white" />
        </div>
      );
    }
    if (feed.scope_type === "custom") {
      return (
        <div
          title="Pilih Manual"
          className="w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center"
        >
          <Users size={13} className="text-white" />
        </div>
      );
    }
    // extended (default)
    return (
      <div
        title="Keluarga Besar"
        className="w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center"
      >
        <Users size={13} className="text-white" />
      </div>
    );
  };

  // Updated renderMedia (clickable for elegant preview, no borders, relative grid for +N)
  const renderMedia = (
    media: Feed["media"],
    onImageClick?: (index: number) => void,
  ) => {
    if (!media || media.length === 0) return null;

    const count = media.length;
    const handleClick = onImageClick
      ? (idx: number) => onImageClick(idx)
      : undefined;

    if (count === 1) {
      return (
        <div
          className={onImageClick ? "cursor-pointer" : ""}
          onClick={handleClick ? () => handleClick(0) : undefined}
        >
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
          <div
            key={idx}
            className={`aspect-square ${onImageClick ? "cursor-pointer" : ""}`}
            onClick={handleClick ? () => handleClick(idx) : undefined}
          >
            <img
              src={m.media_url}
              alt={`media-${idx}`}
              className="w-full h-full object-cover"
            />
          </div>
        ))}
        {count > 4 && (
          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded pointer-events-none">
            +{count - 4} foto
          </div>
        )}
      </div>
    );
  };

  return (
    <div ref={scrollContainerRef} className="overflow-y-auto h-full">
      <div className="max-w-2xl mx-auto pb-10">
        <div className="sticky top-0 z-40 px-4 pt-5 pb-3 bg-[#F5F0E8] ">
          {/* Row 1: Greeting + Date + Refresh */}
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs text-[#9C8B75]">{greeting}</div>
              <h3 className="text-2xl font-bold text-[#2C1A0E] leading-none mt-0.5">
                Halo, {firstName}!
              </h3>
            </div>

            <div className="text-right">
              <div className="text-xs text-[#9C8B75]">{todayDate}</div>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="mt-1 w-8 h-8 flex items-center justify-center rounded-full border border-[#D4C4A8] hover:bg-[#EDE4D3] disabled:opacity-60 transition"
              >
                <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          {/* Row 2: Tagline + Create button */}
          <div className="flex items-center justify-between mt-3">
            <p className="text-xs italic text-[#A07850]">
              Bagikan momen bersama keluarga
            </p>

            <Link
              href="/feeds/new"
              className="px-5 py-2.5 bg-[#4A7C59] hover:bg-[#2E5239] text-white rounded-2xl text-sm font-semibold shadow-md hover:shadow-lg transition"
            >
              + Momen
            </Link>
          </div>
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

        {loading ? (
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
              Belum ada momen
            </h2>

            <p className="max-w-md text-[#6B5B45] mb-2 leading-relaxed">
              Mulailah dengan berbagi foto, video, atau cerita kecil hari ini.
            </p>

            <p className="max-w-md text-sm text-[#9C8B75] mb-8">
              Setiap momen yang kamu bagikan akan tersimpan dalam sejarah keluarga.
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
              <div key={feed.id} style={{ perspective: "1000px" }} className="w-full">
                <div
                  className="relative grid w-full"
                  style={{
                    transformStyle: "preserve-3d",
                    transition: "transform 0.55s cubic-bezier(0.4, 0.2, 0.2, 1)",
                    transform: flippedFeedId === feed.id ? "rotateY(180deg)" : "rotateY(0deg)",
                    gridTemplateAreas: '"stack"',
                    minHeight: cardHeights[feed.id] ? `${cardHeights[feed.id]}px` : undefined,
                  }}
                >
                  {/* ===== SISI DEPAN (FOTO + KONTEN ASLI) ===== */}
                  <div
                    ref={(el) => { frontRefs.current[feed.id] = el; }}
                    style={{ gridArea: "stack", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
                    className="w-full bg-white border border-[#D4C4A8] rounded-2xl overflow-hidden shadow-sm"
                  >
                    {/* Media area — full width, no border, no padding */}
                    <div className="relative">
                      {/* Media */}
                      {renderMedia(feed.media, (idx) => openPreview(feed, idx))}

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
                        {renderWithMentions(feed.caption, (name:string)=>{ const q=encodeURIComponent(name); router.push(`/tree?focus_name=${q}`); })}
                      </div>
                    )}

                     {/* Action bar */}
                     <div className="px-4 py-3 border-t border-[#D4C4A8] flex flex-row items-center justify-between text-sm min-h-[44px] flex-nowrap">
                      {/* Left: Like + Comment */}
                      <div className="flex items-center gap-5">
                        <button
                          onClick={() => toggleLike(feed.id, feed.has_liked)}
                          className={`flex items-center gap-1.5 ${feed.has_liked ? "text-red-500" : "text-[#6B5B45]"}`}
                        >
                          <Heart className={feed.has_liked ? "fill-current" : ""} size={18} />
                          <span>{feed.like_count}</span>
                        </button>
                        <button
                          onClick={() => toggleFlip(feed.id)}
                          className="flex items-center gap-1.5 text-[#6B5B45] hover:text-[#4A7C59] active:scale-[0.985] transition"
                        >
                          <MessageCircle size={18} />
                          <span>{feed.comment_count}</span>
                        </button>
                      </div>

                      {/* Right: Viewers avatars (who can see this feed, excluding self) */}
                      {feed.other_viewer_count && feed.other_viewer_count > 0 && (
                        <div className="flex items-center -space-x-1.5 flex-shrink-0 max-w-[160px] overflow-hidden p-2">
                          {feed.other_viewers?.slice(0, 9).map((viewer) => (
                            <Avatar
                              key={viewer.id}
                              className="w-8 h-8 border border-white ring-1 ring-[#D4C4A8]"
                              title={viewer.full_name}
                            >
                              {viewer.photo_url && <AvatarImage src={viewer.photo_url} alt={viewer.full_name} />}
                              <AvatarFallback className="bg-[#EDE4D3] text-[#6B5B45] text-[10px] font-semibold">
                                {viewer.full_name ? viewer.full_name[0].toUpperCase() : "?"}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                          {(feed.other_viewer_count ?? 0) > 9 && (
                            <div
                              className="w-6 h-6 rounded-full bg-[#EDE4D3] text-[#6B5B45] text-[9px] font-medium flex items-center justify-center border border-white ring-1 ring-[#D4C4A8]"
                              title={`${feed.other_viewer_count} orang bisa melihat`}
                            >
                              +{feed.other_viewer_count - 9}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ===== SISI BELAKANG (COMMENT) ===== */}
                  <div
                    style={{
                      gridArea: "stack",
                      backfaceVisibility: "hidden",
                      WebkitBackfaceVisibility: "hidden",
                      transform: "rotateY(180deg)",
                      height: cardHeights[feed.id] ? `${cardHeights[feed.id]}px` : "100%",
                    }}
                    className="w-full bg-[#FDFAF5] border border-[#D4C4A8] rounded-2xl overflow-visible shadow-sm flex flex-col"
                  >
                    {/* Header belakang card */}
                    <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-[#D4C4A8] bg-white">
                      <div className="flex items-center gap-2">
                        <MessageCircle size={16} className="text-[#4A7C59]" />
                        <span className="text-sm font-semibold text-[#3B2F1E]">
                          Komentar ({feed.comment_count})
                        </span>
                      </div>
                      <button
                        onClick={() => setFlippedFeedId(null)}
                        className="text-xs text-[#9C8B75] hover:text-[#3B2F1E] flex items-center gap-1 transition"
                      >
                        <ChevronLeft size={14} />
                        Kembali
                      </button>
                    </div>

                    {/* List comment — internal scroll only */}
                    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                      {loadingComments[feed.id] ? (
                        <div className="flex justify-center py-6">
                          <span className="animate-spin w-5 h-5 border-2 border-[#4A7C59] border-t-transparent rounded-full" />
                        </div>
                      ) : (comments[feed.id] || []).length === 0 ? (
                        <div className="text-center py-8 text-[#9C8B75] text-sm">
                          Belum ada komentar. Jadilah yang pertama! 💬
                        </div>
                      ) : (
                        (comments[feed.id] || []).map((comment) => (
                          <div key={comment.id} className="flex gap-2.5 items-start">
                            <div className="w-7 h-7 rounded-full bg-[#EDE4D3] overflow-hidden flex-shrink-0 mt-0.5">
                              {comment.user_photo && (
                                <img
                                  src={comment.user_photo}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              )}
                            </div>
                            <div className="flex-1 bg-white rounded-xl px-3 py-2 border border-[#E8DFD0] shadow-sm">
                              <p className="text-xs font-semibold text-[#3B2F1E]">
                                {comment.user_name}
                              </p>
                              <p className="text-sm text-[#4B3B2A] leading-snug mt-0.5">
                                {renderWithMentions(comment.content)}
                              </p>
                              <p className="text-[10px] text-[#B0A090] mt-1">
                                {new Date(comment.created_at).toLocaleDateString("id-ID", {
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Input comment */}
                    <div className="flex-shrink-0 px-4 py-3 border-t border-[#D4C4A8] bg-white flex gap-2">
                      <div className="relative flex-1">
                        <input
                          ref={el => { commentInputRefs.current[feed.id] = el; }}
                          type="text"
                          value={commentText[feed.id] || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCommentText((prev) => ({ ...prev, [feed.id]: val }));

                            // detect mention token before caret
                            const input = e.target as HTMLInputElement;
                            const cursor = input.selectionStart || 0;
                            const pre = val.slice(0, cursor);
                            const m = pre.match(/@([\w\.-]*)$/);
                            if (m) {
                              setMentionQuery(m[1]);
                              setShowMentionDropdown(true);
                              setMentionAnchorIndex(cursor - m[1].length - 1);
                              setMentionActive(0);
                              setMentionFeedId(feed.id);
                            } else if (mentionFeedId === feed.id) {
                              setMentionQuery('');
                              setShowMentionDropdown(false);
                              setMentionAnchorIndex(null);
                              setMentionFeedId(null);
                            }
                          }
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              if (showMentionDropdown && mentionFeedId === feed.id && filteredMentionOptions().length > 0) {
                                e.preventDefault();
                                selectMentionForFeed(feed.id, filteredMentionOptions()[0]);
                                return;
                              }
                              submitComment(feed.id);
                            }
                            if (showMentionDropdown && mentionFeedId === feed.id) {
                              if (e.key === 'ArrowDown') { e.preventDefault(); setMentionActive((s) => Math.min(s+1, Math.max(0, filteredMentionOptions().length-1))); }
                              if (e.key === 'ArrowUp') { e.preventDefault(); setMentionActive((s) => Math.max(0, s-1)); }
                              if (e.key === 'Escape') { setShowMentionDropdown(false); setMentionFeedId(null); }
                            }
                          }}
                          placeholder="Tulis komentar..."
                          className="w-full text-sm px-3 py-2 rounded-xl border border-[#D4C4A8] bg-[#FDFAF5] focus:outline-none focus:ring-1 focus:ring-[#4A7C59] text-[#3B2F1E] placeholder:text-[#B0A090]"
                        />

                        {showMentionDropdown && mentionFeedId === feed.id && (
                          <div className="absolute left-0 z-50 w-full rounded-xl border border-[#D4C4A8] bg-white shadow-lg max-h-48 overflow-auto" style={{ bottom: 'calc(100% + 8px)' }}>
                            {filteredMentionOptions().length > 0 ? filteredMentionOptions().map((p, i) => (
                              <button key={p.id} type="button" onClick={() => selectMentionForFeed(feed.id, p)} className={`flex items-center gap-3 px-3 py-2 text-left text-sm ${i === mentionActive ? 'bg-[#F5F0E8]' : ''}`}>
                                <div className="h-8 w-8 rounded-full bg-[#EDE4D3] flex-shrink-0 overflow-hidden flex items-center justify-center">{p.photo_url ? <img src={p.photo_url} className="w-full h-full object-cover"/> : <span className="text-[#6B5B45] text-xs font-semibold">{p.full_name[0].toUpperCase()}</span>}</div>
                                <div>{p.full_name}</div>
                              </button>
                            )) : (<div className="px-3 py-2 text-sm text-[#9C8B75]">Tidak ada yang cocok</div>)}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => submitComment(feed.id)}
                        disabled={!commentText[feed.id]?.trim()}
                        className="px-4 py-2 bg-[#4A7C59] hover:bg-[#2E5239] text-white rounded-xl text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition"
                      >
                        Kirim
                      </button>
                    </div>
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

        {/* Focused feed modal (from email link) */}
        {focusedFeed && (
          <FocusedFeedModal
            feed={focusedFeed}
            onClose={() => {
              const url = new URL(window.location.href);
              url.searchParams.delete('focus');
              router.replace(url.pathname + url.search, { scroll: false });
              setFocusedFeed(null);
            }}
          />
        )}

        {/* Elegant Image Preview Modal */}
        {preview && preview.feed.media.length > 0 && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
            onClick={closePreview}
          >
            <div
              className="relative max-h-[90vh] max-w-[90vw] w-full flex flex-col items-center"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={closePreview}
                className="absolute -top-2 -right-2 z-10 rounded-full bg-[#3B2F1E] p-2 text-white hover:bg-[#4A7C59] transition"
                aria-label="Tutup preview"
              >
                <X size={20} />
              </button>

              {/* Main image */}
              <img
                src={preview.feed.media[preview.index].media_url}
                alt={`preview-${preview.index}`}
                className="max-h-[80vh] max-w-full object-contain rounded-xl shadow-2xl border border-[#D4C4A8]/30"
              />

              {/* Navigation */}
              {preview.feed.media.length > 1 && (
                <>
                  <button
                    onClick={goPrev}
                    className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-3 text-white hover:bg-[#4A7C59] transition"
                    aria-label="Foto sebelumnya"
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <button
                    onClick={goNext}
                    className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-3 text-white hover:bg-[#4A7C59] transition"
                    aria-label="Foto berikutnya"
                  >
                    <ChevronRight size={24} />
                  </button>

                  {/* Indicator */}
                  <div className="mt-4 flex items-center gap-2 text-sm text-white/80">
                    {preview.feed.media.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setPreview({ ...preview, index: i })}
                        className={`h-1.5 rounded-full transition-all ${i === preview.index ? "w-6 bg-white" : "w-2 bg-white/50 hover:bg-white/70"}`}
                      />
                    ))}
                    <span className="ml-3 tabular-nums">
                      {preview.index + 1} / {preview.feed.media.length}
                    </span>
                  </div>
                </>
              )}

              {/* Optional subtle info bar */}
              <div className="mt-3 text-center text-xs text-white/60">
                {preview.feed.user_name} •{" "}
                {new Date(preview.feed.created_at).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "short",
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
