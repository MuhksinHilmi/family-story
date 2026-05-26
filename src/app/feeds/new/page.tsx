"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import imageCompression from "browser-image-compression";
import {
  ArrowLeft,
  Image as ImageIcon,
  Tag,
  AtSign,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/context/auth-context";

interface MediaPreview {
  file: File;
  previewUrl: string;
  compressedFile?: File;
}

export default function CreateFeedPage() {
  const router = useRouter();

  const [caption, setCaption] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [currentTag, setCurrentTag] = useState("");

  const [scopeType, setScopeType] = useState<"extended" | "nuclear" | "custom">("extended");
  const [customViewers, setCustomViewers] = useState<any[]>([]);
  const [extendedContacts, setExtendedContacts] = useState<any[]>([]);

  const [mentionQuery, setMentionQuery] = useState("");
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [allowComment, setAllowComment] = useState(true);

  const [mediaList, setMediaList] = useState<MediaPreview[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  const { user } = useAuth();

  const captionRef = useRef<HTMLTextAreaElement | null>(null);
  const [captionMentionQuery, setCaptionMentionQuery] = useState("");
  const [showCaptionMentionDropdown, setShowCaptionMentionDropdown] = useState(false);
  const [mentionAnchorIndex, setMentionAnchorIndex] = useState<number | null>(null);
  const [captionMentionActive, setCaptionMentionActive] = useState<number>(0);

  useEffect(() => {
    if (scopeType === "custom") {
      const fetchContacts = async () => {
        try {
          const res = await apiFetch("/api/user/extended-contacts");
          if (res.ok) {
            const data = await res.json();
            setExtendedContacts(data.contacts || []);
          }
        } catch (err) {
          console.error("Failed to fetch extended contacts", err);
        }
      };
      fetchContacts();
    } else {
      setExtendedContacts([]);
      setCustomViewers([]);
    }
  }, [scopeType]);

  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const res = await apiFetch("/api/user/extended-contacts");
        if (res.ok) {
          const data = await res.json();
          setExtendedContacts(data.contacts || []);
        }
      } catch (err) {
        console.error("Failed to fetch extended contacts for mentions", err);
      }
    };
    if (step === 2) fetchContacts();
  }, [step]);

  const MAX_FILES = 6;
  const MAX_CAPTION = 500;

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "image/*": [".jpeg", ".jpg", ".png", ".webp"] },
    maxFiles: MAX_FILES - mediaList.length,
    multiple: true,
    onDrop: async (acceptedFiles) => {
      if (mediaList.length + acceptedFiles.length > MAX_FILES) {
        alert(`Maksimal ${MAX_FILES} foto per postingan`);
        return;
      }
      setIsCompressing(true);
      const newPreviews: MediaPreview[] = [];
      for (const file of acceptedFiles) {
        try {
          const compressedFile = await imageCompression(file, {
            maxSizeMB: 1.8,
            maxWidthOrHeight: 1920,
            useWebWorker: true,
          });
          const previewUrl = URL.createObjectURL(compressedFile);
          newPreviews.push({
            file: compressedFile,
            previewUrl,
            compressedFile,
          });
        } catch (err) {
          newPreviews.push({ file, previewUrl: URL.createObjectURL(file) });
        }
      }
      setMediaList((prev) => [...prev, ...newPreviews]);
      setIsCompressing(false);
    },
  });

  const removeMedia = (index: number) => {
    const item = mediaList[index];
    URL.revokeObjectURL(item.previewUrl);
    setMediaList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCaptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const el = e.target as HTMLTextAreaElement;
    const value = el.value.slice(0, MAX_CAPTION);
    setCaption(value);

    const cursor = el.selectionStart;
    const pre = value.slice(0, cursor);
    const m = pre.match(/@([^\s@]{0,30})$/);
    if (m) {
      setCaptionMentionQuery(m[1]);
      setShowCaptionMentionDropdown(true);
      setMentionAnchorIndex(cursor - m[1].length - 1);
      setCaptionMentionActive(0);
    } else {
      setCaptionMentionQuery("");
      setShowCaptionMentionDropdown(false);
      setMentionAnchorIndex(null);
    }
  };

  const addTag = () => {
    const trimmed = currentTag.trim();
    if (trimmed && !tags.includes(trimmed) && tags.length < 10) {
      setTags([...tags, trimmed]);
      setCurrentTag("");
    }
  };

  const removeTag = (tagToRemove: string) => setTags(tags.filter((t) => t !== tagToRemove));

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      addTag();
    }
  };

  const handleSubmit = async () => {
    if (mediaList.length === 0 && !caption.trim()) {
      alert("Minimal harus ada foto atau caption");
      return;
    }
    setIsSubmitting(true);
    try {
      const uploadedMedia: any[] = [];
      for (let i = 0; i < mediaList.length; i++) {
        const item = mediaList[i];
        const formData = new FormData();
        formData.append("file", item.compressedFile || item.file);

        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        const res = await fetch("/api/upload/feed-image", {
          method: "POST",
          body: formData,
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
            "X-Timestamp": Date.now().toString(),
          },
        });
        if (!res.ok) throw new Error("Gagal upload foto");
        const data = await res.json();
        uploadedMedia.push({
          media_url: data.url,
          media_type: "image",
          sort_order: i,
        });
      }

      const payload: any = {
        caption: caption.trim() || null,
        media: uploadedMedia,
        scope_type: scopeType,
        tags,
        allow_comment: allowComment,
      };

      if (scopeType === "custom" && customViewers.length > 0) {
        payload.custom_viewer_node_ids = customViewers.map((v) => v.id);
      }

      const res = await apiFetch("/api/feeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal membuat postingan");
      }
      alert("Postingan berhasil dibuat!");
      router.push("/feeds");
    } catch (error: any) {
      alert(error.message || "Terjadi kesalahan");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredContacts = extendedContacts.filter((p: any) => p.full_name.toLowerCase().includes(mentionQuery.toLowerCase()));
  const filteredContactsForCaption = extendedContacts
    .filter((p: any) => p.full_name.toLowerCase().includes(captionMentionQuery.toLowerCase()))
    .slice(0, 8);

  const selectCaptionMention = (person: any) => {
    if (mentionAnchorIndex == null) return;
    const before = caption.slice(0, mentionAnchorIndex);
    const cursorPos = captionRef.current?.selectionStart ?? (mentionAnchorIndex + 1 + captionMentionQuery.length);
    const after = caption.slice(cursorPos);
    const insert = `@${person.full_name} `;
    const newCaption = (before + insert + after).slice(0, MAX_CAPTION);
    setCaption(newCaption);
    setShowCaptionMentionDropdown(false);
    setCaptionMentionQuery("");
    setMentionAnchorIndex(null);
    setTimeout(() => {
      const el = captionRef.current;
      if (el) {
        const newPos = before.length + insert.length;
        el.focus();
        el.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  const onCaptionKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showCaptionMentionDropdown) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCaptionMentionActive((s) => Math.min(s + 1, Math.max(0, filteredContactsForCaption.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCaptionMentionActive((s) => Math.max(0, s - 1));
    } else if (e.key === "Enter") {
      if (filteredContactsForCaption.length > 0) {
        e.preventDefault();
        selectCaptionMention(filteredContactsForCaption[captionMentionActive]);
      }
    } else if (e.key === "Escape") {
      setShowCaptionMentionDropdown(false);
    }
  };

  return (
    <div className="overflow-y-auto h-full">
      <div className="mx-auto max-w-3xl px-4 lg:max-w-4xl">
        <div className="flex items-center gap-4 mb-6 pt-6">
          <button onClick={() => router.back()} className="text-[#6B5B45]"><ArrowLeft size={22} /></button>
          <h1 className="text-xl font-semibold text-[#3B2F1E]">Bagikan Momen</h1>
        </div>

        <div className="flex items-center mb-6 px-4">
          <div
            className={`rounded-full px-4 py-1 text-sm font-medium ${
              step === 1
                ? "bg-[#4A7C59] text-white"
                : "bg-[#FDFAF5] text-[#9C8B75] border border-[#D4C4A8]"
            }`}
          >
            1 · Pilih Cakupan
          </div>
          <div className="flex-1 h-px bg-[#D4C4A8] mx-2" />
          <div
            className={`rounded-full px-4 py-1 text-sm font-medium ${
              step === 2
                ? "bg-[#4A7C59] text-white"
                : "bg-[#FDFAF5] text-[#9C8B75] border border-[#D4C4A8]"
            }`}
          >
            2 · Tulis Cerita
          </div>
        </div>

        {step === 1 && (
          <div className="bg-white border border-[#D4C4A8] rounded-2xl p-6 space-y-6 mb-6 shadow-sm">
            <div>
              <div className="mb-3 text-sm font-medium text-[#6B5B45]">Pilih Cakupan Visibilitas</div>

              <div className="space-y-3">
                <button type="button" onClick={() => setScopeType("extended")} className={`w-full rounded-xl border p-4 text-left transition ${
                    scopeType === "extended"
                      ? "border-[#4A7C59] bg-[#F5F0E8]"
                      : "border-[#D4C4A8] hover:bg-[#FDFAF5]"
                  }`}>
                  <div className="font-medium text-[#3B2F1E]">Keluarga Besar</div>
                  <div className="text-sm text-[#6B5B45]">Semua anggota yang terhubung melalui extended family group.</div>
                </button>

                <button type="button" onClick={() => setScopeType("nuclear")} className={`w-full rounded-xl border p-4 text-left transition ${
                    scopeType === "nuclear"
                      ? "border-[#4A7C59] bg-[#F5F0E8]"
                      : "border-[#D4C4A8] hover:bg-[#FDFAF5]"
                  }`}>
                  <div className="font-medium text-[#3B2F1E]">Keluarga Inti</div>
                  <div className="text-sm text-[#6B5B45]">Hanya anggota keluarga inti aktifmu saat ini (berdasarkan snapshot ayah).</div>
                </button>

                <button type="button" onClick={() => setScopeType("custom")} className={`w-full rounded-xl border p-4 text-left transition ${
                    scopeType === "custom"
                      ? "border-[#4A7C59] bg-[#F5F0E8]"
                      : "border-[#D4C4A8] hover:bg-[#FDFAF5]"
                  }`}>
                  <div className="font-medium text-[#3B2F1E]">Pilih Manual</div>
                  <div className="text-sm text-[#6B5B45]">Pilih sendiri beberapa anggota dari keluarga besar.</div>
                </button>
              </div>
            </div>

            {scopeType === "custom" && (
              <div className="border-t border-[#D4C4A8] pt-4">
                <div className="mb-2 text-sm font-medium text-[#6B5B45]">Pilih anggota secara manual</div>

                <div className="relative">
                  <input
                    type="text"
                    value={mentionQuery}
                    onChange={(e) => {
                      setMentionQuery(e.target.value);
                      setShowMentionDropdown(true);
                    }}
                    onFocus={() => setShowMentionDropdown(true)}
                    placeholder="Ketik nama anggota keluarga..."
                    className="w-full rounded-xl border border-[#D4C4A8] bg-white px-4 py-2.5 text-sm focus:border-[#4A7C59] focus:outline-none"
                  />

                  {showMentionDropdown && mentionQuery.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full rounded-xl border border-[#D4C4A8] bg-white shadow-lg max-h-60 overflow-auto">
                      {filteredContacts.slice(0, 8).map((person: any, index: number) => (
                        <button key={index} type="button" onClick={() => {
                            if (!customViewers.some((v) => v.id === person.id)) {
                              setCustomViewers([...customViewers, person]);
                            }
                            setMentionQuery("");
                            setShowMentionDropdown(false);
                          }}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-[#F5F0E8]">
                          <Avatar className="h-8 w-8 flex-shrink-0">
                            {person.photo_url ? (
                              <AvatarImage src={person.photo_url} alt={person.full_name} />
                            ) : (
                              <AvatarFallback className="bg-[#EDE4D3] text-[#6B5B45] text-[12px] font-semibold">{person.full_name ? person.full_name[0].toUpperCase() : "?"}</AvatarFallback>
                            )}
                          </Avatar>
                          <span>{person.full_name}</span>
                        </button>
                      ))}
                      {filteredContacts.length === 0 && (
                        <div className="px-4 py-3 text-sm text-[#9C8B75]">Tidak ada yang cocok di extended family Anda</div>
                      )}
                    </div>
                  )}
                </div>

                {customViewers.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {customViewers.map((person, index) => (
                      <div key={index} className="flex items-center gap-2 rounded-full bg-[#EDE4D3] px-3 py-1 text-sm">
                        <Avatar className="w-6 h-6">
                          {person.photo_url ? <AvatarImage src={person.photo_url} alt={person.full_name} /> : <AvatarFallback className="bg-[#EDE4D3] text-[#6B5B45] text-[10px] font-semibold">{person.full_name ? person.full_name[0].toUpperCase() : "?"}</AvatarFallback>}
                        </Avatar>
                        <span>{person.full_name}</span>
                        <button type="button" onClick={() => setCustomViewers(customViewers.filter((_, i) => i !== index))} className="text-[#6B5B45] hover:text-red-600">×</button>
                      </div>
                    ))}
                  </div>
                )}

                <p className="mt-2 text-[11px] text-[#9C8B75]">Ketik nama untuk mencari anggota dari keluarga besar Anda.</p>
              </div>
            )}

            <button type="button" onClick={() => setStep(2)} disabled={scopeType === "custom" && customViewers.length === 0} className="w-full rounded-xl bg-[#4A7C59] text-white py-3 text-sm font-medium hover:bg-[#2E5239] transition disabled:opacity-40 disabled:cursor-not-allowed">Lanjut ke Tulis Cerita →</button>
          </div>
        )}

        {step === 2 && (
          <div className="bg-white border border-[#D4C4A8] rounded-2xl p-6 space-y-6 mb-6 shadow-sm">
            <div>
              <div className="relative">
                <textarea ref={captionRef} value={caption} onChange={handleCaptionChange} onKeyDown={onCaptionKeyDown} placeholder="Ceritakan momen ini..." className="w-full min-h-[120px] resize-y border border-[#D4C4A8] rounded-xl p-4 text-base focus:outline-none focus:border-[#4A7C59]" />

                {showCaptionMentionDropdown && (
                  <div className="absolute z-50 left-2 right-2 mt-1 rounded-xl border border-[#D4C4A8] bg-white shadow-lg max-h-56 overflow-auto">
                    {filteredContactsForCaption.length > 0 ? (
                      filteredContactsForCaption.map((person: any, i: number) => (
                        <button key={person.id} type="button" className={`w-full text-left px-3 py-2 hover:bg-[#F5F0E8] flex items-center gap-3 ${i === captionMentionActive ? 'bg-[#F5F0E8]' : ''}`} onClick={() => selectCaptionMention(person)}>
                          <Avatar className="h-8 w-8">
                            {person.photo_url ? (
                              <AvatarImage src={person.photo_url} alt={person.full_name} />
                            ) : (
                              <AvatarFallback className="bg-[#EDE4D3] text-[#6B5B45] text-[12px] font-semibold">{person.full_name ? person.full_name[0].toUpperCase() : "?"}</AvatarFallback>
                            )}
                          </Avatar>
                          <div className="text-sm">{person.full_name}</div>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-[#9C8B75]">Tidak ada yang cocok</div>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-1 text-right text-xs text-[#9C8B75]">{caption.length}/{MAX_CAPTION}</div>
            </div>

            <div>
              <div {...getRootProps()} className={`relative rounded-2xl border-2 border-dashed p-8 text-center transition ${isCompressing ? "border-[#D4C4A8] bg-[#F5F0E8] cursor-wait" : isDragActive ? "border-[#4A7C59] bg-[#F5F0E8] cursor-pointer" : "border-[#D4C4A8] cursor-pointer"}`}>
                <input {...getInputProps()} disabled={isCompressing} />

                {isCompressing ? (
                  <div className="flex flex-col items-center justify-center py-4">
                    <div className="animate-spin w-8 h-8 border-4 border-[#4A7C59] border-t-transparent rounded-full mb-3" />
                    <p className="font-medium text-[#3B2F1E]">Mengompresi gambar...</p>
                    <p className="text-xs text-[#9C8B75] mt-1">Mohon tunggu sebentar</p>
                  </div>
                ) : (
                  <>
                    <ImageIcon className="mx-auto mb-3 text-[#9C8B75]" size={32} />
                    <p className="font-medium text-[#3B2F1E]">Tarik foto ke sini atau klik untuk memilih</p>
                    <p className="mt-1 text-xs text-[#9C8B75]">Maksimal 6 foto • Max 2MB per foto</p>
                  </>
                )}
              </div>

              {mediaList.length > 0 && (
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {mediaList.map((item, index) => (
                    <div key={index} className="relative aspect-square overflow-hidden rounded-xl border border-[#D4C4A8]">
                      <img src={item.previewUrl} alt={`preview-${index}`} className="h-full w-full object-cover" />
                      <button onClick={() => removeMedia(index)} className="absolute right-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">Hapus</button>
                    </div>
                  ))}
                  {mediaList.length < MAX_FILES && (
                    <div {...getRootProps()} className={`flex aspect-square items-center justify-center rounded-xl border-2 border-dashed ${isCompressing ? "border-[#D4C4A8] bg-[#F5F0E8] cursor-wait opacity-60" : "border-[#D4C4A8] hover:bg-[#F5F0E8] cursor-pointer"}`}>
                      {isCompressing ? (
                        <div className="animate-spin w-5 h-5 border-2 border-[#4A7C59] border-t-transparent rounded-full" />
                      ) : (
                        <span className="text-[#9C8B75]">+ Tambah</span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2">
                <Tag size={16} className="text-[#9C8B75]" />
                <span className="text-sm font-medium">Tag</span>
              </div>
              <div className="mb-2 flex flex-wrap gap-2">
                {tags.map((tag, i) => (
                  <span key={i} className="flex items-center gap-1 rounded-full bg-[#EDE4D3] px-3 py-1 text-sm text-[#3B2F1E]">#{tag}
                    <button onClick={() => removeTag(tag)} className="text-xs">×</button>
                  </span>
                ))}
              </div>
              <input value={currentTag} onChange={(e) => setCurrentTag(e.target.value)} onKeyDown={handleTagKeyDown} placeholder="Ketik tag lalu tekan Enter" className="w-full rounded-lg border border-[#D4C4A8] px-3 py-2 text-sm" />
            </div>

            <hr className="border-[#D4C4A8] my-2" />

            <div className="flex items-center justify-between">
              <span>Izinkan komentar</span>
              <button type="button" onClick={() => setAllowComment(!allowComment)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${allowComment ? "bg-[#4A7C59]" : "bg-[#D4C4A8]"}`}>
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${allowComment ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>

            <hr className="border-[#D4C4A8] my-2" />

            <div className="rounded-xl bg-[#FDFAF5] border border-[#D4C4A8] p-4 space-y-2 text-sm">
              <span className="bg-[#EDE4D3] text-[#3B2F1E] rounded-full px-3 py-0.5 text-xs inline-block">{scopeType === "extended" && "Keluarga Besar"}{scopeType === "nuclear" && "Keluarga Inti"}{scopeType === "custom" && "Pilih Manual"}</span>
              {mediaList.length > 0 && (<p className="text-[#6B5B45]">{mediaList.length} foto dipilih</p>)}
              {caption && <p className="text-[#3B2F1E] line-clamp-2">{caption}</p>}
              {tags.length > 0 && tags.map((tag, i) => (<span key={i} className="bg-[#EDE4D3] text-[#3B2F1E] rounded-full px-2 py-0.5 text-xs mr-1">#{tag}</span>))}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <button onClick={() => setStep(1)} className="rounded-xl bg-[#D4C4A8] px-6 py-3 text-sm font-medium hover:bg-[#C4B39A] transition">← Kembali</button>
              <Button onClick={handleSubmit} disabled={isSubmitting} className="rounded-xl bg-[#4A7C59] px-8 text-white hover:bg-[#2E5239]">{isSubmitting ? "Memposting..." : "Bagikan Momen"}</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
