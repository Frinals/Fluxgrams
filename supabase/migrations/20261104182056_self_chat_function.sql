/*
# Self-chat creation function (for Saved Messages)

Creates or returns a chat where the user is the SOLE participant.
Used for the "Saved Messages" feature.
*/

CREATE OR REPLACE FUNCTION public.get_or_create_self_chat()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  self_chat_id uuid;
  caller_id uuid := auth.uid();
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Find existing self-chat (chat with exactly 1 participant = caller)
  SELECT c.id INTO self_chat_id
  FROM chats c
  WHERE EXISTS (
    SELECT 1 FROM chat_participants cp
    WHERE cp.chat_id = c.id AND cp.user_id = caller_id
  )
  AND (
    SELECT count(*) FROM chat_participants cp2 WHERE cp2.chat_id = c.id
  ) = 1
  LIMIT 1;

  IF self_chat_id IS NOT NULL THEN
    RETURN self_chat_id;
  END IF;

  -- Create new self-chat
  INSERT INTO chats (id) VALUES (gen_random_uuid())
  RETURNING id INTO self_chat_id;

  INSERT INTO chat_participants (chat_id, user_id) VALUES (self_chat_id, caller_id);

  RETURN self_chat_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_or_create_self_chat() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_self_chat() TO authenticated;