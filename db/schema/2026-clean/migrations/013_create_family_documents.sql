-- db/schema/2026-clean/migrations/013_create_family_documents.sql
-- Create family_documents table aligned with new nuclear families schema
CREATE TABLE IF NOT EXISTS family_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_uuid UUID NOT NULL,
  uploaded_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- File information
  file_name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL CHECK (file_size > 0),
  mime_type TEXT NOT NULL,

  -- Sharing / Visibility
  visibility_scope TEXT NOT NULL DEFAULT 'private'
    CHECK (visibility_scope IN ('private', 'family', 'small_family', 'specific_users', 'extended')),

  small_family_uuid UUID,
  recipient_user_ids INTEGER[],

  description TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_family_documents_family_uuid ON family_documents(family_uuid);
CREATE INDEX IF NOT EXISTS idx_family_documents_uploaded_by ON family_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_family_documents_visibility ON family_documents(visibility_scope);

COMMENT ON TABLE family_documents IS 'Family documents with sharing scopes for nuclear/extended visibility';
COMMENT ON COLUMN family_documents.visibility_scope IS 'private = uploader only, family = all nuclear family members, small_family = specific core family, specific_users = selected users';