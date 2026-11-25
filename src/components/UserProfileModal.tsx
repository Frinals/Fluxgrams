import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, Profile } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { BackIcon, PlayIcon, PauseIcon, VerifiedIcon, HeartIcon } from '@/components/Icons';

export default function UserProfileModal({ profileId, onClose }: any) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [songs, setSongs] = useState<any[]>([]);
  
  // Стейты плеера
  const [currentSong, setCurrentSong] = useState<any | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    // Загрузка профиля, постов и песен
    const load = async () => {
      const { data: p } = await supabase.from('profiles').select('*').eq('id', profileId).single();
      if (p) setProfile(p);

      const { data: po } = await supabase.from('user_posts').select('*, post_likes(count), post_views(count)').eq('user_id', profileId).order('created_at', { ascending: false });
      if (po) setPosts(po);

      const { data: so } = await supabase.from('user_songs').select('*').eq('user_id', profileId);
      if (so) setSongs(so);
    };
    load();
  }, [profileId]);

  const togglePlay = (song: any) => {
    if (currentSong?.id === song.id) {
      if (isPlaying) audioRef.current?.pause(); else audioRef.current?.play();
      setIsPlaying(!isPlaying);
    } else {
      setCurrentSong(song);
      setIsPlaying(true);
      setTimeout(() => audioRef.current?.play(), 100);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const p = (audioRef.current.currentTime / audioRef.current.duration) * 100;
      setProgress(p);
    }
  };

  if (!profile) return null;

  return (
    <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="fixed inset-0 z-[100] flex flex-col bg-[#0f1115] overflow-y-auto">
      {/* Шапка и Баннер */}
      <div className="relative h-48 bg-gradient-to-r from-blue-600 to-purple-600">
        {profile.banner_url && <img src={profile.banner_url} className="absolute inset-0 w-full h-full object-cover" />}
        <button onClick={onClose} className="absolute top-4 left-4 p-2 bg-black/40 rounded-full text-white z-10"><BackIcon size={24} /></button>
        <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 w-24 h-24 rounded-full border-4 border-[#0f1115] overflow-hidden">
          {profile.avatar_url ? <img src={profile.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-blue-500" />}
        </div>
      </div>

      <div className="mt-16 flex flex-col items-center px-4">
        <div className="flex items-center gap-1.5">
          <h2 className="text-2xl font-bold text-white">{profile.display_name}</h2>
          {profile.is_verified && <VerifiedIcon size={24} />}
        </div>
        <p className="text-gray-400">@{profile.username}</p>

        {/* ПЛЕЕР (Как в ТГ) */}
        {songs.length > 0 && (
          <div className="w-full max-w-sm mt-6 bg-[#1a1a1a] rounded-2xl border border-white/10 p-3">
            {songs.map(s => (
              <div key={s.id} onClick={() => togglePlay(s)} className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-xl cursor-pointer">
                <button className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white">
                  {currentSong?.id === s.id && isPlaying ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm truncate">{s.title}</p>
                  <p className="text-gray-400 text-xs truncate">{s.artist}</p>
                </div>
              </div>
            ))}
            {/* Полоса перемотки для текущей песни */}
            {currentSong && (
              <div className="mt-3 px-2">
                <input type="range" min="0" max="100" value={progress} readOnly className="w-full h-1 accent-blue-500" />
              </div>
            )}
            <audio ref={audioRef} src={currentSong?.url} onTimeUpdate={handleTimeUpdate} onEnded={() => setIsPlaying(false)} />
          </div>
        )}

        {/* ПОСТЫ */}
        <div className="w-full max-w-sm mt-8 pb-10 space-y-4">
          <h3 className="text-white font-bold text-lg">Посты</h3>
          {posts.length === 0 ? (
            <p className="text-gray-500 text-center text-sm">Еще нет постов</p>
          ) : (
            posts.map(post => (
              <div key={post.id} className="bg-[#1a1a1a] p-4 rounded-2xl border border-white/10">
                <p className="text-white text-sm mb-3">{post.content}</p>
                <div className="flex items-center justify-between text-gray-500 text-xs">
                  <div className="flex items-center gap-4">
                    <button className="flex items-center gap-1 hover:text-red-500 transition-colors">
                      <HeartIcon size={16} /> {post.post_likes?.[0]?.count || 0}
                    </button>
                    <span>👁️ {post.post_views?.[0]?.count || 0}</span>
                  </div>
                  <span>{new Date(post.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </motion.div>
  );
}
