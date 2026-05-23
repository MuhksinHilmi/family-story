# PLANNING - Status Implementasi Fitur Family Tree & Invitation System

**Proyek**: Cerita Keluarga (Family Story)  
**Update Terakhir**: 23 Mei 2026 (Cleanup legacy dilakukan)  
**Fokus Saat Ini**: Bersihkan sisa kode legacy tree + lanjutkan migrasi mutation canvas

---

## ✅ Sudah Diimplementasikan (Completed)

### 1. Database Schema Baru (2026-clean)
- Tabel `nodes`, `marriages`, `nuclear_families`, `nuclear_family_memberships`, `parent_child_relations`, `invitations` (dengan kolom baru: `relationship_type`, `parent_node_id`, `inviter_gender`, `invitee_node_id`, `invitee_email`, `token`, `expires_at`, dll.)
- Aturan kultur: ayah sebagai pemilik nuclear family, birth_order hanya diatur ayah, ibu hanya menambah relasi jika anak sudah punya family.
- File: `db/schema/2026-clean/init.sql`

### 2. Backend - Sistem Undangan (Invitation APIs)
- `POST /api/invitations` → membuat undangan (spouse/child), support existing user (node_uuid) + new user (email), share_link (one-time token 7 hari), validasi ketat hanya untuk existing user.
- `GET /api/invitations?status=pending` → daftar undangan masuk untuk user login.
- `POST /api/invitations/accept` → terima undangan (spouse + child logic lengkap + birth_order + family membership).
- `POST /api/invitations/reject` → tolak undangan (status → revoked).
- Sinkronisasi penuh logic child/spouse antara accept dan register.
- File: `src/app/api/invitations/route.ts`, `accept/route.ts`, `reject/route.ts`

### 3. Backend - Registrasi User Baru via Undangan
- `POST /api/auth/register` mendukung `invite_token`:
  - Validasi token, email match, gender lock untuk spouse.
  - Auto-claim: buat marriage + nuclear_family (spouse), atau parent_child + family membership + birth_order (child via ayah).
  - Untuk child via ibu: hanya relasi parent-child (sesuai aturan).
- File: `src/app/api/auth/register/route.ts`

### 4. Frontend - Halaman Register + Claim Undangan
- `src/app/auth/register/page.tsx`:
  - Deteksi `?invite=TOKEN`.
  - Fetch detail undangan, lock gender untuk spouse.
  - Kirim `invite_token` ke register API.
  - Tampilkan info "Anda diundang sebagai ... oleh ...".
- Button text berubah menjadi "Daftar & Klaim Undangan".

### 5. Frontend - Notifikasi Undangan (Bell + Dropdown)
- `src/app/tree/page.tsx`:
  - Bell icon + badge jumlah pending.
  - Dropdown list undangan (bukan langsung modal).
  - Click outside untuk tutup dropdown.
  - Buka `InvitationConfirmModal` dari list.
- `src/app/tree/components/InvitationConfirmModal.tsx`:
  - Tampil detail undangan + tombol Terima / Tolak.
  - Call accept & reject API.
  - Emit custom event `invitations-updated`.
- `src/components/app-sidebar.tsx`:
  - Red dot pada menu "Pohon Keluarga" jika ada pending invitation (hanya di route /tree).
  - Auto refresh via event listener.
- Fetch pending via `/api/invitations?status=pending`.
- Auto refresh tree & sidebar setelah accept/reject.

### 6. Tree Loading Migration (Baru - 23 Mei 2026)
- `GET /api/tree/me` → lookup node user di tabel `nodes` baru, return `current_nuclear_family_id`.
- `GET /api/tree?family_id=XXX` → loader baru dari `nuclear_family_memberships` + `marriages` + `parent_child_relations`.
  - Mapping ke shape `FamilyNodeData` + ReactFlow Node/Edge yang kompatibel.
  - Layout sederhana (suami-kiri, istri-kanan, anak di bawah).
- Fallback: jika user tidak punya nuclear family (misal anak hanya diundang ibu) → tampilkan single node "hanya saya".
- `loadUserNode` di hook diupdate untuk handle `family_id: null`.
- `/api/family` support `nuclear_families.uuid`.
- File: `src/app/api/tree/me/route.ts`, `src/app/api/tree/route.ts`, `src/app/api/family/route.ts`, `src/app/tree/hooks/useFamilyTree.ts`

