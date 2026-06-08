# Rencana Update halaqah-planning.md

## Perubahan yang Akan Ditambahkan

### 1. File Structure - Tambah Section Baru

```
src/app/halaqah/discover/
├── page.tsx                  ← Discovery utama (existing)
├── skill/
│   └── page.tsx              ← BARU: Pencarian berdasarkan skill/profesi
└── components/
    ├── SkillFilter.tsx       ← BARU: Filter skill/profesi
    ├── SkillMatchCard.tsx    ← BARU: Card keluarga yang cocok berdasarkan skill
    └── JoinOrCreateModal.tsx ← BARU: Modal join existing atau create group baru
```

### 2. Data Types - Tambah Interface Baru

```ts
// Tambah di section 3 (Data Types)

// Occupation data dari nodes
interface NodeOccupation {
  node_id: number
  occupation: string
  occupation_is_public: boolean
}

// Skill match result untuk discovery
interface SkillMatchResult {
  nuclear_family_id: number
  family_name: string
  head_name: string
  spouse_name?: string
  head_occupation: string
  spouse_occupation?: string
  matched_skills: string[]      // skill yang cocok dengan filter user
  location_label: string
  existing_halaqah?: {          // jika sudah ada halaqah
    halaqah_id: number
    halaqah_uuid: string        // untuk Supabase chat
    halaqah_name: string
    member_count: number
    member_limit: number
    status: 'active' | 'full'
    can_join: boolean
  }
}

// Request auto-create halaqah
interface AutoCreateHalaqahRequest {
  target_family_id: number
  type: 'pasangan' | 'anak' | 'umum'
  shared_skills: string[]
  location: string
}
```

### 3. Business Rules - Tambah Rules Baru (setelah rule 10)

| # | Rule Baru |
|---|----------|
| 11 | Pencarian skill hanya menampilkan keluarga dengan nuclear_family aktif dan occupation public |
| 12 | Skill matching menggunakan exact match antara occupation head + spouse |
| 13 | Jika target family belum ada halaqah → buat otomatis dengan type=umum, nama "Halaqah [Skill] - [Lokasi]" |
| 14 | Chat room dibuat dengan UUID (Supabase format) saat halaqah dibuat |
| 15 | Semua anggota keluarga inti (suami+istri) otomatis masuk chat room |
| 16 | Jika target family sudah ada halaqah dan bisa join → kirim join request |
| 17 | Jika halaqah sudah penuh → tampilkan pesan "Grup sudah penuh, pilih keluarga lain" |

### 4. API Routes - Tambah Endpoint Baru

```
GET /api/halaqah/discover/skill
  Query: skills (comma-separated), location?, radius_km?
  Response: { matches: SkillMatchResult[], meta: {...} }

POST /api/halaqah/auto-create-from-match
  Body: AutoCreateHalaqahRequest
  Response: { 
    halaqah: Halaqah, 
    chat_room_uuid: string,  // untuk Supabase
    status: 'created' | 'joined_pending'
  }

GET /api/nodes/[nodeId]/occupation
  Response: NodeOccupation
```

### 5. Schema Changes Diperlukan

```sql
-- Migration baru: tambah kolom occupation ke nodes
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS occupation TEXT;
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS occupation_is_public BOOLEAN DEFAULT false;

-- Table halaqahs (belum ada di schema)
CREATE TABLE halaqahs (
  id BIGSERIAL PRIMARY KEY,
  uuid UUID UNIQUE DEFAULT gen_random_uuid(),  -- untuk Supabase chat
  nuclear_family_id INTEGER NOT NULL REFERENCES nuclear_families(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(20) NOT NULL CHECK (type IN ('pasangan', 'anak', 'umum')),
  topics TEXT[],
  location_label TEXT,
  location_lat NUMERIC,
  location_lng NUMERIC,
  radius_km INTEGER,
  member_limit INTEGER,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'full', 'archived')),
  chat_room_uuid UUID UNIQUE,  -- reference ke chat_rooms Supabase
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table halaqah_members (belum ada)
CREATE TABLE halaqah_members (
  id BIGSERIAL PRIMARY KEY,
  halaqah_id INTEGER NOT NULL REFERENCES halaqahs(id) ON DELETE CASCADE,
  node_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'left')),
  is_admin BOOLEAN DEFAULT false,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(halaqah_id, node_id)
);
```

### 6. UI Components Detail

#### 5.11 `discover/skill/page.tsx`
- Header: "Temukan Keluarga Berdasarkan Skill"
- SkillFilter: multi-select chips untuk pemilihan profesi
- List SkillMatchCard hasil pencarian
- Empty state: "Tidak ada keluarga dengan skill ini, coba skill lain atau buat halaqah baru"

#### 5.12 `SkillFilter.tsx`
- Search input dengan autocomplete
- Chips skill terpilih
- Kategori: Kesehatan, Pendidikan, Teknologi, Keagamaan, dll

#### 5.13 `SkillMatchCard.tsx`
- Tampilkan nama keluarga + matched skills
- Badge jika sudah ada halaqah
- Tombol "Buat Halaqah" atau "Gabung" tergantung status

#### 5.14 `JoinOrCreateModal.tsx`
- Jika belum ada halaqah:
  - Preview: "Akan membuat halaqah baru untuk keluarga X"
  - Tombol "Buat Halaqah" (primary)
- Jika sudah ada:
  - Preview info halaqah
  - Tombol "Gabung ke Halaqah" atau "Lihat Saja"

### 7. Integrasi ke Flow yang Ada

Tidak mengubah flow yang sudah ada di halaqah-planning.md. Fitur ini menjadi jalur alternatif di:
- `/halaqah/discover` → tombol/tab "Berdasarkan Skill" 
- Atau link terpisah di dashboard

### 8. Catatan Supabase Chat Integration

- Gunakan UUID untuk chat room identifier
- Chat room dibuat via Supabase client saat halaqah dibuat
- Invite anggota via RPC call ke Supabase