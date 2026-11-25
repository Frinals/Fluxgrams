import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { supabase, Profile } from '@/lib/supabase';
import { BackIcon, PlayIcon, PauseIcon, GiftIcon, VerifiedIcon, ChatIcon, PhoneIcon } from '@/components/Icons';

export default function UserProfileModal({ profileId, onClose, onStartChat, onCall }: any) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'gifts'>('posts');
  const [posts, setPosts] = useState<any[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data } = await supabase.from('profiles').select('*').eq('id', profileId).single();
      if (data) {
        setProfile(data as Profile);
        if (data.last_seen) setIsOnline(new Date().getTime() - new Date(data.last_seen).getTime() < 300000);
      }
    };
    const fetchPosts = async () => {
      const { data } = await supabase.from('user_posts').select('*').eq('user_id', profileId).order('created_at', { ascending: false });
      if (data) setPosts(data);
    };
    fetchProfile();
    fetchPosts();
  }, [profileId]);

  if (!profile) return null;

  const toggleMusic = () => {
    if (!audioRef.current) return;
    if (playing) audioRef.current.pause(); else audioRef.current.play();
    setPlaying(!playing);
  };

  const initials = (profile.display_name || profile.username || '?').slice(0, 2).toUpperCase();
  const fontStyleClass = `font-${(profile as any)?.font_style || 'default'}`;
  const frameStyleClass = `frame-${(profile as any)?.avatar_frame || 'default'}`;

  return (
    <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="fixed inset-0 z-[100] flex flex-col overflow-y-auto" style={{ background: 'var(--app-bg)' }}>
      <div className="sticky top-0 z-10 p-4 flex items-center">
        <button onClick={onClose} className="p-2 rounded-full bg-black/20 text-white backdrop-blur-md"><BackIcon size={24} /></button>
      </div>

      <div className="relative h-48 bg-gradient-to-r from-blue-600 to-purple-600 flex justify-center items-end pb-0">
        {(profile as any).banner_url && <img src={(profile as any).banner_url} className="absolute inset-0 w-full h-full object-cover" />}
        <div className={`relative z-10 absolute -bottom-12 w-24 h-24 rounded-full border-4 flex items-center justify-center text-3xl font-bold text-white shadow-xl ${frameStyleClass}`} style={{ background: 'var(--app-accent)', borderColor: 'var(--app-bg)' }}>
          {profile.avatar_url ? <img src={profile.avatar_url} className="w-full h-full rounded-full object-cover" /> : initials}
        </div>
      </div>

      <div className="mt-16 flex flex-col items-center px-4">
        <div className="flex items-center justify-center gap-1.5">
          <h2 className={`text-2xl ${fontStyleClass}`} style={{ color: 'var(--app-text)' }}>{profile.display_name || profile.username}</h2>
          {(profile as any).is_verified && <VerifiedIcon size={24} />}
        </div>
        <p className="text-sm mt-1" style={{ color: 'var(--app-text-muted)' }}>@{profile.username}</p>
        <p className={`text-xs mt-1 font-medium ${isOnline ? 'text-green-500' : 'text-gray-500'}`}>{isOnline ? 'В сети' : 'Был(а) недавно'}</p>
        {profile.bio && <p className="text-center mt-4 text-sm max-w-xs" style={{ color: 'var(--app-text)' }}>{profile.bio}</p>}

        <div className="flex gap-2 mt-6 w-full max-w-xs">
          <button onClick={() => onStartChat && onStartChat(profile)} className="flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 font-medium text-white" style={{ background: 'var(--app-accent)' }}><ChatIcon size={18} /> Написать</button>
          <button onClick={() => onCall && onCall(profile, 'audio')} className="flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 font-medium border" style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)' }}><PhoneIcon size={18} /> Позвонить</button>
        </div>

        {profile.profile_song_url && (
          <div className="w-full max-w-sm mt-6 p-3 rounded-2xl flex items-center gap-3 border glass-panel" style={{ borderColor: 'var(--app-border)' }}>
            <button onClick={toggleMusic} className="w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: 'var(--app-accent)' }}>
              {playing ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
            </button>
            <div className="flex flex-col overflow-hidden">
              <span className="font-semibold text-sm truncate" style={{ color: 'var(--app-text)' }}>{profile.song_title || 'Без названия'}</span>
              <span className="text-xs truncate" style={{ color: 'var(--app-text-muted)' }}>{profile.song_artist || 'Неизвестный исполнитель'}</span>
            </div>
            <audio ref={audioRef} src={profile.profile_song_url} onEnded={() => setPlaying(false)} />
          </div>
        )}

        <div className="w-full max-w-sm mt-8">
          <div className="flex border-b" style={{ borderColor: 'var(--app-border)' }}>
            <button onClick={() => setActiveTab('posts')} className={`flex-1 py-2 text-center font-semibold ${activeTab === 'posts' ? 'border-b-2' : ''}`} style={{ color: activeTab === 'posts' ? 'var(--app-accent)' : 'var(--app-text-muted)', borderColor: 'var(--app-accent)' }}>Посты</button>
            <button onClick={() => setActiveTab('gifts')} className={`flex-1 py-2 text-center font-semibold ${activeTab === 'gifts' ? 'border-b-2' : ''}`} style={{ color: activeTab === 'gifts' ? 'var(--app-accent)' : 'var(--app-text-muted)', borderColor: 'var(--app-accent)' }}>Подарки</button>
          </div>
          <div className="py-4">
            {activeTab === 'posts' && (
              <div className="space-y-3">
                {posts.length === 0 ? <p className="text-center text-sm" style={{ color: 'var(--app-text-muted)' }}>Пока нет постов</p> : posts.map(post => (
                  <div key={post.id} className="p-3 rounded-xl border" style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
                    <p className="text-sm" style={{ color: 'var(--app-text)' }}>{post.content}</p>
                    <span className="text-xs mt-2 block" style={{ color: 'var(--app-text-muted)' }}>{new Date(post.created_at).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}
            {activeTab === 'gifts' && (
              <p className="text-center text-sm" style={{ color: 'var(--app-text-muted)' }}>Пока нет подарков 🎁</p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
