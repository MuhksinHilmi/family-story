"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import dynamic from "next/dynamic";
const FocusedFeedModal = dynamic(() => import("./FocusedFeedModal"), {
  ssr: false,
});
import { renderWithMentions } from "@/lib/mentions";

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
  const [loadingComments, setLoadingComments] = useState<
    Record<string, boolean>
  >({});

  // Stable flip card height measurement
  const frontRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [cardHeights, setCardHeights] = useState<Record<string, number>>({});

  // comment input refs and mention autocomplete state (single active feed at a time)
  const commentInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [extendedContacts, setExtendedContacts] = useState<any[]>([]);
  const [mentionQuery, setMentionQuery] = useState("");
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionActive, setMentionActive] = useState(0);
  const [mentionAnchorIndex, setMentionAnchorIndex] = useState<number | null>(
    null,
  );
  const [mentionFeedId, setMentionFeedId] = useState<string | null>(null);

  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const res = await apiFetch("/api/user/extended-contacts");
        if (res.ok) {
          const data = await res.json();
          setExtendedContacts(data.contacts || []);
        }
      } catch (e) {
        console.warn("Failed to fetch extended contacts for feed mentions", e);
      }
    };
    fetchContacts();
  }, []);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Image preview modal state
  const [preview, setPreview] = useState<{ feed: Feed; index: number } | null>(
    null,
  );

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
          const newOnes = data.feeds.filter(
            (f: Feed) => !existingIds.has(f.id),
          );

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
        console.log("DEBUG: attempting fetch focused feed, focusId=", fid);
        const res = await apiFetch(`/api/feeds/${fid}`);
        console.log("DEBUG: focused fetch status=", res.status);
        if (res.ok) {
          const data = await res.json();
          console.log("DEBUG: focused feed data=", data?.id);
          setFocusedFeed(data);
          return;
        }

        // If unauthorized, redirect to login preserving next param
        if (res.status === 401) {
          const next = encodeURIComponent(
            window.location.pathname + window.location.search,
          );
          // Defer navigation to avoid interfering with React render/hook ordering
          setTimeout(() => {
            window.location.href = `/auth/login?next=${next}`;
          }, 0);
          return;
        }

        // other errors: remove focus param
        const url = new URL(window.location.href);
        url.searchParams.delete("focus");
        router.replace(url.pathname + url.search, { scroll: false });
      } catch (e) {
        console.warn("Failed to load focused feed", e);
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
      (preview.index - 1 + preview.feed.media.length) %
      preview.feed.media.length;
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

  const filteredMentionOptions = () =>
    extendedContacts
      .filter((p: any) =>
        p.full_name.toLowerCase().includes(mentionQuery.toLowerCase()),
      )
      .slice(0, 8);

  const selectMentionForFeed = (feedId: string, person: any) => {
    const cur = commentText[feedId] || "";
    if (mentionAnchorIndex == null || mentionFeedId !== feedId) return;
    const before = cur.slice(0, mentionAnchorIndex);
    const afterStart =
      mentionAnchorIndex + 1 + (mentionQuery ? mentionQuery.length : 0);
    const after = cur.slice(afterStart);
    const insert = `@${person.full_name} `;
    const newText = before + insert + after;
    setCommentText((prev) => ({ ...prev, [feedId]: newText }));
    setShowMentionDropdown(false);
    setMentionQuery("");
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
    const title =
      feed.scope_type === "nuclear"
        ? "Keluarga Inti"
        : feed.scope_type === "custom"
          ? "Pilih Manual"
          : "Keluarga Besar";
    const Icon = feed.scope_type === "nuclear" ? Lock : Users;
    return (
      <div title={title} className="ck-feed-scope">
        <Icon size={13} />
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
    <div className="ck-feed-page">
      {/* ── Sticky header ── */}
      <div className="ck-feed-header">
        <div className="ck-feed-header-row1">
          <div>
            <p className="ck-feed-greeting">{greeting}</p>
            <h2 className="ck-feed-hello">Halo, {firstName}!</h2>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: 0,
            }}
          >
            <p className="ck-feed-date">{todayDate}</p>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="ck-feed-refresh-btn"
              aria-label="Muat ulang feed"
            >
              <RefreshCw
                size={15}
                className={refreshing ? "animate-spin" : ""}
              />
            </button>
          </div>
        </div>
        <div className="ck-feed-header-row2">
          <p className="ck-feed-tagline">Bagikan momen bersama keluarga</p>
          <Link href="/feeds/new" className="ck-feed-new-btn">
            <Plus size={14} />
            Momen
          </Link>
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div ref={scrollContainerRef} className="ck-feed-body">
        <div className="ck-feed-list">
          {/* New feeds banner */}
          {newFeedsCount > 0 && (
            <div className="ck-feed-new-banner">
              <span>{newFeedsCount} momen baru dimuat</span>
              <button
                onClick={() => setNewFeedsCount(0)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "inherit",
                  fontSize: "1rem",
                  lineHeight: 1,
                }}
                aria-label="Tutup banner"
              >
                ×
              </button>
            </div>
          )}

          {loading ? (
            <div
              style={{
                textAlign: "center",
                padding: "3rem 0",
                color: "var(--ck-dash-text3)",
                fontSize: "0.875rem",
              }}
            >
              Memuat momen keluarga...
            </div>
          ) : feeds.length === 0 ? (
            /* Empty state */
            <div className="ck-feed-empty">
              <div className="ck-feed-empty-icon">
                <Image size={24} />
              </div>
              <h3 className="ck-feed-empty-title">Belum ada momen</h3>
              <p className="ck-feed-empty-sub">
                Mulailah dengan berbagi foto, video, atau cerita kecil hari ini.
                Setiap momen yang kamu bagikan akan tersimpan dalam sejarah
                keluarga.
              </p>
              <Link href="/feeds/new" className="ck-feed-new-btn">
                <Plus size={15} />
                Bagikan Momen Pertama
              </Link>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "1.25rem",
              }}
            >
              {feeds.map((feed) => (
                <div key={feed.id} style={{ perspective: "1000px" }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateAreas: '"stack"',
                      transformStyle: "preserve-3d",
                      transition: "transform 0.5s cubic-bezier(0.4,0.2,0.2,1)",
                      transform:
                        flippedFeedId === feed.id
                          ? "rotateY(180deg)"
                          : "rotateY(0deg)",
                      minHeight: cardHeights[feed.id]
                        ? `${cardHeights[feed.id]}px`
                        : undefined,
                    }}
                  >
                    {/* SISI DEPAN */}
                    <div
                      ref={(el) => {
                        frontRefs.current[feed.id] = el;
                      }}
                      style={{
                        gridArea: "stack",
                        backfaceVisibility: "hidden",
                        WebkitBackfaceVisibility: "hidden",
                      }}
                      className="ck-feed-card"
                    >
                      <div style={{ position: "relative" }}>
                        {renderMedia(feed.media, (idx) =>
                          openPreview(feed, idx),
                        )}
                        {feed.media && feed.media.length > 0 && (
                          <>
                            <div
                              style={{
                                position: "absolute",
                                inset: 0,
                                background:
                                  "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 40%, transparent 100%)",
                                pointerEvents: "none",
                              }}
                            />
                            <div
                              style={{
                                position: "absolute",
                                top: 10,
                                left: 12,
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                              }}
                            >
                              <div
                                className="ck-feed-avatar"
                                style={{ width: 30, height: 30 }}
                              >
                                {feed.user_photo && (
                                  <img src={feed.user_photo} alt="" />
                                )}
                              </div>
                              <div>
                                <p
                                  style={{
                                    color: "#fff",
                                    fontSize: "0.75rem",
                                    fontWeight: 600,
                                    lineHeight: 1.2,
                                    textShadow: "0 1px 4px rgba(0,0,0,0.8)",
                                  }}
                                >
                                  {feed.user_name}
                                </p>
                                <p
                                  style={{
                                    color: "rgba(255,255,255,0.8)",
                                    fontSize: "0.625rem",
                                    textShadow: "0 1px 3px rgba(0,0,0,0.7)",
                                  }}
                                >
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
                            <div
                              style={{
                                position: "absolute",
                                top: 10,
                                right: 12,
                              }}
                            >
                              {getScopeIcon(feed)}
                            </div>
                          </>
                        )}
                      </div>

                      {(!feed.media || feed.media.length === 0) && (
                        <div className="ck-feed-card-header">
                          <div className="ck-feed-card-author">
                            <div className="ck-feed-avatar">
                              {feed.user_photo && (
                                <img src={feed.user_photo} alt="" />
                              )}
                            </div>
                            <div>
                              <p className="ck-feed-author-name">
                                {feed.user_name}
                              </p>
                              <p className="ck-feed-author-time">
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
                          {getScopeIcon(feed)}
                        </div>
                      )}

                      {feed.caption && (
                        <div className="ck-feed-caption">
                          {renderWithMentions(feed.caption, (name: string) => {
                            router.push(
                              `/tree?focus_name=${encodeURIComponent(name)}`,
                            );
                          })}
                        </div>
                      )}

                      <div className="ck-feed-actions">
                        <div className="ck-feed-action-left">
                          <button
                            onClick={() => toggleLike(feed.id, feed.has_liked)}
                            className={`ck-feed-action-btn${feed.has_liked ? " liked" : ""}`}
                            aria-label={feed.has_liked ? "Hapus suka" : "Suka"}
                          >
                            <Heart
                              size={16}
                              fill={feed.has_liked ? "currentColor" : "none"}
                            />
                            <span>{feed.like_count}</span>
                          </button>
                          <button
                            onClick={() => toggleFlip(feed.id)}
                            className="ck-feed-action-btn"
                            aria-label="Lihat komentar"
                          >
                            <MessageCircle size={16} />
                            <span>{feed.comment_count}</span>
                          </button>
                        </div>
                        {(feed.other_viewer_count ?? 0) > 0 && (
                          <div
                            style={{ display: "flex", alignItems: "center" }}
                          >
                            {feed.other_viewers?.slice(0, 5).map((viewer) => (
                              <Avatar
                                key={viewer.id}
                                style={{
                                  width: 24,
                                  height: 24,
                                  border: "2px solid var(--ck-dash-card)",
                                  marginLeft: -4,
                                }}
                                title={viewer.full_name}
                              >
                                {viewer.photo_url && (
                                  <AvatarImage
                                    src={viewer.photo_url}
                                    alt={viewer.full_name}
                                  />
                                )}
                                <AvatarFallback
                                  style={{
                                    fontSize: "0.5625rem",
                                    background: "var(--ck-dash-surface)",
                                    color: "var(--ck-dash-text2)",
                                  }}
                                >
                                  {viewer.full_name?.[0]?.toUpperCase() ?? "?"}
                                </AvatarFallback>
                              </Avatar>
                            ))}
                            {(feed.other_viewer_count ?? 0) > 5 && (
                              <span
                                style={{
                                  width: 24,
                                  height: 24,
                                  borderRadius: "50%",
                                  marginLeft: -4,
                                  background: "var(--ck-dash-surface)",
                                  border: "2px solid var(--ck-dash-card)",
                                  fontSize: "0.5625rem",
                                  fontWeight: 600,
                                  color: "var(--ck-dash-text3)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                +{(feed.other_viewer_count ?? 0) - 5}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* SISI BELAKANG */}
                    <div
                      style={{
                        gridArea: "stack",
                        backfaceVisibility: "hidden",
                        WebkitBackfaceVisibility: "hidden",
                        transform: "rotateY(180deg)",
                        height: cardHeights[feed.id]
                          ? `${cardHeights[feed.id]}px`
                          : "100%",
                      }}
                      className="ck-feed-comment-card"
                    >
                      <div className="ck-feed-comment-header">
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <MessageCircle
                            size={15}
                            style={{ color: "var(--ck-dash-green)" }}
                          />
                          <span
                            style={{
                              fontSize: "0.875rem",
                              fontWeight: 600,
                              color: "var(--ck-dash-text1)",
                            }}
                          >
                            Komentar ({feed.comment_count})
                          </span>
                        </div>
                        <button
                          onClick={() => setFlippedFeedId(null)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            fontSize: "0.75rem",
                            color: "var(--ck-dash-text3)",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                          }}
                        >
                          <ChevronLeft size={14} />
                          Kembali
                        </button>
                      </div>

                      <div
                        style={{
                          flex: 1,
                          overflowY: "auto",
                          padding: "0.875rem 1rem",
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.75rem",
                        }}
                      >
                        {loadingComments[feed.id] ? (
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "center",
                              padding: "1.5rem 0",
                            }}
                          >
                            <span
                              className="animate-spin"
                              style={{
                                width: 20,
                                height: 20,
                                border: "2px solid var(--ck-dash-green)",
                                borderTopColor: "transparent",
                                borderRadius: "50%",
                                display: "inline-block",
                              }}
                            />
                          </div>
                        ) : (comments[feed.id] || []).length === 0 ? (
                          <div
                            style={{
                              textAlign: "center",
                              padding: "2rem 0",
                              color: "var(--ck-dash-text3)",
                              fontSize: "0.875rem",
                            }}
                          >
                            Belum ada komentar. Jadilah yang pertama! 💬
                          </div>
                        ) : (
                          (comments[feed.id] || []).map((comment) => (
                            <div key={comment.id} className="ck-comment-item">
                              <div className="ck-comment-avatar">
                                {comment.user_photo && (
                                  <img
                                    src={comment.user_photo}
                                    alt=""
                                    style={{
                                      width: "100%",
                                      height: "100%",
                                      objectFit: "cover",
                                    }}
                                  />
                                )}
                              </div>
                              <div className="ck-comment-bubble">
                                <p className="ck-comment-name">
                                  {comment.user_name}
                                </p>
                                <p className="ck-comment-text">
                                  {renderWithMentions(comment.content)}
                                </p>
                                <p className="ck-comment-time">
                                  {new Date(
                                    comment.created_at,
                                  ).toLocaleDateString("id-ID", {
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

                      <div className="ck-feed-comment-input-row">
                        <div style={{ position: "relative", flex: 1 }}>
                          <input
                            ref={(el) => {
                              commentInputRefs.current[feed.id] = el;
                            }}
                            type="text"
                            value={commentText[feed.id] || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCommentText((prev) => ({
                                ...prev,
                                [feed.id]: val,
                              }));
                              const cursor = e.target.selectionStart || 0;
                              const pre = val.slice(0, cursor);
                              const m = pre.match(/@([\w\.-]*)$/);
                              if (m) {
                                setMentionQuery(m[1]);
                                setShowMentionDropdown(true);
                                setMentionAnchorIndex(cursor - m[1].length - 1);
                                setMentionActive(0);
                                setMentionFeedId(feed.id);
                              } else if (mentionFeedId === feed.id) {
                                setMentionQuery("");
                                setShowMentionDropdown(false);
                                setMentionAnchorIndex(null);
                                setMentionFeedId(null);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                if (
                                  showMentionDropdown &&
                                  mentionFeedId === feed.id &&
                                  filteredMentionOptions().length > 0
                                ) {
                                  e.preventDefault();
                                  selectMentionForFeed(
                                    feed.id,
                                    filteredMentionOptions()[0],
                                  );
                                  return;
                                }
                                submitComment(feed.id);
                              }
                              if (
                                showMentionDropdown &&
                                mentionFeedId === feed.id
                              ) {
                                if (e.key === "ArrowDown") {
                                  e.preventDefault();
                                  setMentionActive((s) =>
                                    Math.min(
                                      s + 1,
                                      filteredMentionOptions().length - 1,
                                    ),
                                  );
                                }
                                if (e.key === "ArrowUp") {
                                  e.preventDefault();
                                  setMentionActive((s) => Math.max(0, s - 1));
                                }
                                if (e.key === "Escape") {
                                  setShowMentionDropdown(false);
                                  setMentionFeedId(null);
                                }
                              }
                            }}
                            placeholder="Tulis komentar..."
                            className="ck-feed-comment-input"
                          />
                          {showMentionDropdown && mentionFeedId === feed.id && (
                            <div
                              style={{
                                position: "absolute",
                                left: 0,
                                bottom: "calc(100% + 8px)",
                                width: "100%",
                                zIndex: 50,
                                background: "var(--ck-dash-card)",
                                border: "1px solid var(--ck-dash-border)",
                                borderRadius: "0.875rem",
                                boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
                                maxHeight: 200,
                                overflowY: "auto",
                              }}
                            >
                              {filteredMentionOptions().length > 0 ? (
                                filteredMentionOptions().map((p, i) => (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() =>
                                      selectMentionForFeed(feed.id, p)
                                    }
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 10,
                                      width: "100%",
                                      padding: "0.5rem 0.875rem",
                                      background:
                                        i === mentionActive
                                          ? "var(--ck-dash-surface)"
                                          : "transparent",
                                      border: "none",
                                      cursor: "pointer",
                                      fontSize: "0.8125rem",
                                      color: "var(--ck-dash-text1)",
                                      textAlign: "left",
                                    }}
                                  >
                                    <div
                                      style={{
                                        width: 28,
                                        height: 28,
                                        borderRadius: "50%",
                                        background: "var(--ck-dash-surface)",
                                        overflow: "hidden",
                                        flexShrink: 0,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: "0.75rem",
                                        fontWeight: 600,
                                        color: "var(--ck-dash-text2)",
                                      }}
                                    >
                                      {p.photo_url ? (
                                        <img
                                          src={p.photo_url}
                                          style={{
                                            width: "100%",
                                            height: "100%",
                                            objectFit: "cover",
                                          }}
                                          alt=""
                                        />
                                      ) : (
                                        p.full_name[0].toUpperCase()
                                      )}
                                    </div>
                                    {p.full_name}
                                  </button>
                                ))
                              ) : (
                                <div
                                  style={{
                                    padding: "0.625rem 0.875rem",
                                    fontSize: "0.8125rem",
                                    color: "var(--ck-dash-text3)",
                                  }}
                                >
                                  Tidak ada yang cocok
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => submitComment(feed.id)}
                          disabled={!commentText[feed.id]?.trim()}
                          className="ck-feed-comment-send"
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

          {loadingMore && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 8,
                padding: "1.5rem 0",
                color: "var(--ck-dash-text3)",
                fontSize: "0.875rem",
              }}
            >
              <span
                className="animate-spin"
                style={{
                  width: 16,
                  height: 16,
                  border: "2px solid var(--ck-dash-green)",
                  borderTopColor: "transparent",
                  borderRadius: "50%",
                  display: "inline-block",
                }}
              />
              Memuat lebih banyak...
            </div>
          )}

          {!hasMore && feeds.length > 0 && !loadingMore && (
            <p
              style={{
                textAlign: "center",
                fontSize: "0.75rem",
                color: "var(--ck-dash-text3)",
                padding: "1.5rem 0",
              }}
            >
              — Semua momen sudah dimuat —
            </p>
          )}
        </div>
        {/* ck-feed-list */}
      </div>
      {/* ck-feed-body */}

      {/* Focused feed modal */}
      {focusedFeed && (
        <FocusedFeedModal
          feed={focusedFeed}
          onClose={() => {
            const url = new URL(window.location.href);
            url.searchParams.delete("focus");
            router.replace(url.pathname + url.search, { scroll: false });
            setFocusedFeed(null);
          }}
        />
      )}

      {/* Image preview modal */}
      {preview && preview.feed.media.length > 0 && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.92)",
            padding: "1rem",
          }}
          onClick={closePreview}
        >
          <div
            style={{
              position: "relative",
              maxHeight: "90vh",
              maxWidth: "90vw",
              width: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closePreview}
              style={{
                position: "absolute",
                top: -8,
                right: -8,
                zIndex: 10,
                width: 34,
                height: 34,
                borderRadius: "50%",
                background: "#1a1a1a",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
              }}
              aria-label="Tutup preview"
            >
              <X size={18} />
            </button>
            <img
              src={preview.feed.media[preview.index].media_url}
              alt={`preview-${preview.index}`}
              style={{
                maxHeight: "80vh",
                maxWidth: "100%",
                objectFit: "contain",
                borderRadius: "0.875rem",
              }}
            />
            {preview.feed.media.length > 1 && (
              <>
                <button
                  onClick={goPrev}
                  aria-label="Foto sebelumnya"
                  style={{
                    position: "absolute",
                    left: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: "rgba(0,0,0,0.6)",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                  }}
                >
                  <ChevronLeft size={22} />
                </button>
                <button
                  onClick={goNext}
                  aria-label="Foto berikutnya"
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: "rgba(0,0,0,0.6)",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                  }}
                >
                  <ChevronRight size={22} />
                </button>
                <div
                  style={{
                    marginTop: "1rem",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  {preview.feed.media.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setPreview({ ...preview, index: i })}
                      style={{
                        height: 6,
                        borderRadius: 999,
                        border: "none",
                        cursor: "pointer",
                        background:
                          i === preview.index
                            ? "#fff"
                            : "rgba(255,255,255,0.4)",
                        width: i === preview.index ? 24 : 8,
                        transition: "width 0.2s, background 0.2s",
                      }}
                    />
                  ))}
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: "0.75rem",
                      color: "rgba(255,255,255,0.6)",
                    }}
                  >
                    {preview.index + 1} / {preview.feed.media.length}
                  </span>
                </div>
              </>
            )}
            <div
              style={{
                marginTop: "0.75rem",
                fontSize: "0.75rem",
                color: "rgba(255,255,255,0.5)",
                textAlign: "center",
              }}
            >
              {preview.feed.user_name} ·{" "}
              {new Date(preview.feed.created_at).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
