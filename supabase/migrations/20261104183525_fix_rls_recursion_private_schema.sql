-- ============================================================================
-- Fix: infinite recursion in RLS policies on chat_participants
-- ============================================================================
-- Problem: The cp_select_own policy on chat_participants contains a subquery
-- that reads from chat_participants, triggering the same RLS policy recursively.
-- Policies on chats, messages, and reactions also subquery chat_participants,
-- which triggers cp_select_own, which triggers itself again -> infinite recursion.
--
-- Fix: Create a SECURITY DEFINER function in a private schema that checks
-- chat participation with elevated privileges (bypassing RLS). Replace all
-- policy subqueries against chat_participants with calls to this function.
-- ============================================================================

-- 1. Create private schema (not exposed via Data API, functions are only called internally)
CREATE SCHEMA IF NOT EXISTS private;

-- 2. Create the helper function — SECURITY DEFINER bypasses RLS
CREATE OR REPLACE FUNCTION private.is_chat_participant(p_chat_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM chat_participants cp
    WHERE cp.chat_id = p_chat_id AND cp.user_id = p_user_id
  );
$$;

-- Revoke all access from public/anon, grant only to authenticated
REVOKE EXECUTE ON FUNCTION private.is_chat_participant(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_chat_participant(uuid, uuid) TO authenticated;

-- 3. Fix cp_select_own — replace self-referencing subquery with the helper
DROP POLICY IF EXISTS "cp_select_own" ON chat_participants;
CREATE POLICY "cp_select_own" ON chat_participants FOR SELECT
  TO authenticated USING (
    user_id = auth.uid()
    OR private.is_chat_participant(chat_id, auth.uid())
  );

-- 4. Fix chats_select_participant
DROP POLICY IF EXISTS "chats_select_participant" ON chats;
CREATE POLICY "chats_select_participant" ON chats FOR SELECT
  TO authenticated USING (
    private.is_chat_participant(id, auth.uid())
  );

-- 5. Fix messages_insert_participant
DROP POLICY IF EXISTS "messages_insert_participant" ON messages;
CREATE POLICY "messages_insert_participant" ON messages FOR INSERT
  TO authenticated WITH CHECK (
    sender_id = auth.uid()
    AND private.is_chat_participant(chat_id, auth.uid())
  );

-- 6. Fix messages_select_participant
DROP POLICY IF EXISTS "messages_select_participant" ON messages;
CREATE POLICY "messages_select_participant" ON messages FOR SELECT
  TO authenticated USING (
    private.is_chat_participant(chat_id, auth.uid())
  );

-- 7. Fix reactions_insert_participant
DROP POLICY IF EXISTS "reactions_insert_participant" ON reactions;
CREATE POLICY "reactions_insert_participant" ON reactions FOR INSERT
  TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM messages m
      WHERE m.id = reactions.message_id
        AND private.is_chat_participant(m.chat_id, auth.uid())
    )
  );

-- 8. Fix reactions_select_participant
DROP POLICY IF EXISTS "reactions_select_participant" ON reactions;
CREATE POLICY "reactions_select_participant" ON reactions FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM messages m
      WHERE m.id = reactions.message_id
        AND private.is_chat_participant(m.chat_id, auth.uid())
    )
  );