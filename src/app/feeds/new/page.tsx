"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import imageCompression from "browser-image-compression";
import {
  ArrowLeft,
  Image as ImageIcon,
  Tag,
  Smile,
  AtSign,
  ChevronDown,
  Check,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
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
  const [scopeType, setScopeType] = useState<"general" | "small">("general");
  const [smallFamilies, setSmallFamilies] = useState<any[]>([]);
  const [selectedSmallFamilyUuid, setSelectedSmallFamilyUuid] =
    useState<string>("");
  const [shareToAll, setShareToAll] = useState(true);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [smallFamilyMembers, setSmallFamilyMembers] = useState<any[]>([]);

  // Mention states
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionablePeople, setMentionablePeople] = useState<any[]>([]);
  const [allowComment, setAllowComment] = useState(true);
  const [schedule, setSchedule] = useState(false);

  const [mediaList, setMediaList] = useState<MediaPreview[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Families
  const [families, setFamilies] = useState<any[]>([]);
  const [selectedFamilyUuid, setSelectedFamilyUuid] = useState<string>("");
  const [loadingFamilies, setLoadingFamilies] = useState(true);

  // UI-only state
  const [isFamilyOpen, setIsFamilyOpen] = useState(false);

  // 2-step wizard
  const [step, setStep] = useState<1 | 2>(1);

  const { user } = useAuth();

  // Fetch user's families on mount
  useEffect(() => {
    const fetchFamilies = async () => {
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
        console.error("Failed to fetch families", err);
      } finally {
        setLoadingFamilies(false);
      }
    };
    fetchFamilies();
  }, []);

  // Load small families
  useEffect(() => {
    if (scopeType !== "small" || !selectedFamilyUuid) {
      setSmallFamilies([]);
      setSelectedSmallFamilyUuid("");
      return;
    }
    const loadSmallFamilies = async () => {
      try {
        const res = await apiFetch(`/api/chat/rooms`);
        if (res.ok) {
          const rooms = await res.json();
          const userSmallFamilies = rooms.filter(
            (r: any) =>
              r.scope_type === "small" && r.family_uuid === selectedFamilyUuid,
          );
          setSmallFamilies(userSmallFamilies);
          if (userSmallFamilies.length > 0) {
            setSelectedSmallFamilyUuid(
              userSmallFamilies[0].small_family_uuid || userSmallFamilies[0].id,
            );
          }
        }
      } catch (err) {
        console.error("Failed to load small families", err);
      }
    };
    loadSmallFamilies();
  }, [scopeType, selectedFamilyUuid]);

  // Fetch members for granular sharing
  useEffect(() => {
    if (scopeType !== "small" || !selectedSmallFamilyUuid || shareToAll) {
      setSmallFamilyMembers([]);
      return;
    }
    const fetchMembers = async () => {
      try {
        const res = await apiFetch(
          `/api/small-families/${selectedSmallFamilyUuid}/members`,
        );
        if (res.ok) {
          const data = await res.json();
          setSmallFamilyMembers(data.members || []);
        }
      } catch (err) {
        console.error("Failed to load small family members", err);
      }
    };
    fetchMembers();
  }, [scopeType, selectedSmallFamilyUuid, shareToAll]);

  // Load mentionable people
  useEffect(() => {
    if (!selectedFamilyUuid) {
      setMentionablePeople([]);
      return;
    }
    const loadMentionable = async () => {
      try {
        const res = await apiFetch(
          `/api/families/${selectedFamilyUuid}/members`,
        );
        if (res.ok) {
          const data = await res.json();
          setMentionablePeople(data.members || []);
        }
      } catch (err) {
        console.error("Failed to load mentionable people", err);
      }
    };
    loadMentionable();
  }, [selectedFamilyUuid]);

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
    },
  });

  // Guard
  if (!loadingFamilies && families.length === 0) {
    return (
      <div className="overflow-y-auto h-full">
        <div className="max-w-2xl mx-auto p-6 text-center">
          <p className="text-[#9C8B75]">
            Anda belum tergabung dalam keluarga manapun.
          </p>
          <p className="text-sm mt-2">
            Silakan terima undangan atau buat keluarga baru.
          </p>
        </div>
      </div>
    );
  }

  const removeMedia = (index: number) => {
    const item = mediaList[index];
    URL.revokeObjectURL(item.previewUrl);
    setMediaList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCaptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value.slice(0, MAX_CAPTION);
    setCaption(value);
    const cursorPos = e.target.selectionStart || value.length;
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAt = textBeforeCursor.lastIndexOf("@");
    if (lastAt !== -1) {
      const query = textBeforeCursor.substring(lastAt + 1);
      if (!query.includes(" ") && query.length >= 0) {
        setMentionQuery(query);
        setShowMentionDropdown(true);
      } else {
        setShowMentionDropdown(false);
      }
    } else {
      setShowMentionDropdown(false);
    }
  };

  const insertMention = (person: any) => {
    const mentionText = `@${person.full_name} `;
    const cursorPos =
      (document.activeElement as HTMLTextAreaElement)?.selectionStart ||
      caption.length;
    const lastAt = caption.lastIndexOf("@", cursorPos);
    if (lastAt !== -1) {
      const before = caption.substring(0, lastAt);
      const after = caption.substring(cursorPos);
      const newCaption = before + mentionText + after;
      setCaption(newCaption);
      setTimeout(() => {
        const textarea = document.querySelector(
          "textarea",
        ) as HTMLTextAreaElement;
        if (textarea) {
          const newPos = lastAt + mentionText.length;
          textarea.focus();
          textarea.setSelectionRange(newPos, newPos);
        }
      }, 0);
    }
    setShowMentionDropdown(false);
    setMentionQuery("");
  };

  const addTag = () => {
    const trimmed = currentTag.trim();
    if (trimmed && !tags.includes(trimmed) && tags.length < 10) {
      setTags([...tags, trimmed]);
      setCurrentTag("");
    }
  };

  const removeTag = (tagToRemove: string) =>
    setTags(tags.filter((t) => t !== tagToRemove));

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      addTag();
    }
  };

  const getInitials = (name: string) =>
    !name
      ? "??"
      : name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .slice(0, 2)
          .toUpperCase();

  const handleSubmit = async () => {
    if (mediaList.length === 0 && !caption.trim()) {
      alert("Minimal harus ada foto atau caption");
      return;
    }
    if (!selectedFamilyUuid) {
      alert("Silakan pilih keluarga terlebih dahulu");
      return;
    }
    if (scopeType === "small" && !selectedSmallFamilyUuid) {
      alert("Silakan pilih keluarga inti");
      return;
    }
    setIsSubmitting(true);
    try {
      const uploadedMedia: any[] = [];
      for (let i = 0; i < mediaList.length; i++) {
        const item = mediaList[i];
        const formData = new FormData();
        formData.append("file", item.compressedFile || item.file);
        formData.append("family_uuid", selectedFamilyUuid);
        const token =
          typeof window !== "undefined" ? localStorage.getItem("token") : null;
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
        family_uuid: selectedFamilyUuid,
        caption: caption.trim() || null,
        media: uploadedMedia,
        scope_type: scopeType,
        tags,
        allow_comment: allowComment,
      };
      if (scopeType === "small" && selectedSmallFamilyUuid) {
        payload.small_family_uuid = selectedSmallFamilyUuid;
        payload.recipient_user_ids = shareToAll ? null : selectedRecipients;
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

  return (
    <div className="overflow-y-auto h-full">
      <div className="mx-auto max-w-3xl px-4 lg:max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6 pt-6">
          <button onClick={() => router.back()} className="text-[#6B5B45]">
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-xl font-semibold text-[#3B2F1E]">
            Bagikan Momen
          </h1>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center mb-6 px-4">
          <div
            className={`rounded-full px-4 py-1 text-sm font-medium ${step === 1 ? "bg-[#4A7C59] text-white" : "bg-[#FDFAF5] text-[#9C8B75] border border-[#D4C4A8]"}`}
          >
            1 · Pilih Cakupan
          </div>
          <div className="flex-1 h-px bg-[#D4C4A8] mx-2" />
          <div
            className={`rounded-full px-4 py-1 text-sm font-medium ${step === 2 ? "bg-[#4A7C59] text-white" : "bg-[#FDFAF5] text-[#9C8B75] border border-[#D4C4A8]"}`}
          >
            2 · Tulis Cerita
          </div>
        </div>

        {/* STEP 1 - Pilih Cakupan */}
        {step === 1 && (
          <div className="bg-white border border-[#D4C4A8] rounded-2xl p-6 space-y-6 mb-6 shadow-sm">
            {/* Top row: Avatar + Scope Pills */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-[#EDE4D3] overflow-hidden flex-shrink-0">
                  {user?.photo_url && (
                    <img
                      src={user.photo_url}
                      alt="avatar"
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-[#3B2F1E] truncate">
                    {user?.full_name || "Anda"}
                  </p>
                  {selectedFamilyUuid && families.length > 0 && (
                    <p className="text-xs text-[#9C8B75] truncate">
                      {families.find((f) => f.uuid === selectedFamilyUuid)
                        ?.name || "Keluarga"}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                {families.length > 1 && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsFamilyOpen(!isFamilyOpen)}
                      className="flex items-center gap-2 border border-[#D4C4A8] rounded-xl bg-[#FDFAF5] px-3 py-1.5 text-sm hover:bg-[#F5F0E8] transition"
                    >
                      <span className="max-w-[130px] truncate">
                        {families.find((f) => f.uuid === selectedFamilyUuid)
                          ?.name || "Pilih Keluarga"}
                      </span>
                      <ChevronDown
                        size={16}
                        className={`transition-transform ${isFamilyOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                    {isFamilyOpen && (
                      <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-[#D4C4A8] bg-white shadow-lg z-50 py-1">
                        {families.map((fam) => (
                          <button
                            key={fam.uuid}
                            onClick={() => {
                              setSelectedFamilyUuid(fam.uuid);
                              setIsFamilyOpen(false);
                            }}
                            className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-[#F5F0E8] ${selectedFamilyUuid === fam.uuid ? "bg-[#F5F0E8]" : ""}`}
                          >
                            <div
                              className={`h-2 w-2 rounded-full ${selectedFamilyUuid === fam.uuid ? "bg-[#4A7C59]" : "bg-[#D4C4A8]"}`}
                            />
                            <span>{fam.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {/* Scope Pills */}
                <div className="inline-flex rounded-2xl border border-[#D4C4A8] bg-[#FDFAF5] p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setScopeType("general");
                      setSelectedSmallFamilyUuid("");
                      setShareToAll(true);
                      setSelectedRecipients([]);
                    }}
                    className={`rounded-xl px-5 py-1.5 text-sm font-medium transition-all ${scopeType === "general" ? "bg-[#4A7C59] text-white shadow-sm" : "text-[#6B5B45] hover:bg-[#EDE4D3]"}`}
                  >
                    Keluarga Besar
                  </button>
                  <button
                    type="button"
                    onClick={() => setScopeType("small")}
                    className={`rounded-xl px-5 py-1.5 text-sm font-medium transition-all ${scopeType === "small" ? "bg-[#4A7C59] text-white shadow-sm" : "text-[#6B5B45] hover:bg-[#EDE4D3]"}`}
                  >
                    Keluarga Inti
                  </button>
                </div>
              </div>
            </div>

            {/* Sub-panel Keluarga Inti */}
            <div
              className={`overflow-hidden transition-all duration-300 ease-in-out ${scopeType === "small" ? "max-h-[800px] opacity-100 pt-2" : "max-h-0 opacity-0"}`}
            >
              {scopeType === "small" && (
                <div className="space-y-4 border-t border-[#D4C4A8] pt-4">
                  <div>
                    <div className="mb-2 text-xs font-medium text-[#6B5B45]">
                      Pilih Keluarga Inti
                    </div>
                    <div className="space-y-1.5">
                      {smallFamilies.map((sf: any) => {
                        const val = sf.small_family_uuid || sf.id;
                        const isSel = selectedSmallFamilyUuid === val;
                        return (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setSelectedSmallFamilyUuid(val)}
                            className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${isSel ? "border-[#4A7C59] bg-[#F5F0E8]" : "border-[#D4C4A8] hover:bg-[#FDFAF5]"}`}
                          >
                            <span className="font-medium text-[#3B2F1E]">
                              {sf.name}
                            </span>
                            {isSel && (
                              <Check size={18} className="text-[#4A7C59]" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {selectedSmallFamilyUuid && (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-[#3B2F1E]">
                          Bagikan ke semua anggota
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const newVal = !shareToAll;
                            setShareToAll(newVal);
                            if (newVal) setSelectedRecipients([]);
                          }}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${shareToAll ? "bg-[#4A7C59]" : "bg-[#D4C4A8]"}`}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${shareToAll ? "translate-x-5" : "translate-x-0.5"}`}
                          />
                        </button>
                      </div>

                      {!shareToAll && smallFamilyMembers.length > 0 && (
                        <div className="max-h-48 space-y-1 overflow-auto rounded-xl border border-[#D4C4A8] bg-[#FDFAF5] p-2">
                          {smallFamilyMembers.map((member: any) => {
                            const isChecked = selectedRecipients.includes(
                              member.uuid,
                            );
                            return (
                              <button
                                key={member.uuid}
                                type="button"
                                onClick={() => {
                                  if (isChecked) {
                                    setSelectedRecipients(
                                      selectedRecipients.filter(
                                        (id) => id !== member.uuid,
                                      ),
                                    );
                                  } else {
                                    setSelectedRecipients([
                                      ...selectedRecipients,
                                      member.uuid,
                                    ]);
                                  }
                                }}
                                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-white transition"
                              >
                                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#EDE4D3] text-xs font-medium text-[#6B5B45]">
                                  {getInitials(member.full_name || "")}
                                </div>
                                <span className="flex-1 truncate text-sm text-[#3B2F1E]">
                                  {member.full_name}
                                </span>
                                <div
                                  className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border transition ${isChecked ? "border-[#4A7C59] bg-[#4A7C59]" : "border-[#D4C4A8]"}`}
                                >
                                  {isChecked && (
                                    <Check size={13} className="text-white" />
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {!shareToAll && smallFamilyMembers.length === 0 && (
                        <p className="ml-1 text-[10px] text-[#9C8B75]">
                          Memuat anggota keluarga inti...
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Lanjut Button */}
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={scopeType === "small" && !selectedSmallFamilyUuid}
              className="w-full rounded-xl bg-[#4A7C59] text-white py-3 text-sm font-medium hover:bg-[#2E5239] transition disabled:opacity-40 disabled:cursor-not-allowed mt-2"
            >
              Lanjut ke Tulis Cerita →
            </button>
          </div>
        )}

        {/* STEP 2 - Tulis Cerita */}
        {step === 2 && (
          <div className="bg-white border border-[#D4C4A8] rounded-2xl p-6 space-y-6 mb-6 shadow-sm">
            {/* Caption + Mention Dropdown */}
            <div className="relative">
              <textarea
                value={caption}
                onChange={handleCaptionChange}
                placeholder="Ceritakan momen ini..."
                className="w-full min-h-[120px] resize-y border border-[#D4C4A8] rounded-xl p-4 text-base focus:outline-none focus:border-[#4A7C59]"
              />
              <div className="mt-1 text-right text-xs text-[#9C8B75]">
                {caption.length}/{MAX_CAPTION}
              </div>
              {showMentionDropdown && mentionablePeople.length > 0 && (
                <div className="absolute z-50 mt-1 w-64 max-h-48 overflow-auto rounded-xl border border-[#D4C4A8] bg-white shadow-lg">
                  {mentionablePeople
                    .filter((p: any) =>
                      p.full_name
                        .toLowerCase()
                        .includes(mentionQuery.toLowerCase()),
                    )
                    .slice(0, 6)
                    .map((person: any, idx: number) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => insertMention(person)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[#F5F0E8]"
                      >
                        <div className="h-6 w-6 flex-shrink-0 rounded-full bg-[#EDE4D3]" />
                        <span>{person.full_name}</span>
                      </button>
                    ))}
                  {mentionablePeople.filter((p: any) =>
                    p.full_name
                      .toLowerCase()
                      .includes(mentionQuery.toLowerCase()),
                  ).length === 0 && (
                    <div className="px-3 py-2 text-sm text-[#9C8B75]">
                      Tidak ada yang cocok
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Upload + Preview */}
            <div>
              <div
                {...getRootProps()}
                className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition ${isDragActive ? "border-[#4A7C59] bg-[#F5F0E8]" : "border-[#D4C4A8]"}`}
              >
                <input {...getInputProps()} />
                <ImageIcon className="mx-auto mb-3 text-[#9C8B75]" size={32} />
                <p className="font-medium text-[#3B2F1E]">
                  Tarik foto ke sini atau klik untuk memilih
                </p>
                <p className="mt-1 text-xs text-[#9C8B75]">
                  Maksimal 6 foto • Max 2MB per foto
                </p>
              </div>
              {mediaList.length > 0 && (
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {mediaList.map((item, index) => (
                    <div
                      key={index}
                      className="relative aspect-square overflow-hidden rounded-xl border border-[#D4C4A8]"
                    >
                      <img
                        src={item.previewUrl}
                        alt={`preview-${index}`}
                        className="h-full w-full object-cover"
                      />
                      <button
                        onClick={() => removeMedia(index)}
                        className="absolute right-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white"
                      >
                        Hapus
                      </button>
                    </div>
                  ))}
                  {mediaList.length < MAX_FILES && (
                    <div
                      {...getRootProps()}
                      className="flex aspect-square cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-[#D4C4A8] hover:bg-[#F5F0E8]"
                    >
                      <span className="text-[#9C8B75]">+ Tambah</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Tags */}
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Tag size={16} className="text-[#9C8B75]" />
                <span className="text-sm font-medium">Tag</span>
              </div>
              <div className="mb-2 flex flex-wrap gap-2">
                {tags.map((tag, i) => (
                  <span
                    key={i}
                    className="flex items-center gap-1 rounded-full bg-[#EDE4D3] px-3 py-1 text-sm text-[#3B2F1E]"
                  >
                    #{tag}
                    <button onClick={() => removeTag(tag)} className="text-xs">
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <input
                value={currentTag}
                onChange={(e) => setCurrentTag(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="Ketik tag lalu tekan Enter"
                className="w-full rounded-lg border border-[#D4C4A8] px-3 py-2 text-sm"
              />
            </div>

            <hr className="border-[#D4C4A8] my-2" />

            {/* Toggles */}
            <div className="flex items-center justify-between">
              <span>Izinkan komentar</span>
              <button
                type="button"
                onClick={() => setAllowComment(!allowComment)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${allowComment ? "bg-[#4A7C59]" : "bg-[#D4C4A8]"}`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${allowComment ? "translate-x-5" : "translate-x-0.5"}`}
                />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span>Jadwalkan postingan</span>
              <button
                type="button"
                onClick={() => setSchedule(!schedule)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${schedule ? "bg-[#4A7C59]" : "bg-[#D4C4A8]"}`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${schedule ? "translate-x-5" : "translate-x-0.5"}`}
                />
              </button>
            </div>

            <hr className="border-[#D4C4A8] my-2" />

            {/* Pratinjau ringkas */}
            <div className="rounded-xl bg-[#FDFAF5] border border-[#D4C4A8] p-4 space-y-2 text-sm">
              <span className="bg-[#EDE4D3] text-[#3B2F1E] rounded-full px-3 py-0.5 text-xs inline-block">
                {scopeType === "general"
                  ? "Keluarga Besar"
                  : `Keluarga Inti · ${smallFamilies.find((sf: any) => (sf.small_family_uuid || sf.id) === selectedSmallFamilyUuid)?.name || ""}`}
              </span>
              {mediaList.length > 0 && (
                <p className="text-[#6B5B45]">
                  {mediaList.length} foto dipilih
                </p>
              )}
              {caption && (
                <p className="text-[#3B2F1E] line-clamp-2">{caption}</p>
              )}
              {tags.length > 0 &&
                tags.map((tag, i) => (
                  <span
                    key={i}
                    className="bg-[#EDE4D3] text-[#3B2F1E] rounded-full px-2 py-0.5 text-xs mr-1"
                  >
                    #{tag}
                  </span>
                ))}
            </div>

            {/* Step 2 Action Row */}
            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={() => setStep(1)}
                className="text-sm text-[#6B5B45] hover:text-[#3B2F1E] transition flex items-center gap-1"
              >
                ← Kembali
              </button>
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !selectedFamilyUuid}
                  className="rounded-xl bg-[#4A7C59] px-8 text-white hover:bg-[#2E5239]"
                >
                  {isSubmitting ? "Memposting..." : "Bagikan Momen"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
