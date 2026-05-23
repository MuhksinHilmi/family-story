-- Migration 015: Create family_documents table
-- Supports Google Drive-like document storage with flexible sharing

CREATE TABLE family_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_uuid uuid NOT NULL,
  uploaded_by integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- File information
  file_name text NOT NULL,           -- sanitized filename stored on disk
  original_name text NOT NULL,       -- original filename from user
  file_path text NOT NULL,           -- relative path: uploads/documents/{family_uuid}/{uploaded_by_user_id}/{file_name}
  file_size bigint NOT NULL CHECK (file_size > 0),
  mime_type text NOT NULL,

  -- Sharing / Visibility
  visibility_scope text NOT NULL DEFAULT 'private'
    CHECK (visibility_scope IN ('private', 'family', 'small_family', 'specific_users')),

  small_family_uuid uuid,            -- only used when visibility_scope = 'small_family'
  recipient_user_ids uuid[],         -- only used when visibility_scope = 'specific_users'

  description text,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_family_documents_family_uuid ON family_documents(family_uuid);
CREATE INDEX idx_family_documents_uploaded_by ON family_documents(uploaded_by);
CREATE INDEX idx_family_documents_visibility ON family_documents(visibility_scope);

-- Optional: prevent duplicate small_family_uuid when not needed
ALTER TABLE family_documents
  ADD CONSTRAINT check_small_family_when_needed
  CHECK (
    (visibility_scope = 'small_family' AND small_family_uuid IS NOT NULL) OR
    (visibility_scope != 'small_family' AND small_family_uuid IS NULL)
  );

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_family_documents_updated_at
BEFORE UPDATE ON family_documents
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE family_documents IS 'Stores family documents with per-user storage tracking and flexible sharing scopes';
COMMENT ON COLUMN family_documents.visibility_scope IS 'private = only uploader, family = all family members, small_family = specific small family, specific_users = selected users';
COMMENT ON COLUMN family_documents.file_path IS 'Relative path under public/ for local storage (e.g. uploads/documents/{family_uuid}/{uploaded_by_user_id}/file.pdf)';
