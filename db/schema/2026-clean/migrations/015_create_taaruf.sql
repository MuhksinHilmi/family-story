-- ============================================================================
-- TA'ARUF - Islamic Matchmaking Feature for CeritaKeluarga
-- ============================================================================

-- Profil Ta'aruf
CREATE TABLE IF NOT EXISTS taaruf_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    node_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    
    full_name VARCHAR(255) NOT NULL,
    age INTEGER,
    location TEXT,
    education_level VARCHAR(100),
    occupation TEXT,
    about_me TEXT,
    interests TEXT[],
    
    photo_url TEXT,
    cover_photo TEXT,
    
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'matched', 'closed', 'hidden')),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Kriteria Pasangan
CREATE TABLE IF NOT EXISTS taaruf_criteria (
    id SERIAL PRIMARY KEY,
    profile_id INTEGER NOT NULL REFERENCES taaruf_profiles(id) ON DELETE CASCADE,
    
    age_min INTEGER,
    age_max INTEGER,
    preferred_education VARCHAR(100)[],
    preferred_location TEXT,
    preferred_marital_status VARCHAR(20) CHECK (preferred_marital_status IN ('never_married', 'divorced', 'widowed')),
    max_distance INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lamaran Ta'aruf
CREATE TABLE IF NOT EXISTS taaruf_applications (
    id SERIAL PRIMARY KEY,
    sender_profile_id INTEGER NOT NULL REFERENCES taaruf_profiles(id) ON DELETE CASCADE,
    recipient_profile_id INTEGER NOT NULL REFERENCES taaruf_profiles(id) ON DELETE CASCADE,
    
    message TEXT,
    letters JSONB,
    
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn', 'cancelled')),
    
    response_message TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    
    chat_room_id UUID REFERENCES chat_rooms(id),  -- UUID, bukan INTEGER
    
    UNIQUE(sender_profile_id, recipient_profile_id)
);

-- Trigger untuk updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Indeks (hanya bikin kalau belum ada)
CREATE INDEX IF NOT EXISTS idx_taaruf_profiles_user ON taaruf_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_taaruf_profiles_status ON taaruf_profiles(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_taaruf_applications_sender ON taaruf_applications(sender_profile_id);
CREATE INDEX IF NOT EXISTS idx_taaruf_applications_recipient ON taaruf_applications(recipient_profile_id);
CREATE INDEX IF NOT EXISTS idx_taaruf_applications_status ON taaruf_applications(status);

-- Room memberships (for taaruf chat rooms)
CREATE TABLE IF NOT EXISTS room_memberships (
  chat_room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (chat_room_id, user_id)
);