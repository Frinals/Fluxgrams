/*
# Add Stories Table

## Summary
Creates a `stories` table for the Stories/Status feature. Users can upload
photo or video stories that expire after a chosen time (6/12/24 hours).
Stories have privacy settings (everyone / contacts).

## New Tables
### `stories`
- `id` (uuid, PK, default gen_random_uuid())
- `user_id` (uuid, NOT NULL, references auth.users, ON DELETE CASCADE) — owner
- `media_url` (text, NOT NULL) — URL to the uploaded media in storage
- `media_type` (text, NOT NULL) — 'image' or 'video'
- `caption` (text, nullable) — optional text caption
- `privacy` (text, NOT NULL, default 'everyone') — 'everyone' or 'contacts'
- `expires_at` (timestamptz, NOT NULL) — when the story auto-expires
- `created_at` (timestamptz, default now())

## Security
- RLS enabled on `stories`
- Grant SELECT, INSERT, DELETE to `authenticated`
- SELECT: users can read non-expired stories; if privacy='contacts', only
  users who share a chat can see them; users can always see their own
- INSERT: users can only insert their own stories (user_id = auth.uid())
- DELETE: users can only delete their own stories
- Index on user_id and expires_at for query performance
*/

CREATE TABLE IF NOT EXISTS stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  media_url text NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('image', 'video')),
  caption text,
  privacy text NOT NULL DEFAULT 'everyone' CHECK (privacy IN ('everyone', 'contacts')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE stories ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_stories_user_id ON stories(user_id);
CREATE INDEX IF NOT EXISTS idx_stories_expires_at ON stories(expires_at);

GRANT SELECT, INSERT, DELETE ON stories TO authenticated;

DROP POLICY IF EXISTS "select_stories" ON stories;
CREATE POLICY "select_stories" ON stories FOR SELECT
  TO authenticated USING (
    expires_at > now()
    AND (
      user_id = auth.uid()
      OR privacy = 'everyone'
      OR (
        privacy = 'contacts'
        AND EXISTS (
          SELECT 1 FROM chat_participants cp1
          JOIN chat_participants cp2 ON cp1.chat_id = cp2.chat_id
          WHERE cp1.user_id = stories.user_id
            AND cp2.user_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "insert_own_stories" ON stories;
CREATE POLICY "insert_own_stories" ON stories FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_stories" ON stories;
CREATE POLICY "delete_own_stories" ON stories FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
