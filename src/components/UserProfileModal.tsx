import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { supabase, Profile } from '@/lib/supabase';
import { BackIcon, PlayIcon, PauseIcon, GiftIcon } from '@/components/Icons';

interface Props {
  profileId: string;
  onClose: () => void;
}

export default function UserProfileModal({ profileId, onClose }: Props) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data } = await supabase.from('profiles').select('*').eq('id', profileId).single();
      if (data) {
        setProfile(data as Profile);
        if (data.last_seen) {
          const lastSeen = new Date(data.last_seen).getTime();
          const now = new Date().getTime();
          setIsOnline(now - lastSeen < 5 * 60 * 1000);
        }
      }
    };
    fetchProfile();
  }, [profileId]);

  if (!profile) return null;

  const toggleMusic = () => {
    if (!audioRef.current) return;
    if (playing) audioRef.current.pause(); else audioRef.current.play();
    setPlaying(!playing);
  };

  const initials = (profile.display_name || profile.username || '?').slice(0, 2).toUpperCase();

  return (
    <motion.div 
      initial={{ y: "100%" }} 
      animate={{ y: 0 }} 
      exit={{ y: "100%" }} 
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className="fixed inset-0 z-[100] flex flex-col overflow-y-auto" 
      style={{ background: 'var(--app-bg)' }}
    >
      <div className="sticky top-0 z-10 p-4 flex items-center">
        <button onClick={onClose} className="p-2 rounded-full bg-black/20 text-white backdrop-blur-md">
          <BackIcon size={24} />
        </button>
      </div>

      <div className="relative h-48 bg-gradient-to-r from-blue-600 to-purple-600 flex justify-center items-end pb-0">
        {(profile as any).banner_url && <img src={(profile as any).banner_url} className="absolute inset-0 w-full h-full object-cover" />}
        <div className="relative z-10 absolute -bottom-12 w-24 h-24 rounded-full border-4 border-[var(--app-bg)] flex items-center justify-center text-3xl font-bold text-white shadow-xl" style={{ background: 'var(--app-accent)' }}>
          {profile.avatar_url ? <img src={profile.avatar_url} className="w-full h-full rounded-full object-cover" /> : initials}
        </div>
      </div>

      <div className="mt-16 flex flex-col items-center px-4">
        <h2 className="text-2xl font-bold" style={{ color: 'var(--app-text)' }}>{profile.display_name || profile.username}</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--app-text-muted)' }}>@{profile.username}</p>
        
        <p className={`text-xs mt-1 font-medium ${isOnline ? 'text-green-500' : 'text-gray-500'}`}>
          {isOnline ? 'В сети' : 'Был(а) недавно'}
        </p>

        {profile.bio && (
          <p className="text-center mt-4 text-sm max-w-xs" style={{ color: 'var(--app-text)' }}>{profile.bio}</p>
        )}

        {profile.profile_song_url && (
          <div className="w-full max-w-sm mt-6 p-3 rounded-2xl flex items-center gap-3 border" style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
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

        <div className="w-full max-w-sm mt-8 mb-10">
          <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--app-text)' }}>
            <GiftIcon size={18} /> Подарки
          </h3>
          <div className="p-4 rounded-2xl border text-center text-sm" style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)', color: 'var(--app-text-muted)' }}>
            Пока нет подарков 🎁
          </div>
        </div>
      </div>
    </motion.div>
  );
}
