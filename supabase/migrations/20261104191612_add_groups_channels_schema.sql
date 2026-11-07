-- ============================================================================
-- Groups & Channels schema
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  avatar_url text,
  type text NOT NULL DEFAULT 'group' CHECK (type IN ('group', 'channel')),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at timestamptz DEFAULT now(),
  UNIQUE (group_id, user_id)
);

-- Add group_id to messages (nullable — existing 1-on-1 messages keep using chat_id)
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON public.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON public.group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_group_id ON public.messages(group_id);

-- ============================================================================
-- RLS: groups table
-- ============================================================================
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated;

CREATE POLICY "groups_select_member" ON public.groups FOR SELECT
  TO authenticated USING (
    private.is_chat_participant(id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.group_members gm WHERE gm.group_id = groups.id AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "groups_insert_owner" ON public.groups FOR INSERT
  TO authenticated WITH CHECK (owner_id = auth.uid());

CREATE POLICY "groups_update_owner" ON public.groups FOR UPDATE
  TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "groups_delete_owner" ON public.groups FOR DELETE
  TO authenticated USING (owner_id = auth.uid());

-- ============================================================================
-- RLS: group_members table
-- ============================================================================
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON public.group_members TO authenticated;

-- Members can see who is in groups they belong to
CREATE POLICY "gm_select_member" ON public.group_members FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm2
      WHERE gm2.group_id = group_members.group_id AND gm2.user_id = auth.uid()
    )
  );

-- Anyone can join a group/channel (self-insert)
CREATE POLICY "gm_insert_self" ON public.group_members FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

-- Group owner can add members (by inserting rows)
CREATE POLICY "gm_insert_owner" ON public.group_members FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.owner_id = auth.uid()
    )
  );

-- Members can remove themselves; owners can remove anyone
CREATE POLICY "gm_delete_self_or_owner" ON public.group_members FOR DELETE
  TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- Messages: allow group messages (group_id set, chat_id can be a group reference)
-- We need to update the INSERT policy to also check group membership
-- ============================================================================
CREATE OR REPLACE FUNCTION private.is_group_member(p_group_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = p_group_id AND gm.user_id = p_user_id
  );
$$;

REVOKE EXECUTE ON FUNCTION private.is_group_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_group_member(uuid, uuid) TO authenticated;

-- Update messages INSERT policy to allow group messages from members
DROP POLICY IF EXISTS "messages_insert_participant" ON public.messages;
CREATE POLICY "messages_insert_participant" ON public.messages FOR INSERT
  TO authenticated WITH CHECK (
    sender_id = auth.uid()
    AND (
      (chat_id IS NOT NULL AND private.is_chat_participant(chat_id, auth.uid()))
      OR
      (group_id IS NOT NULL AND private.is_group_member(group_id, auth.uid()))
    )
  );

-- Update messages SELECT policy to allow group members to read group messages
DROP POLICY IF EXISTS "messages_select_participant" ON public.messages;
CREATE POLICY "messages_select_participant" ON public.messages FOR SELECT
  TO authenticated USING (
    (chat_id IS NOT NULL AND private.is_chat_participant(chat_id, auth.uid()))
    OR
    (group_id IS NOT NULL AND private.is_group_member(group_id, auth.uid()))
  );