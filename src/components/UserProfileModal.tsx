import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { BackIcon, PlayIcon, PauseIcon, VerifiedIcon, HeartIcon } from '@/components/Icons';

export default function UserProfileModal({ profileId, onClose }: any) {
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [songs, setSongs] = useState<any[]>([]);
  const [currentSong, setCurrentSong] = useState<any | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const load = async () => {
      const { data: p } = await supabase.from('profiles').select('*').eq('id', profileId).single();
      if (p) setProfile(p);
      const { data: po } = await supabase.from('user_posts').select('*').eq('user_id', profileId).order('created_at', { ascending: false });
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

  if (!profile) return null;

  return (
    <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="fixed inset-0 z-[100] flex flex-col bg-[#0f1115] overflow-y-auto">
      <div className="relative h-48 bg-gradient-to-r from-blue-600 to-purple-600">
        {profile.banner_url && <img src={profile.banner_url} className="absolute inset-0 w-full h-full object-cover" />}
        <button onClick={onClose} className="absolute top-4 left-4 p-2 bg-black/40 rounded-full text-white z-10"><BackIcon size={24} /></button>
        <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 w-24 h-24 rounded-full border-4 border-[#0f1115] overflow-hidden">
          {profile.avatar_url ? <img src={profile.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-blue-500" />}
        </div>
      </div>

      <div className="mt-16 flex flex-col items-center px-4 pb-10">
        <div className="flex items-center gap-1.5">
          <h2 className="text-2xl font-bold text-white">{profile.display_name || profile.username}</h2>
          {profile.is_verified && <VerifiedIcon size={24} />}
        </div>
        <p className="text-gray-400 mb-4">@{profile.username}</p>

        {songs.length > 0 && (
          <div className="w-full max-w-sm bg-[#1a1a1a] rounded-2xl border border-white/10 p-3 mb-6">
            {songs.map(s => (
              <div key={s.id} onClick={() => togglePlay(s)} className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-xl cursor-pointer">
                <button className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white">
                  {currentSong?.id === s.id && isPlaying ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
                </button>
                <div className="flex-1 min-w-0"><p className="text-white font-semibold text-sm truncate">{s.title}</p></div>
              </div>
            ))}
            <audio ref={audioRef} src={currentSong?.url} onEnded={() => setIsPlaying(false)} />
          </div>
        )}

        <div className="w-full max-w-sm space-y-4">
          <h3 className="text-white font-bold text-lg">Посты</h3>
          {posts.length === 0 ? <p className="text-gray-500 text-center text-sm">Еще нет постов</p> : posts.map(post => (
            <div key={post.id} className="bg-[#1a1a1a] p-4 rounded-2xl border border-white/10">
              <p className="text-white text-sm mb-3">{post.content}</p>
              <div className="flex items-center gap-4 text-gray-500 text-xs">
                <span className="flex items-center gap-1"><HeartIcon size={16} /> {post.likes_count || 0}</span>
                <span>👁️ {post.views_count || 0}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
