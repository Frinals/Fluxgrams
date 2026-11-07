/*
# Fix chats INSERT policy — chicken-and-egg bug

## Problem
The `chats_insert_participant` policy required a `chat_participants` row to already
exist for the chat being inserted. But for a brand-new chat, no participants exist yet,
so the INSERT always failed with an RLS denial. This made "Start Chat" silently do nothing.

## Fix
- Replace the chats INSERT policy: allow any authenticated user to insert a new chat row.
  The chat row itself contains no sensitive data (just id + created_at). Access control
  is enforced at the chat_participants level — only participants can read the chat or
  insert messages.
- Keep the SELECT policy as-is (participant check).
*/

DROP POLICY IF EXISTS "chats_insert_participant" ON chats;

CREATE POLICY "chats_insert_any_authenticated" ON chats FOR INSERT
  TO authenticated WITH CHECK (true);