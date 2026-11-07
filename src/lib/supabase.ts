import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export interface Profile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  profile_song_url: string | null;
  ghost_mode: boolean;
  privacy_messages: string;
  privacy_calls: string;
  created_at: string;
}

export interface Chat {
  id: string;
  created_at: string;
}

export interface ChatParticipant {
  id: string;
  chat_id: string;
  user_id: string;
  last_read_at: string;
}

export interface Message {
  id: string;
  chat_id: string;
  group_id: string | null;
  sender_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  disappearing: boolean;
  expires_at: string | null;
  created_at: string;
}

export interface Reaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface Call {
  id: string;
  chat_id: string;
  caller_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'ended' | 'missed';
  call_type: 'audio' | 'video';
  created_at: string;
  ended_at: string | null;
}

export type GroupType = 'group' | 'channel';

export interface Group {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  type: GroupType;
  owner_id: string;
  channel_username: string | null;
  created_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
}

export type StoryPrivacy = 'everyone' | 'contacts';

export interface Story {
  id: string;
  user_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  caption: string | null;
  privacy: StoryPrivacy;
  expires_at: string;
  created_at: string;
}

export interface AccountSession {
  id: string;
  user_id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  is_current: boolean;
  created_at: string;
}
