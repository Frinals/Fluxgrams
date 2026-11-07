/*
# Add ghost_mode column to profiles

## Overview
Adds a `ghost_mode` boolean column to the profiles table. When enabled,
the user's online status is hidden from other users.

## New Columns
- `profiles.ghost_mode` (boolean, default false) — hides online status when true

## Security
- No new tables. RLS already enabled on profiles.
- Existing UPDATE policy (profiles_update_own) already covers new column.
- Existing SELECT policy (profiles_select_all) already allows reading.
*/

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ghost_mode boolean NOT NULL DEFAULT false;