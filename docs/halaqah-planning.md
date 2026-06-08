# PRD: Fitur Halaqah — CeritaKeluarga
## Product Requirement Document (PRD)

### 1. Visi & Tujuan
Halaqah adalah ekosistem lingkaran belajar antar keluarga inti. Tujuannya bukan sekadar grup chat, melainkan wadah pertumbuhan bersama melalui kurikulum terstruktur (Learning Path), tantangan praktis (Challenges), dan pertukaran keahlian (Skill Swap).

---

### 2. User Flow & Journey

#### 2.1 Alur Bergabung (Join Flow)
Terdapat dua jalur utama untuk masuk ke dalam sebuah Halaqah:

**A. Jalur Undangan (Create New Group):**
1. **Discovery**: User mencari keluarga inti lain berdasarkan skill/profesi di `/halaqah/discover/skill`.
2. **Invitation**: User mengirim undangan belajar kepada keluarga target.
3. **Acceptance**: Keluarga target menerima undangan.
4. **Auto-Creation**: Sistem secara otomatis membuat Grup Halaqah baru.
5. **Customization**: Admin grup dapat mengubah nama grup, deskripsi, dan menentukan tema (Parenting, Pranikah, Belajar Anak).
6. **Onboarding**: Semua anggota keluarga inti (suami, istri, anak) otomatis masuk ke dalam grup dan chat room.

**B. Jalur Request (Join Existing Group):**
1. **Discovery**: User menemukan grup Halaqah yang sudah aktif melalui pencarian.
2. **Request**: User mengirim permintaan bergabung (`Join Request`).
3. **Approval**: Admin grup meninjau profil keluarga pemohon dan menyetujui/menolak permintaan.
4. **Onboarding**: Setelah disetujui, keluarga inti otomatis bergabung ke grup dan chat room.

#### 2.2 Alur Belajar (Engagement Flow)
1. **Learning Path**: Grup mengikuti peta pembelajaran. Setiap keluarga menandai progress materi yang sudah dipelajari bersama.
2. **Challenge**: Admin atau AI memberikan tantangan mingguan berbasis materi. Keluarga mengupload bukti/cerita hasil praktik.
3. **Interaction**: Diskusi mendalam dilakukan melalui Chat Room yang terintegrasi.

---

### 3. Fitur Utama & Spesifikasi

#### 3.1 Profil Profesional (The "LinkedIn" Side)
Setiap user memiliki profil profesional yang dapat diatur visibilitasnya.
- **Occupation**: Pekerjaan saat ini.
- **Skills**: List keahlian (e.g., Memasak, Coding, Bertani, Berkebun).
- **Experience**: Riwayat pekerjaan (Company, Role, Period, Description) — *Optional*.
- **Privacy**: Default Public, namun dapat di-hide oleh user.

#### 3.2 Learning Path (Peta Belajar)
Visualisasi progres belajar grup.
- **Modul**: Terdiri dari beberapa tahap (Step 1 $\rightarrow$ Step 2 $\rightarrow$ ...).
- **Collaborative Progress**: Progres dihitung per keluarga inti. Jika suami/istri menandai selesai, maka keluarga tersebut dianggap selesai.
- **Content**: Setiap step berisi materi (PDF, Video, Link) dan panduan diskusi.

#### 3.3 Weekly Challenges
Sistem tantangan untuk menerapkan ilmu.
- **Challenge Card**: Judul tantangan, deadline, dan instruksi.
- **Submission**: Keluarga mengupload foto/teks hasil praktik.
- **Recognition**: Badge atau apresiasi dari admin/anggota lain.

#### 3.4 Group Chat & Management
- **Auto-Room**: Integrasi otomatis dengan Supabase Chat.
- **Member Sync**: Sinkronisasi otomatis anggota keluarga inti (Suami + Istri + Anak).
- **Admin Tools**: Rename grup, kelola anggota, dan update Learning Path.

---

### 4. Struktur Data (Schema Update)

#### 4.1 Tabel Nodes (Update)
- `occupation`: TEXT
- `skills`: TEXT[] (Array of strings)
- `occupation_is_public`: BOOLEAN (Default: true)

#### 4.2 Tabel Node Experiences (New)
- `id`: BIGSERIAL (PK)
- `node_id`: INTEGER (FK nodes)
- `company_name`: VARCHAR(255)
- `role`: VARCHAR(255)
- `start_date`: DATE
- `end_date`: DATE
- `description`: TEXT
- `is_public`: BOOLEAN (Default: true)

#### 4.3 Tabel Halaqahs (Update)
- `learning_path_id`: INTEGER (FK to a path template)
- `current_step`: INTEGER (Step aktif saat ini)

#### 4.4 Tabel Learning Path & Steps (New)
- `learning_paths`: (id, name, description, theme)
- `learning_steps`: (id, path_id, step_order, title, content, suggested_materi_id)
- `halaqah_step_progress`: (halaqah_id, step_id, nuclear_family_id, is_completed, completed_at)

#### 4.5 Tabel Challenges (New)
- `challenges`: (id, halaqah_id, title, description, due_date)
- `challenge_submissions`: (id, challenge_id, nuclear_family_id, content_url, description, created_at)

---

### 5. Desain Antarmuka (UI/UX Design)

#### 5.1 Halaman Discovery (Search & Match)
- **Search Bar**: Pencarian berdasarkan skill/pekerjaan.
- **Family Cards**: Menampilkan profil keluarga inti $\rightarrow$ Tombol "Kirim Undangan Belajar".
- **Group Cards**: Menampilkan grup yang sudah ada $\rightarrow$ Tombol "Request Join".

#### 5.2 Detail Halaqah (The Hub)
Menggunakan Tab Navigation:
1. **Tab Learning Path**: 
   - Visual vertikal/horizontal timeline (Step 1 $\rightarrow$ Step 2).
   - Checkbox "Selesai dipelajari bersama keluarga".
   - Tombol "Buka Materi".
2. **Tab Challenge**:
   - Card tantangan aktif saat ini.
   - Gallery hasil submit keluarga lain (inspirasi).
   - Tombol "Kirim Hasil Praktik".
3. **Tab Chat**:
   - Interface chat standar dengan member otomatis keluarga inti.
4. **Tab Anggota**:
   - List keluarga anggota + Profil profesional mereka.

---

### 6. Roadmap Implementasi

**Sprint 1: Profil & Fondasi**
- [ ] Migration: `nodes` (occupation, skills) & `node_experiences`.
- [ ] UI: Update Profile Page (Professional Section).
- [ ] API: Get/Update Professional Profile.

**Sprint 2: Discovery & Invitation Flow**
- [ ] UI: Discover Skill $\rightarrow$ Family Card.
- [ ] API: Send Invitation $\rightarrow$ Accept Invitation $\rightarrow$ Auto-create Halaqah.
- [ ] API: Create Chat Room & Sync Nuclear Family.

**Sprint 3: Learning Path & Detail**
- [ ] Schema: `learning_paths`, `learning_steps`, `progress`.
- [ ] UI: Detail Halaqah Tab Learning Path (Timeline View).
- [ ] API: Update Progress & Fetch Path.

**Sprint 4: Challenges & Engagement**
- [ ] Schema: `challenges`, `submissions`.
- [ ] UI: Detail Halaqah Tab Challenge.
- [ ] API: Post Submission & List Challenges.

**Sprint 5: Join Request Flow**
- [ ] UI: Discover Existing Groups.
- [ ] API: Join Request $\rightarrow$ Admin Approval.
