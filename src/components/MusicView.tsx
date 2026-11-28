import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { PlayIcon, PauseIcon, BackIcon, HeartIcon, EyeIcon } from '@/components/Icons';
import { motion, AnimatePresence } from 'framer-motion';

export default function MusicView() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [songs, setSongs] = useState<any[]>([]);
  const [currentSong, setCurrentSong] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showFullPlayer, setShowFullPlayer] = useState(false);
  const [likes, setLikes] = useState<string[]>([]);
  const [plays, setPlays] = useState<string[]>([]);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const playTimeoutRef = useRef<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      const { data: profiles } = await supabase.from('profiles').select('id, display_name, avatar_url, banner_url, studio_song').not('studio_song', 'is', null);
      const { data: userLikes } = await supabase.from('music_likes').select('song_id').eq('user_id', user?.id);
      const { data: allPlays } = await supabase.from('music_plays').select('song_id');
      const { data: allLikes } = await supabase.from('music_likes').select('song_id');

      if (profiles) {
        const allSongs = profiles.map(p => {
          const songId = `${p.id}-${p.studio_song.title}`;
          return { 
            ...p.studio_song, 
            id: songId, 
            authorName: p.display_name, 
            authorAvatar: p.avatar_url, 
            authorBanner: p.banner_url,
            playsCount: allPlays?.filter(pl => pl.song_id === songId).length || 0,
            likesCount: allLikes?.filter(l => l.song_id === songId).length || 0
          };
        });
        setSongs(allSongs);
      }
      if (userLikes) setLikes(userLikes.map(l => l.song_id));
      if (allPlays) setPlays(allPlays.map(p => p.song_id)); // Здесь просто для триггера
    };
    fetchData();
  }, [user]);

  const filteredSongs = songs.filter(s => s.title.toLowerCase().includes(query.toLowerCase()) || s.artist.toLowerCase().includes(query.toLowerCase()));

  const playSong = (song: any) => {
    setCurrentSong(song);
    setIsPlaying(true);
    if (audioRef.current) {
      audioRef.current.src = song.url;
      audioRef.current.play();
      
      // Считаем прослушивание через 3 секунды
      clearTimeout(playTimeoutRef.current);
      playTimeoutRef.current = setTimeout(async () => {
        if (!plays.includes(song.id)) {
          await supabase.from('music_plays').insert({ song_id: song.id, user_id: user?.id });
          setPlays(prev => [...prev, song.id]);
          setSongs(prev => prev.map(s => s.id === song.id ? { ...s, playsCount: s.playsCount + 1 } : s));
        }
      }, 3000);
    }
  };

  const togglePlay = () => {
    if (isPlaying) audioRef.current?.pause();
    else audioRef.current?.play();
    setIsPlaying(!isPlaying);
  };

  const handleLike = async (songId: string, currentLikes: number) => {
    if (!user) return;
    const isLiked = likes.includes(songId);
    if (isLiked) {
      await supabase.from('music_likes').delete().eq('song_id', songId).eq('user_id', user.id);
      setLikes(prev => prev.filter(id => id !== songId));
      setSongs(prev => prev.map(s => s.id === songId ? { ...s, likesCount: currentLikes - 1 } : s));
    } else {
      await supabase.from('music_likes').insert({ song_id: songId, user_id: user.id });
      setLikes(prev => [...prev, songId]);
      setSongs(prev => prev.map(s => s.id === songId ? { ...s, likesCount: currentLikes + 1 } : s));
    }
  };

  return (
    <div className="flex flex-col h-full relative" style={{ background: 'var(--app-bg)' }}>
      <div className="p-4 sticky top-0 z-20 liquid-glass">
        <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--app-text)' }}>Музыка</h2>
        <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Поиск песен..." className="w-full px-4 py-3 rounded-2xl outline-none liquid-glass" style={{ color: 'var(--app-text)' }} />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2 pb-24">
        {filteredSongs.map(song => (
          <div key={song.id} onClick={() => { playSong(song); setShowFullPlayer(true); }} className="flex items-center gap-4 p-3 rounded-2xl liquid-glass cursor-pointer active:scale-95 transition-transform">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white" style={{ background: 'var(--app-accent)' }}>
              {currentSong?.id === song.id && isPlaying ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold truncate" style={{ color: 'var(--app-text)' }}>{song.title}</p>
              <p className="text-sm truncate" style={{ color: 'var(--app-text-muted)' }}>{song.artist}</p>
            </div>
          </div>
        ))}
      </div>

      {/* МИНИ-ПЛЕЕР */}
      <AnimatePresence>
        {currentSong && !showFullPlayer && (
          <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} onClick={() => setShowFullPlayer(true)} className="fixed bottom-[90px] left-3 right-3 z-40 p-3 rounded-2xl liquid-glass flex items-center gap-4 cursor-pointer">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white" style={{ background: 'var(--app-accent)' }}><span className="text-xl">🎵</span></div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate" style={{ color: 'var(--app-text)' }}>{currentSong.title}</p>
            </div>
            <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="w-8 h-8 rounded-full flex items-center justify-center text-white" style={{ background: 'var(--app-accent)' }}>
              {isPlaying ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ПОЛНОЭКРАННЫЙ ПЛЕЕР */}
      <AnimatePresence>
        {showFullPlayer && currentSong && (
          <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="fixed inset-0 z-[999] flex flex-col" style={{ background: 'var(--app-bg)' }}>
            <div className="relative h-1/2 w-full">
              {currentSong.authorBanner ? <img src={currentSong.authorBanner} className="w-full h-full object-cover blur-md opacity-50" /> : <div className="w-full h-full bg-gradient-to-br from-purple-600 to-black" />}
              <button onClick={() => setShowFullPlayer(false)} className="absolute top-6 left-6 p-2 bg-black/50 rounded-full text-white"><BackIcon size={24} /></button>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                 <div className="w-48 h-48 rounded-full border-4 border-white/20 shadow-2xl flex items-center justify-center overflow-hidden mb-6" style={{ background: 'var(--app-accent)' }}>
                   {currentSong.authorAvatar ? <img src={currentSong.authorAvatar} className="w-full h-full object-cover" /> : <span className="text-6xl">🎵</span>}
                 </div>
                 <h1 className="text-3xl font-bold text-white mb-2 text-center px-4">{currentSong.title}</h1>
                 <p className="text-lg text-white/70">{currentSong.artist}</p>
              </div>
            </div>
            
            <div className="flex-1 p-6 flex flex-col justify-center">
              <div className="flex justify-center gap-8 mb-8">
                <button onClick={() => handleLike(currentSong.id, currentSong.likesCount)} className="flex flex-col items-center gap-1">
                  <HeartIcon size={32} color={likes.includes(currentSong.id) ? '#ef4444' : 'var(--app-text)'} />
                  <span className="text-sm font-bold" style={{ color: 'var(--app-text)' }}>{currentSong.likesCount}</span>
                </button>
                <div className="flex flex-col items-center gap-1">
                  <EyeIcon size={32} color="var(--app-text-muted)" />
                  <span className="text-sm font-bold" style={{ color: 'var(--app-text-muted)' }}>{currentSong.playsCount}</span>
                </div>
              </div>

              <div className="flex justify-center items-center gap-8">
                <button onClick={togglePlay} className="w-20 h-20 rounded-full flex items-center justify-center text-white shadow-xl active:scale-90" style={{ background: 'var(--app-accent)' }}>
                  {isPlaying ? <PauseIcon size={32} /> : <PlayIcon size={32} />}
                </button>
              </div>
            </div>
            <audio ref={audioRef} onEnded={() => setIsPlaying(false)} className="hidden" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
