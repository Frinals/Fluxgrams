-- Add privacy settings columns to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS privacy_messages text NOT NULL DEFAULT 'everyone'
    CHECK (privacy_messages IN ('everyone', 'contacts', 'nobody')),
  ADD COLUMN IF NOT EXISTS privacy_calls text NOT NULL DEFAULT 'everyone'
    CHECK (privacy_calls IN ('everyone', 'contacts', 'nobody'));