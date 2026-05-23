-- =============================================================================
-- FAMILY STORY - CLEAN SCHEMA v1 (2026-05-23)
-- Full redesign for global relationship graph + nuclear family units
-- =============================================================================

-- ============================================================================
-- 1. USERS (akun login + auth flow)
-- ============================================================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    uuid UUID UNIQUE DEFAULT gen_random_uuid(),

    email VARCHAR(255) UNIQUE,
    phone VARCHAR(50),
    full_name VARCHAR(255) NOT NULL,
    gender VARCHAR(10) CHECK (gender IN ('male', 'female')),
    birth_date DATE,
    photo_url TEXT,

    -- Auth & Activation
    is_email_verified BOOLEAN DEFAULT false,
    is_phone_verified BOOLEAN DEFAULT false,
    activation_token VARCHAR(64),
    activation_status VARCHAR(20) DEFAULT 'pending' CHECK (activation_status IN ('pending', 'active', 'deactivated')),

    -- OTP
    otp VARCHAR(6),
    otp_expires_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. NODES (inti dari graph visualisasi)
-- Setiap orang punya tepat 1 node. Node dibuat saat register atau saat di-invite.
-- ============================================================================
CREATE TABLE nodes (
    id SERIAL PRIMARY KEY,
    uuid UUID UNIQUE DEFAULT gen_random_uuid(),           -- untuk invite & relasi aman ke Supabase chat
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,  -- null jika invited user belum register

    full_name VARCHAR(255) NOT NULL,
    gender VARCHAR(10) NOT NULL CHECK (gender IN ('male', 'female')),
    birth_date DATE,
    death_date DATE,
    photo_url TEXT,
    is_alive BOOLEAN DEFAULT true,

    -- Privacy: relationship data (spouse, children, parents) WAJIB public
    -- Data pribadi boleh user atur
    phone_is_public BOOLEAN DEFAULT false,
    birth_date_is_public BOOLEAN DEFAULT false,
    death_date_is_public BOOLEAN DEFAULT false,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index untuk traversal cepat + lookup via UUID
CREATE INDEX idx_nodes_user_id ON nodes(user_id);
CREATE INDEX idx_nodes_uuid ON nodes(uuid);

-- ============================================================================
-- 3. MARRIAGES (spouse relations dengan history & status)
-- Setiap pernikahan adalah record terpisah (bisa multiple seumur hidup)
-- ============================================================================
CREATE TABLE marriages (
    id SERIAL PRIMARY KEY,
    husband_node_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    wife_node_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,

    status VARCHAR(20) NOT NULL DEFAULT 'married' 
        CHECK (status IN ('married', 'divorced', 'widowed', 'annulled')),

    marriage_date DATE,
    divorce_date DATE,
    marriage_location TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hanya boleh ada 1 marriage aktif antara pasangan yang sama
CREATE UNIQUE INDEX idx_marriages_active_couple 
    ON marriages(husband_node_id, wife_node_id) 
    WHERE status = 'married';

CREATE INDEX idx_marriages_husband ON marriages(husband_node_id);
CREATE INDEX idx_marriages_wife ON marriages(wife_node_id);
CREATE INDEX idx_marriages_status ON marriages(status);

-- ============================================================================
-- 4. PARENT_CHILD_RELATIONS (relasi orang tua - anak)
-- Bisa father atau mother. Mendukung blended family.
-- ============================================================================
CREATE TABLE parent_child_relations (
    id SERIAL PRIMARY KEY,
    parent_node_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    child_node_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    parent_type VARCHAR(10) NOT NULL CHECK (parent_type IN ('father', 'mother')),

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(parent_node_id, child_node_id, parent_type)
);

CREATE INDEX idx_parent_child_parent ON parent_child_relations(parent_node_id);
CREATE INDEX idx_parent_child_child ON parent_child_relations(child_node_id);

-- ============================================================================
-- 5. NUCLEAR_FAMILIES (keluarga inti / household seperti KK)
-- Dibuat saat pernikahan. Ini unit untuk chat + dokumen + kultur.
-- ============================================================================
CREATE TABLE nuclear_families (
    id SERIAL PRIMARY KEY,
    uuid UUID UNIQUE DEFAULT gen_random_uuid(),           -- untuk sharing / invite
    name VARCHAR(255),                                    -- opsional, misal "Keluarga Bapak Ahmad"
    created_by_node_id INTEGER NOT NULL REFERENCES nodes(id),   -- suami/ayah sebagai pencipta

    -- Bisa ditandai sebagai "active" atau "historical"
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'dissolved')),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 6. NUCLEAR_FAMILY_MEMBERSHIPS (riwayat keanggotaan di nuclear family)
-- 1 orang hanya 1 active membership dalam satu waktu.
-- Membership bisa berakhir karena menikah / pindah.
-- Chat room membership terpisah dari ini (sticky).
-- ============================================================================
CREATE TABLE nuclear_family_memberships (
    id SERIAL PRIMARY KEY,
    nuclear_family_id INTEGER NOT NULL REFERENCES nuclear_families(id) ON DELETE CASCADE,
    node_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,

    role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('head', 'spouse', 'child', 'member')),

    join_reason VARCHAR(20) NOT NULL 
        CHECK (join_reason IN ('birth', 'marriage', 'adoption', 'invitation')),

    joined_at TIMESTAMPTZ DEFAULT NOW(),
    left_at TIMESTAMPTZ,                    -- null = masih aktif

    -- Denormalized untuk query cepat
    is_active BOOLEAN GENERATED ALWAYS AS (left_at IS NULL) STORED,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_nfm_node ON nuclear_family_memberships(node_id);
CREATE INDEX idx_nfm_family ON nuclear_family_memberships(nuclear_family_id);
CREATE INDEX idx_nfm_active ON nuclear_family_memberships(is_active) WHERE left_at IS NULL;

-- ============================================================================
-- INVITATIONS (Mendukung 3 cara undang)
-- ============================================================================
CREATE TABLE invitations (
    id SERIAL PRIMARY KEY,
    uuid UUID UNIQUE DEFAULT gen_random_uuid(),           -- untuk share link

    token VARCHAR(64) UNIQUE,                             -- secure token untuk share link (one-time use). NULL untuk undangan langsung ke user yang sudah punya node (via UUID)

    invited_by_node_id INTEGER NOT NULL REFERENCES nodes(id),

    -- Gender pengundang (penting untuk kasus undang user baru, terutama spouse)
    -- Digunakan untuk mengunci gender lawan saat registrasi via undangan
    inviter_gender VARCHAR(10) CHECK (inviter_gender IN ('male', 'female')),

    -- Target invitee
    invitee_email VARCHAR(255),                           -- untuk orang yang belum pernah daftar
    invitee_node_id INTEGER REFERENCES nodes(id),         -- untuk user yang sudah register (ketik ID)

    relationship_type VARCHAR(20) NOT NULL 
        CHECK (relationship_type IN ('spouse', 'child')),

    -- Jika mengundang sebagai anak, parent-nya siapa
    parent_node_id INTEGER REFERENCES nodes(id),

    -- Context keluarga yang mengundang
    nuclear_family_id INTEGER REFERENCES nuclear_families(id),

    status VARCHAR(20) DEFAULT 'pending' 
        CHECK (status IN ('pending', 'accepted', 'expired', 'revoked', 'used')),

    expires_at TIMESTAMPTZ,
    used_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_uuid ON invitations(uuid);
CREATE INDEX idx_invitations_invited_by ON invitations(invited_by_node_id);
CREATE INDEX idx_invitations_email ON invitations(invitee_email);
CREATE INDEX idx_invitations_node ON invitations(invitee_node_id);

-- ============================================================================
-- 7. CHAT ROOMS (disesuaikan)
-- Setiap nuclear_family punya minimal 1 chat room "keluarga inti".
-- Membership chat bersifat sticky (tidak otomatis keluar saat membership berakhir).
-- ============================================================================
-- Catatan: Implementasi aktual chat_rooms dan chat membership akan disesuaikan
-- nanti setelah core tree + nuclear family selesai.
-- chat_rooms akan punya kolom nuclear_family_id.

-- ============================================================================
-- FINAL: Tambahkan kolom current reference setelah semua tabel dibuat
-- ============================================================================
-- Kolom ini tidak bisa dibuat di awal karena forward reference (circular dependency)
ALTER TABLE nodes 
  ADD COLUMN current_nuclear_family_id INTEGER 
  REFERENCES nuclear_families(id) ON DELETE SET NULL;

ALTER TABLE nodes 
  ADD COLUMN current_marriage_id INTEGER 
  REFERENCES marriages(id) ON DELETE SET NULL;

-- Index untuk kolom baru
CREATE INDEX idx_nodes_current_family ON nodes(current_nuclear_family_id);
CREATE INDEX idx_nodes_current_marriage ON nodes(current_marriage_id);

-- ============================================================================
-- 8. CATATAN PENTING IMPLEMENTASI
-- ============================================================================
/*
1. Saat dua orang menikah:
   - Buat 1 record di marriages
   - Buat 1 nuclear_family baru
   - Buat 2 nuclear_family_memberships (keduanya aktif)
   - Update current_nuclear_family_id dan current_marriage_id di kedua node

2. Saat lahir anak:
   - Buat node anak
   - Buat parent_child_relations (father + mother)
   - Tambahkan membership anak ke nuclear_family ayah

3. Saat anak (laki/perempuan) menikah:
   - Buat nuclear_family baru + marriage baru
   - Set left_at pada membership lama (keluar dari family ayah)
   - Buat membership baru di family baru
   - Update current_nuclear_family_id + current_marriage_id
   - Chat: tetap di room lama + ditambah ke room baru (sticky)

4. Visualisasi tree:
   - Mulai dari node user yang login
   - Traverse marriages + parent_child_relations
   - Tidak bergantung pada nuclear_families

5. Privacy:
   - Kolom *_is_public di nodes mengatur tampilan detail pribadi
   - Relationship data (dari marriages & parent_child) selalu boleh dilihat
     oleh siapa pun yang terhubung lewat graph

6. Invitation (3 cara):
   - Ketik node_uuid / user ID (sudah register) → langsung buat relationship
   - Ketik email (belum register) → buat invitation + nanti saat daftar langsung konek
   - Share link (uuid + token) → expired + one-time use, pilih tipe (spouse/child)
*/

-- =============================================================================
-- END OF CLEAN SCHEMA v1
-- =============================================================================
