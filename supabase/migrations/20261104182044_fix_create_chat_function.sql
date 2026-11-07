/*
# Fix: Create chat with participant function

## Problem
When user A starts a chat with user B, two rows must be inserted into chat_participants:
one for A, one for B. But the RLS policy `cp_insert_own` only allows inserting rows where
`user_id = auth.uid()`. The insert for B's row is denied by RLS, causing the entire
chat creation to fail silently.

## Fix
Create a SECURITY DEFINER function `create_chat_with_participants` that:
1. Inserts a new row into `chats`
2. Inserts BOTH participant rows (caller + peer) with system privileges, bypassing RLS
3. Returns the new chat ID
This is safe because the function only uses the caller's auth.uid() as the first participant
and the provided peer_id as the second — the caller cannot forge arbitrary participant pairs.
*/

CREATE OR REPLACE FUNCTION public.create_chat_with_participants(peer_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_chat_id uuid;
  caller_id uuid := auth.uid();
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF peer_id IS NULL OR peer_id = caller_id THEN
    RAISE EXCEPTION 'Invalid peer_id';
  END IF;

  -- Check if a chat already exists between these two users
  SELECT c.id INTO new_chat_id
  FROM chats c
  WHERE EXISTS (
    SELECT 1 FROM chat_participants cp1
    WHERE cp1.chat_id = c.id AND cp1.user_id = caller_id
  ) AND EXISTS (
    SELECT 1 FROM chat_participants cp2
    WHERE cp2.chat_id = c.id AND cp2.user_id = peer_id
  )
  -- Only return chats with exactly 2 participants
  AND (
    SELECT count(*) FROM chat_participants cp3 WHERE cp3.chat_id = c.id
  ) = 2
  LIMIT 1;

  IF new_chat_id IS NOT NULL THEN
    RETURN new_chat_id;
  END IF;

  -- Create new chat
  INSERT INTO chats (id) VALUES (gen_random_uuid())
  RETURNING id INTO new_chat_id;

  -- Insert both participants
  INSERT INTO chat_participants (chat_id, user_id) VALUES
    (new_chat_id, caller_id),
    (new_chat_id, peer_id);

  RETURN new_chat_id;
END;
$$;

-- Revoke public access, grant only to authenticated
REVOKE EXECUTE ON FUNCTION public.create_chat_with_participants(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_chat_with_participants(uuid) TO authenticated;