### 7. Legacy Code Cleanup (23 Mei 2026)
- Hapus `src/app/api/tree/invite/route.ts`.
- Hapus seluruh folder & route legacy: `/api/tree/edge`, `/api/tree/[id]/...`, `/api/tree/validate`.
- Nonaktifkan `deleteEdge`, `reinviteNode`, dan semua tombol mode canvas editing (Spouse/Child/Delete) sementara.
- Update `deleteEdge` dan `reinviteNode` menjadi no-op + alert.
- Tree sekarang **hanya** menggunakan schema baru untuk loading + invitation flow.
- Canvas editing (connect/delete antar node yang sudah ada) dinonaktifkan dulu sampai migrasi connect logic selesai.

---

## 🔄 Sedang Dikerjakan / Baru Selesai Partial

- Tree loading (sudah selesai di atas).
- Penyempurnaan bell/dropdown + tolak (sudah selesai sebelum migrasi loading).
- Sinkronisasi logic child antara accept & register (sudah).

---

## ❌ Belum Diimplementasikan (Pending - Prioritas Tinggi)

### A. Migrasi Sending Invitation & Tree Mutations (Paling Urgent)
- Update `AddNodeModal.tsx` + `handleInviteMember` di `tree/page.tsx` agar memanggil `POST /api/invitations` (bukan `/api/tree/invite` lama).
- Update `NodeDetailModal.tsx`:
  - Tombol "Undang Pasangan" / "Tambah Anak" untuk node terpilih (existing user via node_uuid) atau email baru.
  - Generate share link dari response invitation + tampilkan modal copy link.
- Migrasi action di `useFamilyTree.ts`:
  - `connectSpouse`, `addChild`, `connectChild`, `deleteNode`, `deleteEdge`, `reinviteNode`.
- Saat ini masih pakai old model (`family_nodes`, `spouse_relations`, old invite).

### B. UX untuk "Pending Invitee" di Pohon
- Setelah kirim undangan ke user baru (email), apakah perlu buat "ghost node" sementara di tree (dengan status pending) atau hanya success message + share link saja?
- Refresh tree otomatis setelah kirim undangan baru.

### C. Birth Order & Father-Only Editing
- UI untuk mengubah birth_order hanya oleh ayah (father node).
- Validasi di backend jika ada.

### D. Multi-Generation & Complex Family View
- Load orang tua (grandparents) dari nuclear family saat ini (agar tree tidak hanya 1 generasi).
- Support multiple nuclear families seumur hidup + historical membership (left_at).

### E. Pembersihan Legacy Code
- Hapus semua referensi `family_nodes`, `spouse_relations`, `family_members`, old `invitations` table.
- Hapus atau deprecate handler lama di `/api/tree/route.ts` (POST/PUT/DELETE), `/api/tree/invite`, `/api/tree/validate`, dll.
- Update type `FamilyNodeData` agar lebih sesuai schema baru (hapus field lama seperti `father_id` manual, `invitation_*`).

### F. End-to-End Flow Testing
- Test lengkap:
  1. User A (ayah) undang anak baru via email → dapat link.
  2. User baru register via link → auto claim sebagai child + masuk family ayah + birth_order benar.
  3. Login → lihat tree dengan posisi benar + relasi.
  4. User B (ibu) undang anak → hanya relasi, tidak ubah family.
  5. Spouse invitation + gender lock.
  6. Tolak undangan.

### G. Penanganan Kasus Khusus
- User yang tidak punya node sama sekali setelah register (edge case).
- Remarriage, anak dari pernikahan sebelumnya, adopsi.
- Ketika orang menikah: keluar dari nuclear family lama + buat baru.

---

## 📋 Prioritas Berikutnya (Rekomendasi)

1. **Migrasi sending invitation** (A + B) — supaya fitur undang dari dalam tree bisa dipakai lagi.
2. **Pembersihan legacy** + pastikan tidak ada query ke tabel lama.
3. **Birth order editing** + father-only rule di UI.
4. **Multi-generation view** (load parents).
5. **E2E testing** + data seeding untuk demo.
6. Chat rooms (sesuai komentar di schema).

---

## Catatan Teknis Penting

- Semua user yang login **wajib** punya 1 record di `nodes`.
- Undangan ke user baru **tidak** membuat node sampai mereka register + claim.
- Ayah = owner nuclear family untuk anak.
- Share link sekarang per-invitation (bukan per-family seperti dulu).
- Custom event `invitations-updated` digunakan untuk komunikasi antar komponen (sidebar ↔ tree).

---

**Status Keseluruhan**:  
Core invitation flow (create → register → accept/reject → notification) **90% selesai**.  
Tree visualization (loading) **baru selesai**.  
Tree mutation & sending invitation **masih legacy → blocker utama** untuk full migration.

Silakan beri arahan bagian mana yang ingin dikerjakan selanjutnya (misal: mulai migrasi AddNodeModal + sending invitation, atau perbaikan birth order, dll).
