"use client";

import { useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import {
  Upload,
  FileText,
  Image as ImageIcon,
  Music,
  FileSpreadsheet,
  Presentation,
  File,
  Download,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/context/auth-context";

interface DocumentItem {
  id: string;
  family_uuid: string;
  uploaded_by: number;
  file_name: string;
  original_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  visibility_scope: string;
  description?: string;
  created_at: string;
  public_url: string;
  uploader_name?: string;
}

interface Family {
  uuid: string;
  name: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_STORAGE = 500 * 1024 * 1024; // 500MB

const ALLOWED_TYPES = [
  "image/",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "audio/",
];

function getFileIcon(mime: string) {
  if (mime.startsWith("image/"))
    return <ImageIcon className="h-8 w-8 text-[#C4922A]" />;
  if (mime.startsWith("audio/"))
    return <Music className="h-8 w-8 text-[#4A7C59]" />;
  if (mime.includes("pdf"))
    return <FileText className="h-8 w-8 text-red-500" />;
  if (mime.includes("spreadsheet") || mime.includes("excel"))
    return <FileSpreadsheet className="h-8 w-8 text-green-600" />;
  if (mime.includes("presentation") || mime.includes("powerpoint"))
    return <Presentation className="h-8 w-8 text-orange-500" />;
  if (mime.includes("word"))
    return <FileText className="h-8 w-8 text-blue-600" />;
  return <File className="h-8 w-8 text-[#6B5B45]" />;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function DocumentsPage() {
  const { user } = useAuth();
  const [families, setFamilies] = useState<Family[]>([]);
  const [selectedFamilyUuid, setSelectedFamilyUuid] = useState<string>("");
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");

  // Data for Share Modal (Opsi 3)
  const [smallFamilies, setSmallFamilies] = useState<any[]>([]);
  const [familyMembers, setFamilyMembers] = useState<any[]>([]);
  const [loadingShareData, setLoadingShareData] = useState(false);

  // Deskripsi saat upload (2.1)
  const [uploadDescription, setUploadDescription] = useState("");

  // Share modal state
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [docToShare, setDocToShare] = useState<DocumentItem | null>(null);

  // Langkah 1: State untuk pilihan visibility di modal
  const [selectedVisibility, setSelectedVisibility] = useState<
    "private" | "family" | "small_family" | "specific_users"
  >("private");

  // State untuk multi-select "Orang Tertentu"
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<number[]>(
    [],
  );

  // State untuk konfirmasi hapus (modal)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState<DocumentItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch families
  useEffect(() => {
    const fetchFamilies = async () => {
      try {
        const res = await apiFetch("/api/user/families");
        if (res.ok) {
          const data: Family[] = await res.json();
          setFamilies(data);
          if (data.length > 0) {
            setSelectedFamilyUuid(data[0].uuid);
          }
        }
      } catch (err) {
        console.error("Failed to load families", err);
      }
    };
    fetchFamilies();
  }, []);

  // Fetch documents when family changes
  const fetchDocuments = async (familyUuid: string) => {
    if (!familyUuid) return;

    setLoading(true);
    setError("");

    try {
      const res = await apiFetch(`/api/documents?family_uuid=${familyUuid}`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
      } else {
        setError("Gagal memuat dokumen");
      }
    } catch (err) {
      console.error(err);
      setError("Terjadi kesalahan saat memuat dokumen");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedFamilyUuid) {
      fetchDocuments(selectedFamilyUuid);
    }
  }, [selectedFamilyUuid]);

  // === Data fetching for Share Modal (B priority) ===
  const loadSmallFamilies = async (familyUuid: string) => {
    try {
      const res = await apiFetch(`/api/chat/rooms`);
      if (res.ok) {
        const rooms = await res.json();
        const smalls = rooms.filter(
          (r: any) => r.scope_type === "small" && r.family_uuid === familyUuid,
        );
        setSmallFamilies(smalls);
      }
    } catch (err) {
      console.error("Failed to load small families", err);
    }
  };

  const loadFamilyMembers = async (familyUuid: string) => {
    try {
      const res = await apiFetch(`/api/families/${familyUuid}/members`);
      if (res.ok) {
        const data = await res.json();
        setFamilyMembers(data.members || data || []);
      }
    } catch (err) {
      console.error("Failed to load family members", err);
    }
  };

  const prepareShareData = async (familyUuid: string) => {
    setLoadingShareData(true);
    await Promise.all([
      loadSmallFamilies(familyUuid),
      loadFamilyMembers(familyUuid),
    ]);
    setLoadingShareData(false);
  };

  const openShareModal = async (doc: DocumentItem) => {
    setDocToShare(doc);
    setSelectedVisibility(doc.visibility_scope as any);

    // Inisialisasi pilihan "Orang Tertentu" jika sudah ada sebelumnya
    setSelectedRecipientIds(doc.recipient_user_ids || []);

    setShareModalOpen(true);

    // Load data pendukung (small families & members)
    await prepareShareData(doc.family_uuid);
  };

  // Calculate storage usage
  const usedStorage = documents.reduce((sum, doc) => sum + doc.file_size, 0);
  const storagePercent = Math.min((usedStorage / MAX_STORAGE) * 100, 100);

  // Upload handler
  const uploadFile = async (file: File) => {
    if (!selectedFamilyUuid) {
      setError("Pilih keluarga terlebih dahulu");
      return;
    }

    // Client-side validation
    if (file.size > MAX_FILE_SIZE) {
      setError(
        `File terlalu besar. Maksimal 10MB (file Anda ${(file.size / 1024 / 1024).toFixed(1)}MB)`,
      );
      return;
    }

    const isAllowed = ALLOWED_TYPES.some(
      (type) => file.type.startsWith(type) || file.type.includes(type),
    );
    if (!isAllowed) {
      setError(
        "Jenis file tidak didukung. Hanya image, audio, PDF, Word, Excel, dan PowerPoint yang diperbolehkan.",
      );
      return;
    }

    // Check quota
    if (usedStorage + file.size > MAX_STORAGE) {
      setError("Kuota storage Anda sudah penuh (500MB)");
      return;
    }

    setUploading(true);
    setError("");
    setUploadProgress(0);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("family_uuid", selectedFamilyUuid);
    formData.append("description", uploadDescription); // Kirim deskripsi (2.1)

    try {
      const res = await apiFetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const result = await res.json();
        // Refresh documents
        await fetchDocuments(selectedFamilyUuid);
        setUploadProgress(100);
        setUploadDescription(""); // Clear deskripsi setelah upload berhasil (2.1)
        setTimeout(() => setUploadProgress(0), 800);
      } else {
        const errData = await res.json();
        setError(errData.error || "Gagal mengupload file");
      }
    } catch (err) {
      console.error(err);
      setError("Terjadi kesalahan saat upload");
    } finally {
      setUploading(false);
    }
  };

  // Dropzone
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        uploadFile(acceptedFiles[0]);
      }
    },
    multiple: false,
    maxSize: MAX_FILE_SIZE,
    accept: {
      "image/*": [],
      "application/pdf": [],
      "application/msword": [],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        [],
      "application/vnd.ms-excel": [],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [],
      "application/vnd.ms-powerpoint": [],
      "application/vnd.openxmlformats-officedocument.presentationml.presentation":
        [],
      "audio/*": [],
    },
  });

  const handleDownload = (doc: DocumentItem) => {
    const link = document.createElement("a");
    link.href = doc.public_url;
    link.download = doc.original_name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Buka modal konfirmasi hapus
  const openDeleteModal = (doc: DocumentItem) => {
    setDocToDelete(doc);
    setDeleteModalOpen(true);
  };

  // Proses hapus setelah dikonfirmasi
  const confirmDelete = async () => {
    if (!docToDelete) return;

    setIsDeleting(true);

    try {
      const res = await apiFetch(`/api/documents?id=${docToDelete.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        await fetchDocuments(selectedFamilyUuid);
        setDeleteModalOpen(false);
        setDocToDelete(null);
      } else {
        const err = await res.json();
        alert(err.error || "Gagal menghapus dokumen");
      }
    } catch (err) {
      alert("Terjadi kesalahan saat menghapus");
    } finally {
      setIsDeleting(false);
    }
  };

  // Tutup modal hapus
  const closeDeleteModal = () => {
    if (!isDeleting) {
      setDeleteModalOpen(false);
      setDocToDelete(null);
    }
  };

  // Simple Share Modal (A - basic version, will be improved)
  const closeShareModal = () => {
    setShareModalOpen(false);
    setDocToShare(null);
    setSelectedVisibility("private");
    setSelectedRecipientIds([]); // Reset pilihan orang tertentu
  };

  const saveSharing = async () => {
    if (!docToShare) return;

    const payload: any = {
      id: docToShare.id,
      visibility_scope: selectedVisibility,
    };

    // Jika memilih "Orang Tertentu", kirim daftar user_id yang dipilih
    if (selectedVisibility === "specific_users") {
      payload.recipient_user_ids = selectedRecipientIds;
    } else {
      payload.recipient_user_ids = null;
    }

    // Untuk small_family, kita belum handle pilihan spesifik di Langkah ini
    // (nanti bisa ditambah dropdown)
    if (selectedVisibility === "small_family") {
      // Untuk sekarang, ambil dari data yang sudah ada di dokumen
      // Atau nanti kita tambahkan pilihan
      payload.small_family_uuid = docToShare.small_family_uuid || null;
    } else {
      payload.small_family_uuid = null;
    }

    try {
      const res = await apiFetch("/api/documents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await fetchDocuments(selectedFamilyUuid);
        closeShareModal();
      } else {
        const err = await res.json();
        alert(err.error || "Gagal memperbarui sharing");
      }
    } catch (err) {
      alert("Gagal menyimpan pengaturan berbagi");
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F0E8] p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-[#3B2F1E]">
              Dokumen Keluarga
            </h1>
            <p className="text-sm text-[#6B5B45] mt-1">
              Simpan dan bagikan dokumen penting keluarga
            </p>
          </div>

          <button
            onClick={() =>
              selectedFamilyUuid && fetchDocuments(selectedFamilyUuid)
            }
            className="flex items-center gap-2 px-4 py-2 bg-white border border-[#D4C4A8] rounded-xl hover:bg-[#EDE4D3] transition"
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Muat Ulang
          </button>
        </div>

        {/* Family Selector + Storage Bar */}
        <div className="bg-white border border-[#D4C4A8] rounded-2xl p-4 mb-6 flex flex-col md:flex-row md:items-center gap-4">
          {/* Family Selector */}
          <div className="flex-1">
            <label className="text-xs text-[#6B5B45] block mb-1">
              Keluarga
            </label>
            <select
              value={selectedFamilyUuid}
              onChange={(e) => setSelectedFamilyUuid(e.target.value)}
              className="w-full border border-[#D4C4A8] rounded-xl px-4 py-2 bg-[#FDFAF5] text-[#3B2F1E]"
              disabled={families.length === 0}
            >
              {families.map((f) => (
                <option key={f.uuid} value={f.uuid}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          {/* Storage Usage */}
          <div className="flex-1 min-w-[240px]">
            <div className="flex justify-between text-xs text-[#6B5B45] mb-1">
              <span>Storage Digunakan</span>
              <span>{formatSize(usedStorage)} / 500 MB</span>
            </div>
            <div className="h-3 bg-[#EDE4D3] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#4A7C59] transition-all"
                style={{ width: `${storagePercent}%` }}
              />
            </div>
            {usedStorage > 400 * 1024 * 1024 && (
              <p className="text-[10px] text-orange-600 mt-1">
                Mendekati batas kuota
              </p>
            )}
          </div>
        </div>

        {/* Upload Area */}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-2xl p-8 mb-8 text-center cursor-pointer transition
            ${isDragActive ? "border-[#4A7C59] bg-[#EDE4D3]" : "border-[#D4C4A8] hover:border-[#4A7C59] bg-white"}`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-[#EDE4D3] flex items-center justify-center">
              <Upload className="h-7 w-7 text-[#4A7C59]" />
            </div>
            <div>
              <p className="font-medium text-[#3B2F1E]">
                {isDragActive
                  ? "Lepaskan file di sini"
                  : "Tarik file ke sini atau klik untuk upload"}
              </p>
              <p className="text-sm text-[#6B5B45] mt-1">
                Maksimal 10MB • Image, PDF, Word, Excel, PowerPoint, Audio
              </p>
            </div>

            {/* Input Deskripsi (2.1) */}
            <div
              className="w-full max-w-md mt-4"
              onClick={(e) => e.stopPropagation()}
            >
              <textarea
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                placeholder="Deskripsi dokumen (opsional)..."
                className="w-full px-3 py-2 text-sm rounded-xl border border-[#D4C4A8] bg-[#FDFAF5] 
                           focus:outline-none focus:ring-1 focus:ring-[#4A7C59] text-[#3B2F1E] 
                           placeholder:text-[#B0A090] resize-y min-h-[60px]"
                rows={2}
              />
            </div>
          </div>

          {uploading && (
            <div className="mt-4">
              <div className="h-2 bg-[#EDE4D3] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#4A7C59] transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-xs text-[#6B5B45] mt-1">Mengupload...</p>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-100 text-red-700 rounded-xl text-sm">
            {error}
          </div>
        )}

        {/* Documents List */}
        {loading ? (
          <div className="text-center py-12 text-[#6B5B45]">
            Memuat dokumen...
          </div>
        ) : documents.length === 0 ? (
          <div className="bg-white border border-[#D4C4A8] rounded-2xl p-10 text-center">
            <FileText className="h-12 w-12 mx-auto text-[#C4B39A] mb-4" />
            <h3 className="text-lg font-medium text-[#3B2F1E]">
              Belum ada dokumen
            </h3>
            <p className="text-[#6B5B45] mt-2">
              Upload dokumen pertama keluarga Anda
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="bg-white border border-[#D4C4A8] rounded-2xl p-4 flex flex-col hover:shadow-md transition"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>{getFileIcon(doc.mime_type)}</div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openShareModal(doc)}
                      className="text-[#4A7C59] hover:text-[#2E5239] p-1 text-xs font-medium"
                      title="Bagikan"
                    >
                      Bagikan
                    </button>
                    <button
                      onClick={() => handleDownload(doc)}
                      className="text-[#6B5B45] hover:text-[#4A7C59] p-1"
                      title="Download"
                    >
                      <Download size={18} />
                    </button>
                    <button
                      onClick={() => openDeleteModal(doc)}
                      className="text-red-500 hover:text-red-600 p-1"
                      title="Hapus"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                <div className="flex-1">
                  <p className="font-medium text-[#3B2F1E] text-sm leading-tight line-clamp-2">
                    {doc.original_name}
                  </p>
                  <p className="text-xs text-[#6B5B45] mt-1">
                    {formatSize(doc.file_size)} •{" "}
                    {new Date(doc.created_at).toLocaleDateString("id-ID")}
                  </p>
                </div>

                <div className="mt-3 pt-3 border-t border-[#EDE4D3] text-[10px] text-[#9C8B75] flex justify-between">
                  <span>
                    {doc.visibility_scope === "private" && "Hanya Anda"}
                    {doc.visibility_scope === "family" && "Keluarga Besar"}
                    {doc.visibility_scope === "small_family" && "Keluarga Inti"}
                  </span>
                  {doc.uploader_name && (
                    <span className="text-[#C4B39A]">
                      oleh {doc.uploader_name.split(" ")[0]}
                    </span>
                  )}
                </div>

                {/* Tampilkan Deskripsi (2.2) */}
                {doc.description && (
                  <p className="text-xs text-[#6B5B45] mt-2 line-clamp-2 leading-snug">
                    {doc.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* === SHARE MODAL - Langkah 1 (Status Saat Ini + UI Bersih) === */}
      {shareModalOpen && docToShare && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-[#3B2F1E]">
                Bagikan Dokumen
              </h3>
              <p className="text-sm text-[#6B5B45] mt-0.5 truncate">
                {docToShare.original_name}
              </p>
            </div>

            {/* Status Saat Ini */}
            <div className="mb-4 p-3 bg-[#F5F0E8] rounded-xl text-sm">
              <span className="text-[#6B5B45]">Status saat ini: </span>
              <span className="font-medium text-[#3B2F1E]">
                {docToShare.visibility_scope === "private" &&
                  "Private (Hanya Anda)"}
                {docToShare.visibility_scope === "family" && "Keluarga Besar"}
                {docToShare.visibility_scope === "small_family" &&
                  "Keluarga Inti"}
                {docToShare.visibility_scope === "specific_users" &&
                  "Orang Tertentu"}
              </span>
            </div>

            <div className="space-y-2 mb-6">
              {/* Private */}
              <label
                onClick={() => setSelectedVisibility("private")}
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                  selectedVisibility === "private"
                    ? "border-[#4A7C59] bg-[#EDE4D3]"
                    : "border-[#D4C4A8]"
                }`}
              >
                <input
                  type="radio"
                  checked={selectedVisibility === "private"}
                  onChange={() => setSelectedVisibility("private")}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium text-[#3B2F1E]">
                    Private — Hanya saya
                  </div>
                  <div className="text-xs text-[#6B5B45]">
                    Hanya kamu yang bisa melihat dokumen ini.
                  </div>
                </div>
              </label>

              {/* Keluarga Besar */}
              <label
                onClick={() => setSelectedVisibility("family")}
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                  selectedVisibility === "family"
                    ? "border-[#4A7C59] bg-[#EDE4D3]"
                    : "border-[#D4C4A8]"
                }`}
              >
                <input
                  type="radio"
                  checked={selectedVisibility === "family"}
                  onChange={() => setSelectedVisibility("family")}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium text-[#3B2F1E]">
                    Keluarga Besar
                  </div>
                  <div className="text-xs text-[#6B5B45]">
                    Semua anggota keluarga bisa melihat dokumen ini.
                  </div>
                </div>
              </label>

              {/* Keluarga Inti */}
              <label
                onClick={() => setSelectedVisibility("small_family")}
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                  selectedVisibility === "small_family"
                    ? "border-[#4A7C59] bg-[#EDE4D3]"
                    : "border-[#D4C4A8]"
                }`}
              >
                <input
                  type="radio"
                  checked={selectedVisibility === "small_family"}
                  onChange={() => setSelectedVisibility("small_family")}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium text-[#3B2F1E]">
                    Keluarga Inti
                  </div>
                  <div className="text-xs text-[#6B5B45]">
                    Hanya anggota keluarga inti tertentu yang bisa melihat.
                  </div>
                </div>
              </label>

              {/* Orang Tertentu */}
              <label
                onClick={() => setSelectedVisibility("specific_users")}
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                  selectedVisibility === "specific_users"
                    ? "border-[#4A7C59] bg-[#EDE4D3]"
                    : "border-[#D4C4A8]"
                }`}
              >
                <input
                  type="radio"
                  checked={selectedVisibility === "specific_users"}
                  onChange={() => setSelectedVisibility("specific_users")}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium text-[#3B2F1E]">
                    Orang Tertentu
                  </div>
                  <div className="text-xs text-[#6B5B45]">
                    Pilih anggota keluarga secara spesifik.
                  </div>
                </div>
              </label>

              {/* Multi-select untuk Orang Tertentu */}
              {selectedVisibility === "specific_users" && (
                <div className="mt-3 p-3 border border-[#D4C4A8] rounded-xl bg-[#FDFAF5]">
                  <div className="text-xs text-[#6B5B45] mb-2 font-medium">
                    Pilih anggota yang boleh melihat:
                  </div>

                  {familyMembers.length === 0 ? (
                    <div className="text-xs text-[#9C8B75]">
                      Tidak ada anggota keluarga.
                    </div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {familyMembers.map((member: any) => {
                        const userId = member.user_id;
                        const isChecked = selectedRecipientIds.includes(userId);

                        return (
                          <label
                            key={userId}
                            className="flex items-center gap-2 p-1.5 rounded hover:bg-[#EDE4D3] cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedRecipientIds([
                                    ...selectedRecipientIds,
                                    userId,
                                  ]);
                                } else {
                                  setSelectedRecipientIds(
                                    selectedRecipientIds.filter(
                                      (id) => id !== userId,
                                    ),
                                  );
                                }
                              }}
                              className="accent-[#4A7C59]"
                            />
                            <div className="flex items-center gap-2 flex-1">
                              {member.photo_url ? (
                                <img
                                  src={member.photo_url}
                                  alt=""
                                  className="w-6 h-6 rounded-full object-cover border"
                                />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-[#EDE4D3] flex items-center justify-center text-[10px]">
                                  {member.full_name?.[0] || "?"}
                                </div>
                              )}
                              <span className="text-sm text-[#3B2F1E]">
                                {member.full_name}
                              </span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  <div className="text-[10px] text-[#9C8B75] mt-2">
                    Dipilih: {selectedRecipientIds.length} orang
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={closeShareModal}
                className="px-4 py-2 text-[#6B5B45] hover:bg-[#F5F0E8] rounded-xl transition"
              >
                Batal
              </button>
              <button
                onClick={saveSharing}
                className="px-5 py-2 bg-[#4A7C59] hover:bg-[#2E5239] text-white rounded-xl font-medium transition"
              >
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === DELETE CONFIRMATION MODAL === */}
      {deleteModalOpen && docToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <div className="flex items-start gap-4">
              {/* Icon */}
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              {/* Konten */}
              <div className="flex-1 min-w-0">
                {" "}
                {/* min-w-0 penting agar truncate bekerja */}
                <h3 className="text-lg font-semibold text-[#3B2F1E]">
                  Hapus Dokumen?
                </h3>
                <p className="text-sm text-[#6B5B45] mt-1">
                  Apakah kamu yakin ingin menghapus dokumen ini?
                </p>
                {/* Box info dokumen */}
                <div className="mt-3 p-3 bg-[#F5F0E8] rounded-lg overflow-hidden">
                  <p className="text-sm font-medium text-[#3B2F1E] truncate">
                    {docToDelete.original_name}
                  </p>
                  {docToDelete.description && (
                    <p className="text-xs text-[#6B5B45] mt-1 line-clamp-2 break-words">
                      {docToDelete.description}
                    </p>
                  )}
                </div>
                <p className="text-xs text-red-600 mt-3">
                  Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
            </div>
            {/* Tombol */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={closeDeleteModal}
                disabled={isDeleting}
                className="px-4 py-2 text-[#6B5B45] hover:bg-[#F5F0E8] rounded-xl transition disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition disabled:opacity-70 flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    Menghapus...
                  </>
                ) : (
                  "Ya, Hapus"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
