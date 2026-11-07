/*
# Add channel_username to groups + profile_song_url to profiles

## Overview
Adds two new optional columns:
1. `groups.channel_username` — unique, searchable username for channels (e.g. @mychannel)
2. `profiles.profile_song_url` — URL to an audio file for the user's "Profile Song" feature

## New Columns
- `groups.channel_username` (text, unique, nullable) — only set for channels, used for search/subscription
- `profiles.profile_song_url` (text, nullable) — URL to audio file for profile song

## Security
- No new tables. RLS already enabled on both.
- Existing UPDATE policies on profiles already cover new column (full row update).
- Existing SELECT policies on groups already allow reading channel_username.
- group_members INSERT (self-subscribe) already allowed by gm_insert_self policy.
- Added index on channel_username for search performance.
*/

-- Add channel_username to groups (unique, nullable)
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS channel_username text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_groups_channel_username ON public.groups(channel_username) WHERE channel_username IS NOT NULL;

-- Add profile_song_url to profiles (nullable)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_song_url text;