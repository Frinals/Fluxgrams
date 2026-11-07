/*
# Fluxgram Messenger Schema

## Overview
Complete schema for a real-time messenger app with user profiles, 1-on-1 chats,
messages (text, media, voice), emoji reactions, disappearing messages, and a call system.

## New Tables
1. profiles — extends auth.users with public profile info (username, display_name, avatar, bio)
2. chats — represents a 1-on-1 conversation between two users
3. chat_participants — links users to chats (many-to-many, with last_read_at)
4. messages — individual messages (text, media_url, media_type, disappearing, expires_at)
5. reactions — emoji reactions on messages
6. calls — call log/signaling records (caller, receiver, status, call_type)

## Security (RLS)
- profiles: read all (for search), insert/update own only
- chats: access only chats user participates in
- chat_participants: read in shared chats, insert/update own
- messages: CRUD in chats user participates in; sender-only for update/delete
- reactions: read in shared chats, insert/delete own
- calls: read/insert/update calls involving the user
- All scoped to authenticated (app requires sign-in)
*/

-- ============ TABLES (created first, policies after) ============

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE,
  display_name text,
  avatar_url text,
  bio text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at timestamptz DEFAULT now(),
  UNIQUE(chat_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  content text,
  media_url text,
  media_type text CHECK (media_type IN ('image', 'video', 'audio')),
  disappearing boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(message_id, user_id)
);

CREATE TABLE IF NOT EXISTS calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  caller_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'ended', 'missed')),
  call_type text NOT NULL DEFAULT 'audio' CHECK (call_type IN ('audio', 'video')),
  created_at timestamptz DEFAULT now(),
  ended_at timestamptz
);

-- ============ ENABLE RLS ============
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

-- ============ GRANTS ============
GRANT SELECT, UPDATE, INSERT ON profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON chats TO authenticated;
GRANT SELECT, INSERT, UPDATE ON chat_participants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON messages TO authenticated;
GRANT SELECT, INSERT, DELETE ON reactions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON calls TO authenticated;

-- ============ POLICIES ============

-- profiles
DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- chats
DROP POLICY IF EXISTS "chats_select_participant" ON chats;
CREATE POLICY "chats_select_participant" ON chats FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM chat_participants cp WHERE cp.chat_id = chats.id AND cp.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "chats_insert_participant" ON chats;
CREATE POLICY "chats_insert_participant" ON chats FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM chat_participants cp WHERE cp.chat_id = chats.id AND cp.user_id = auth.uid())
  );

-- chat_participants
DROP POLICY IF EXISTS "cp_select_own" ON chat_participants;
CREATE POLICY "cp_select_own" ON chat_participants FOR SELECT
  TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM chat_participants cp2 WHERE cp2.chat_id = chat_participants.chat_id AND cp2.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "cp_insert_own" ON chat_participants;
CREATE POLICY "cp_insert_own" ON chat_participants FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "cp_update_own" ON chat_participants;
CREATE POLICY "cp_update_own" ON chat_participants FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- messages
DROP POLICY IF EXISTS "messages_select_participant" ON messages;
CREATE POLICY "messages_select_participant" ON messages FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM chat_participants cp WHERE cp.chat_id = messages.chat_id AND cp.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "messages_insert_participant" ON messages;
CREATE POLICY "messages_insert_participant" ON messages FOR INSERT
  TO authenticated WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (SELECT 1 FROM chat_participants cp WHERE cp.chat_id = messages.chat_id AND cp.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "messages_update_sender" ON messages;
CREATE POLICY "messages_update_sender" ON messages FOR UPDATE
  TO authenticated USING (sender_id = auth.uid()) WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS "messages_delete_sender" ON messages;
CREATE POLICY "messages_delete_sender" ON messages FOR DELETE
  TO authenticated USING (sender_id = auth.uid());

-- reactions
DROP POLICY IF EXISTS "reactions_select_participant" ON reactions;
CREATE POLICY "reactions_select_participant" ON reactions FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN chat_participants cp ON cp.chat_id = m.chat_id
      WHERE m.id = reactions.message_id AND cp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "reactions_insert_participant" ON reactions;
CREATE POLICY "reactions_insert_participant" ON reactions FOR INSERT
  TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM messages m
      JOIN chat_participants cp ON cp.chat_id = m.chat_id
      WHERE m.id = reactions.message_id AND cp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "reactions_delete_own" ON reactions;
CREATE POLICY "reactions_delete_own" ON reactions FOR DELETE
  TO authenticated USING (user_id = auth.uid());

-- calls
DROP POLICY IF EXISTS "calls_select_involved" ON calls;
CREATE POLICY "calls_select_involved" ON calls FOR SELECT
  TO authenticated USING (caller_id = auth.uid() OR receiver_id = auth.uid());

DROP POLICY IF EXISTS "calls_insert_caller" ON calls;
CREATE POLICY "calls_insert_caller" ON calls FOR INSERT
  TO authenticated WITH CHECK (caller_id = auth.uid());

DROP POLICY IF EXISTS "calls_update_involved" ON calls;
CREATE POLICY "calls_update_involved" ON calls FOR UPDATE
  TO authenticated USING (caller_id = auth.uid() OR receiver_id = auth.uid())
  WITH CHECK (caller_id = auth.uid() OR receiver_id = auth.uid());

-- ============ INDEXES ============
CREATE INDEX IF NOT EXISTS idx_chat_participants_user ON chat_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_chat ON chat_participants(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id, created_at);
CREATE INDEX IF NOT EXISTS idx_reactions_message ON reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_calls_receiver ON calls(receiver_id, status);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);

-- ============ TRIGGER: auto-create profile on signup ============
-- search_path must be set explicitly for SECURITY DEFINER functions in Supabase
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, split_part(NEW.email, '@', 1))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();