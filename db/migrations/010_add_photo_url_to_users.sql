-- Migration 010: Add photo_url to users table for profile photos
-- Photos will be stored locally in public/uploads/profiles/

ALTER TABLE users
ADD COLUMN IF NOT EXISTS photo_url TEXT;

COMMENT ON COLUMN users.photo_url IS 'URL/path to user profile photo, stored locally in /uploads/profiles/';