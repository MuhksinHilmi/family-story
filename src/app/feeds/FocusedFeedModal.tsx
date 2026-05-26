// Modal improvements: create a focused feed component with like/comment support
// File: src/app/feeds/FocusedFeedModal.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Heart, MessageCircle, X, Send, User } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { renderWithMentions } from '@/lib/mentions';
import { useRouter } from 'next/navigation';

export interface CommentItem {
  id: string;
  user_name: string;
  user_photo: string | null;
  content: string;
  created_at: string;
}

export interface FocusedFeedModalProps {
  feed: {
    id: string;
    user_name: string;
    user_photo: string | null;
    caption: string | null;
    created_at: string;
    has_liked: boolean;
    like_count: number;
    comment_count: number;
    media: Array<{ media_url: string; media_type: string; sort_order: number }>;
  };
  onClose: () => void;
  showMentionBanner?: boolean;
}

export default function FocusedFeedModal({ feed, onClose, showMentionBanner = false }: FocusedFeedModalProps) {
  const [hasLiked, setHasLiked] = useState<boolean>(!!feed.has_liked);
  const [likeCount, setLikeCount] = useState<number>(Number(feed.like_count) || 0);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loadingComments, setLoadingComments] = useState<boolean>(true);
  const [postingComment, setPostingComment] = useState<boolean>(false);
  const [commentText, setCommentText] = useState<string>('');
  const [likeAnimating, setLikeAnimating] = useState(false);

  const [extendedContacts, setExtendedContacts] = useState<any[]>([]);
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionActive, setMentionActive] = useState(0);
  const [mentionAnchorIndex, setMentionAnchorIndex] = useState<number | null>(null);
  const commentTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const filteredMentions = extendedContacts
    .filter((p: any) => p.full_name.toLowerCase().includes(mentionQuery.toLowerCase()))
    .slice(0, 8);

  const selectMention = (person: any) => {
    if (mentionAnchorIndex == null) return;
    const text = commentText;
    const before = text.slice(0, mentionAnchorIndex);
    const afterStart = mentionAnchorIndex + 1 + (mentionQuery ? mentionQuery.length : 0);
    const after = text.slice(afterStart);
    const insert = `@${person.full_name} `;
    const newText = before + insert + after;
    setCommentText(newText);
    setShowMentionDropdown(false);
    setMentionQuery('');

    // set caret after inserted text
    setTimeout(() => {
      const el = commentTextareaRef.current;
      if (el) {
        const pos = before.length + insert.length;
        el.focus();
        el.setSelectionRange(pos, pos);
      }
    }, 0);
  };

  const commentsRef = useRef<HTMLDivElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const fetchComments = async () => {
      setLoadingComments(true);
      try {
        const res = await apiFetch(`/api/feeds/${feed.id}/comments`);
        if (res.ok) {
          const data = await res.json();
          // normalize: API returns { comment: string }
          const normalized: CommentItem[] = data.map((c: any) => ({
            id: String(c.id),
            user_name: c.user_name,
            user_photo: c.user_photo || null,
            content: c.comment ?? c.content ?? '',
            created_at: c.created_at,
          }));
          setComments(normalized.reverse()); // newest first
        }
      } catch (e) {
        console.warn('Failed to load comments', e);
      } finally {
        setLoadingComments(false);
      }
    };

    fetchComments();
  }, [feed.id]);

  // fetch extended contacts for mention autocomplete when modal opens
  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const res = await apiFetch('/api/user/extended-contacts');
        if (res.ok) {
          const data = await res.json();
          setExtendedContacts(data.contacts || []);
        }
      } catch (e) {
        console.warn('Failed to fetch extended contacts for mentions', e);
      }
    };
    fetchContacts();
  }, [feed.id]);

  // Lock body scroll when modal open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Escape key to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        // submit comment
        handleSubmitComment();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [commentText]);

  const handleToggleLike = async () => {
    // optimistic
    setHasLiked((s) => !s);
    setLikeCount((c) => (hasLiked ? c - 1 : c + 1));
    setLikeAnimating(true);
    setTimeout(() => setLikeAnimating(false), 200);

    try {
      const method = hasLiked ? 'DELETE' : 'POST';
      const res = await apiFetch(`/api/feeds/${feed.id}/like`, { method });
      if (!res.ok) {
        // revert if failed
        setHasLiked((s) => !s);
        setLikeCount((c) => (hasLiked ? c + 1 : c - 1));
      }
    } catch (e) {
      setHasLiked((s) => !s);
      setLikeCount((c) => (hasLiked ? c + 1 : c - 1));
    }
  };

  const handleSubmitComment = async () => {
    const text = commentText.trim();
    if (!text) return;
    setPostingComment(true);
    try {
      const res = await apiFetch(`/api/feeds/${feed.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: text }),
      });
      if (res.ok) {
        const c = await res.json();
        const normalized: CommentItem = {
          id: String(c.id),
          user_name: c.user_name,
          user_photo: c.user_photo || null,
          content: c.comment ?? c.content ?? text,
          created_at: c.created_at,
        };
        setComments((prev) => [normalized, ...prev]);
        setCommentText('');
        // scroll to top of comments
        setTimeout(() => {
          if (commentsRef.current) commentsRef.current.scrollTop = 0;
        }, 50);
      }
    } catch (e) {
      console.warn('Failed to post comment', e);
    } finally {
      setPostingComment(false);
    }
  };

  // media lightbox
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const openLightbox = (idx: number) => setLightboxIndex(idx);
  const closeLightbox = () => setLightboxIndex(null);

  const router = useRouter();

  const handleClickMention = (name: string) => {
    // try to resolve node by name via search route or open tree search — simple approach: open Tree page and trigger search query param
    const q = encodeURIComponent(name);
    router.push(`/tree?focus_name=${q}`);
    onClose();
  };

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="max-w-3xl w-full max-h-[90vh] rounded-2xl bg-[#F5F0E8] overflow-hidden flex flex-col md:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        {/* LEFT PANEL */}
        <div className="md:w-1/2 w-full bg-[#FFFFFF] border-r md:border-r border-[#D4C4A8] p-4 overflow-auto">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-[#EDE4D3] flex items-center justify-center">
                {feed.user_photo ? (
                  <img src={feed.user_photo} alt={feed.user_name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[#6B5B45] font-semibold">{feed.user_name ? feed.user_name[0].toUpperCase() : '?'}</span>
                )}
              </div>
              <div>
                <div className="text-sm font-semibold text-[#3B2F1E]">{feed.user_name}</div>
                <div className="text-xs text-[#9C8B75]">{new Date(feed.created_at).toLocaleString()}</div>
              </div>
            </div>
            <button onClick={onClose} className="text-[#6B5B45] p-2"><X /></button>
          </div>

          {showMentionBanner && (
            <div className="mt-3 p-2 rounded-md bg-yellow-50 border border-[#D4C4A8] text-sm text-[#3B2F1E]">
              Kamu disebut dalam postingan ini 👋
            </div>
          )}

          {/* Media area */}
          <div className="mt-3">
            {feed.media.length === 1 && (
              <button onClick={() => openLightbox(0)} className="w-full block">
                <img src={feed.media[0].media_url} alt="media" className="w-full max-h-72 object-cover rounded-xl" />
              </button>
            )}

            {feed.media.length === 2 && (
              <div className="grid grid-cols-2 gap-1">
                {feed.media.map((m, i) => (
                  <button key={i} onClick={() => openLightbox(i)} className="aspect-square rounded overflow-hidden">
                    <img src={m.media_url} alt={`media-${i}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {feed.media.length >= 3 && (
              <div className="grid grid-cols-2 gap-1">
                <button onClick={() => openLightbox(0)} className="col-span-2 h-56 rounded overflow-hidden">
                  <img src={feed.media[0].media_url} alt="media-main" className="w-full h-full object-cover" />
                </button>
                {feed.media.slice(1, 5).map((m, i) => (
                  <button key={i} onClick={() => openLightbox(i+1)} className="aspect-square rounded overflow-hidden">
                    <img src={m.media_url} alt={`media-${i+1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Caption */}
          {feed.caption && (
              <div className="mt-3 text-sm text-[#3B2F1E] whitespace-pre-line">
              {renderWithMentions(feed.caption, handleClickMention)}
            </div>
          )}

          {/* Comment input with mention autocomplete */}


          {/* Action bar */}
          <div className="mt-4 border-t border-[#D4C4A8] pt-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <button
                onClick={handleToggleLike}
                className={`flex items-center gap-2 ${hasLiked ? 'text-pink-500' : 'text-[#6B5B45]'}`}
              >
                <Heart className={`${likeAnimating ? 'scale-125 transition-transform duration-200' : ''} ${hasLiked ? 'fill-current' : ''}`} />
                <span className="text-sm text-[#3B2F1E]">{likeCount}</span>
              </button>

              <div className="flex items-center gap-2 text-[#6B5B45]">
                <MessageCircle />
                <span className="text-sm text-[#3B2F1E]">{comments.length || feed.comment_count}</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL (comments) */}
        <div className="md:w-1/2 w-full bg-[#F5F0E8] p-0 md:p-4 flex flex-col">
          <div className="px-4 py-3 border-b border-[#D4C4A8] bg-[#F5F0E8] flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#3B2F1E]"><MessageCircle /> Komentar ({comments.length || feed.comment_count})</div>
            <div className="text-xs text-[#9C8B75]">{/* optional actions */}</div>
          </div>

          <div ref={commentsRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#F5F0E8]">
            {loadingComments ? (
              <div className="w-full text-center py-8 text-[#9C8B75]">Memuat komentar...</div>
            ) : comments.length === 0 ? (
              <div className="w-full text-center py-8 text-[#9C8B75]">
                Belum ada komentar
              </div>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-[#EDE4D3] flex items-center justify-center">{c.user_photo ? <img src={c.user_photo} className="w-full h-full object-cover" /> : <span className="text-[#6B5B45] text-xs font-semibold">{c.user_name ? c.user_name[0].toUpperCase() : '?'}</span>}</div>
                  <div className="flex-1">
                    <div className="bg-white border border-[#E8DFD0] rounded-xl px-3 py-2 shadow-sm">
                      <div className="text-xs font-semibold text-[#3B2F1E]">{c.user_name}</div>
                      <div className="text-sm text-[#4B3B2A] mt-1">{c.content}</div>
                    </div>
                    <div className="text-[10px] text-[#B0A090] mt-1">{new Date(c.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex-shrink-0 border-t border-[#D4C4A8] px-4 py-3 bg-[#F5F0E8]">
          <div className="flex gap-2 items-end">
              <div className="flex-1 relative">
                <textarea
                  ref={commentTextareaRef}
                  value={commentText}
                  onChange={(e) => {
                    const el = e.target as HTMLTextAreaElement;
                    const val = el.value;
                    setCommentText(val);

                    // detect mention token before caret
                    const cursor = el.selectionStart;
                    const pre = val.slice(0, cursor);
                    const m = pre.match(/@([\w\.-]*)$/);
                    if (m) {
                      setMentionQuery(m[1]);
                      setShowMentionDropdown(true);
                      setMentionAnchorIndex(cursor - m[1].length - 1);
                      setMentionActive(0);
                    } else {
                      setMentionQuery('');
                      setShowMentionDropdown(false);
                      setMentionAnchorIndex(null);
                    }
                  }}
                  rows={1}
                  placeholder="Tulis komentar..."
                  className="w-full resize-none rounded-xl border border-[#D4C4A8] px-3 py-2 text-sm focus:outline-none"
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                      handleSubmitComment();
                    }
                    if (showMentionDropdown) {
                      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionActive((s) => Math.min(s+1, Math.max(0, filteredMentions.length-1))); }
                      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionActive((s) => Math.max(0, s-1)); }
                      if (e.key === 'Enter') { e.preventDefault(); if (filteredMentions.length>0) selectMention(filteredMentions[mentionActive]); }
                      if (e.key === 'Escape') { setShowMentionDropdown(false); }
                    }
                  }}
                />

                {showMentionDropdown && mentionQuery.length >= 0 && (
                  <div className="absolute left-0 bottom-12 z-50 w-full rounded-xl border border-[#D4C4A8] bg-white shadow-lg max-h-48 overflow-auto">
                    {filteredMentions.length > 0 ? filteredMentions.map((p, i) => (
                      <button key={p.id} type="button" onClick={() => selectMention(p)} className={`flex items-center gap-3 px-3 py-2 text-left text-sm ${i === mentionActive ? 'bg-[#F5F0E8]' : ''}`}>
                        <div className="h-8 w-8 rounded-full bg-[#EDE4D3] flex-shrink-0 overflow-hidden flex items-center justify-center">{p.photo_url ? <img src={p.photo_url} className="w-full h-full object-cover"/> : <span className="text-[#6B5B45] text-xs font-semibold">{p.full_name[0].toUpperCase()}</span>}</div>
                        <div>{p.full_name}</div>
                      </button>
                    )) : (<div className="px-3 py-2 text-sm text-[#9C8B75]">Tidak ada yang cocok</div>)}
                  </div>
                )}
              </div>

              <button
                onClick={handleSubmitComment}
                disabled={postingComment || !commentText.trim()}
                className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-[#4A7C59] text-white disabled:opacity-50 self-end"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Lightbox */}
        {lightboxIndex !== null && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/90" onClick={closeLightbox}>
            <img src={feed.media[lightboxIndex].media_url} className="max-h-[90vh] max-w-[90vw] object-contain" />
          </div>
        )}
      </div>
    </div>
  );
}
