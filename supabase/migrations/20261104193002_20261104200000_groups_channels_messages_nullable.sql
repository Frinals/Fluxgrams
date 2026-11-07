/*
# Groups & Channels: make messages.chat_id nullable + update reactions policies

## Overview
The groups/group_members tables and messages.group_id column were already added
in a prior migration. However, messages.chat_id is still NOT NULL, which prevents
group messages (which set group_id instead of chat_id) from being inserted.
This migration:
1. Makes messages.chat_id nullable so group messages can use group_id instead.
2. Updates reactions SELECT/INSERT policies to also work with group messages
   (checking group membership when the message has a group_id).
3. Adds DELETE policy for messages that was missing (only sender can delete).

## Changes
- ALTER TABLE messages: chat_id DROP NOT NULL
- DROP + CREATE reactions_select_participant: now checks both chat and group membership
- DROP + CREATE reactions_insert_participant: same dual check
- DROP + CREATE messages_delete_sender: allows sender to delete their own messages

## Security
- No new tables. RLS already enabled on messages and reactions.
- Reactions SELECT: user must be chat participant OR group member of the message's group
- Reactions INSERT: same check + user_id = auth.uid()
- Messages DELETE: only the original sender can delete
*/

-- Make chat_id nullable so group messages can set group_id instead
ALTER TABLE public.messages ALTER COLUMN chat_id DROP NOT NULL;

-- Update reactions SELECT policy to support both chat and group messages
DROP POLICY IF EXISTS "reactions_select_participant" ON public.reactions;
CREATE POLICY "reactions_select_participant" ON public.reactions FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM messages m
      WHERE m.id = reactions.message_id
      AND (
        (m.chat_id IS NOT NULL AND private.is_chat_participant(m.chat_id, auth.uid()))
        OR
        (m.group_id IS NOT NULL AND private.is_group_member(m.group_id, auth.uid()))
      )
    )
  );

-- Update reactions INSERT policy to support both chat and group messages
DROP POLICY IF EXISTS "reactions_insert_participant" ON public.reactions;
CREATE POLICY "reactions_insert_participant" ON public.reactions FOR INSERT
  TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM messages m
      WHERE m.id = reactions.message_id
      AND (
        (m.chat_id IS NOT NULL AND private.is_chat_participant(m.chat_id, auth.uid()))
        OR
        (m.group_id IS NOT NULL AND private.is_group_member(m.group_id, auth.uid()))
      )
    )
  );

-- Add messages DELETE policy (was missing in original schema)
DROP POLICY IF EXISTS "messages_delete_sender" ON public.messages;
CREATE POLICY "messages_delete_sender" ON public.messages FOR DELETE
  TO authenticated USING (sender_id = auth.uid());