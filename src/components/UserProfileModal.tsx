import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { BackIcon, PlayIcon, PauseIcon, ImageIcon, VerifiedIcon, XIcon } from '@/components/Icons';

export default function UserProfileModal({ profileId, onClose }: any) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!profileId) return;
    setIsOwnProfile(profileId === user?.id);

    const fetchProfile = async () => {
      const { data } = await supabase.from('profiles').select('*').eq('id', profileId).single();
      if (data) setProfile(data);
      setLoading(false);
    };
    fetchProfile();
  }, [profileId, user]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'banner' | 'avatar' | 'music') => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    const fileName = `profile/${user.id}/${type}_${Date.now()}.${file.name.split('.').pop()}`;
    
    const { error } = await supabase.storage.from('media').upload(fileName, file);
    if (error) { alert(error.message); return; }

    const { data } = supabase.storage.from('media').getPublicUrl(fileName);

    if (type === 'music') {
      const newSong = { title: file.name.split('.')[0], url: data.publicUrl };
      const currentMusic = profile?.profile_music || [];
      const { data: updated } = await supabase.from('profiles').update({ profile_music: [...currentMusic, newSong] }).eq('id', user.id).select().single();
      if (updated) setProfile(updated);
    } else {
      const { data: updated } = await supabase.from('profiles').update({ [`${type}_url`]: data.publicUrl }).eq('id', user.id).select().single();
      if (updated) setProfile(updated);
    }
  };

  const playSong = (index: number, url: string) => {
    if (playingIndex === index) {
      if (isPlaying) audioRef.current?.pause();
      else audioRef.current?.play();
      setIsPlaying(!isPlaying);
    } else {
      setPlayingIndex(index);
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.src = url;
          audioRef.current.play();
          setIsPlaying(true);
        }
      }, 100);
    }
  };

  if (loading || !profile) return null;

  return (
    <div className="fixed inset-0 z-[999] bg-[#0f1115] flex flex-col overflow-y-auto">
      
      {/* Шапка с баннером */}
      <div className="relative w-full h-56 bg-gray-800 flex-shrink-0">
        {profile?.banner_url ? (
          <img src={profile.banner_url} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-blue-600 to-purple-600" />
        )}
        
        <button onClick={onClose} className="absolute top-4 left-4 p-2 bg-black/40 rounded-full text-white backdrop-blur-md z-10">
          <XIcon size={24} />
        </button>
        
        {isOwnProfile && (
          <>
            <button onClick={() => bannerInputRef.current?.click()} className="absolute top-4 right-4 p-2 bg-black/40 rounded-full text-white backdrop-blur-md z-10">
              <ImageIcon size={20} />
            </button>
            <input type="file" ref={bannerInputRef} hidden accept="image/*" onChange={(e) => handleUpload(e, 'banner')} />
          </>
        )}
      </div>

      {/* Аватарка и Инфо */}
      <div className="px-4 pb-24 relative flex flex-col items-center">
        <div className="relative -mt-16 mb-3">
          <div className="w-32 h-32 rounded-full border-4 border-[#0f1115] overflow-hidden bg-blue-500 flex items-center justify-center text-white text-4xl font-bold shadow-xl">
            {profile?.avatar_url ? <img src={profile.avatar_url} className="w-full h-full object-cover" /> : profile?.display_name?.[0] || 'U'}
          </div>
          {isOwnProfile && (
            <>
              <button onClick={() => avatarInputRef.current?.click()} className="absolute bottom-2 right-2 p-2 bg-blue-500 rounded-full text-white border-2 border-[#0f1115]">
                <ImageIcon size={16} />
              </button>
              <input type="file" ref={avatarInputRef} hidden accept="image/*" onChange={(e) => handleUpload(e, 'avatar')} />
            </>
          )}
        </div>

        <div className="text-center w-full max-w-md">
          <div className="flex items-center justify-center gap-1">
            <h2 className="text-2xl font-bold text-white">{profile?.display_name || 'User'}</h2>
            {profile?.is_verified && <VerifiedIcon size={22} className="text-blue-500" />}
          </div>
          <p className="text-gray-400 text-[15px] mb-3">@{profile?.username || 'user'}</p>
          <p className="text-white text-sm bg-white/5 py-3 px-4 rounded-2xl border border-white/10">{profile?.bio || 'Пользователь пока ничего не рассказал о себе.'}</p>
        </div>

        {/* Музыкальный плеер */}
        <div className="w-full max-w-md mt-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-white font-bold text-lg">Музыка</h3>
            {isOwnProfile && (
              <>
                <button onClick={() => musicInputRef.current?.click()} className="text-blue-500 text-sm font-semibold px-3 py-1 bg-blue-500/10 rounded-full">+ Добавить</button>
                <input type="file" ref={musicInputRef} hidden accept="audio/*" onChange={(e) => handleUpload(e, 'music')} />
              </>
            )}
          </div>
          
          <div className="bg-[#1a1a1a] rounded-2xl overflow-hidden border border-white/10">
            {(!profile?.profile_music || profile.profile_music.length === 0) ? (
              <p className="p-5 text-gray-500 text-center text-sm">Нет добавленных треков</p>
            ) : (
              profile.profile_music.map((song: any, idx: number) => (
                <div key={idx} onClick={() => playSong(idx, song.url)} className="flex items-center gap-3 p-4 hover:bg-white/5 cursor-pointer border-b border-white/5 last:border-0 transition-colors">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white flex-shrink-0 shadow-lg">
                    {playingIndex === idx && isPlaying ? <PauseIcon size={22} /> : <PlayIcon size={22} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-[15px] font-medium truncate">{song.title}</p>
                    <p className="text-gray-400 text-xs mt-0.5">Fluxgram Music</p>
                  </div>
                </div>
              ))
            )}
          </div>
          <audio ref={audioRef} onEnded={() => setIsPlaying(false)} className="hidden" />
        </div>
      </div>
    </div>
  );
}
