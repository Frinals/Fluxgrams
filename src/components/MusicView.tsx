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
  
  const [userLikes, setUserLikes] = useState<string[]>([]);
  const [userPlays, setUserPlays] = useState<string[]>([]);
  const [currentLyricIndex, setCurrentLyricIndex] = useState(-1);

  const audioRef = useRef<HTMLAudioElement>(null);
  const playTimeoutRef = useRef<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      const { data: profiles } = await supabase.from('profiles').select('id, display_name, avatar_url, banner_url, studio_song').not('studio_song', 'is', null);
      const { data: userLikesData } = await supabase.from('music_likes').select('song_id').eq('user_id', user?.id);
      const { data: userPlaysData } = await supabase.from('music_plays').select('song_id').eq('user_id', user?.id);
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
      if (userLikesData) setUserLikes(userLikesData.map(l => l.song_id));
      if (userPlaysData) setUserPlays(userPlaysData.map(p => p.song_id));
    };
    fetchData();
  }, [user]);

  const filteredSongs = songs.filter(s => s.title.toLowerCase().includes(query.toLowerCase()) || s.artist.toLowerCase().includes(query.toLowerCase()));

  const handleTimeUpdate = () => {
    if (audioRef.current && currentSong?.lyrics) {
      const currentTime = audioRef.current.currentTime;
      const activeIndex = currentSong.lyrics.findIndex((line: any, index: number) => {
        const nextLine = currentSong.lyrics[index + 1];
        return currentTime >= line.time && (!nextLine || currentTime < nextLine.time);
      });
      if (activeIndex !== -1 && activeIndex !== currentLyricIndex) setCurrentLyricIndex(activeIndex);
    }
  };

  const playSong = async (song: any) => {
    setCurrentSong(song);
    setIsPlaying(true);
    setCurrentLyricIndex(-1);
    
    if (audioRef.current) {
      try {
        // ПРОСТОЙ И НАДЕЖНЫЙ СПОСОБ (без ломающегося кэша)
        audioRef.current.src = song.url;
        audioRef.current.volume = 1;
        const playPromise = audioRef.current.play();
        
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.error("Ошибка автовоспроизведения:", error);
            alert("Нажмите на кнопку Play еще раз, чтобы включить звук.");
            setIsPlaying(false);
          });
        }

        // СЧИТАЕМ ПРОСЛУШИВАНИЕ
        clearTimeout(playTimeoutRef.current);
        playTimeoutRef.current = setTimeout(async () => {
          if (!userPlays.includes(song.id)) {
            await supabase.from('music_plays').insert({ song_id: song.id, user_id: user?.id });
            setUserPlays(prev => [...prev, song.id]);
            setSongs(prev => prev.map(s => s.id === song.id ? { ...s, playsCount: s.playsCount + 1 } : s));
          }
        }, 3000);

      } catch (err) {
        console.error(err);
      }
    }
  };

  const togglePlay = () => {
    if (isPlaying) audioRef.current?.pause();
    else audioRef.current?.play();
    setIsPlaying(!isPlaying);
  };

  const handleLike = async (e: any, songId: string, currentLikes: number) => {
    e.stopPropagation();
    if (!user) return;
    const isLiked = userLikes.includes(songId);
    
    if (isLiked) {
      await supabase.from('music_likes').delete().eq('song_id', songId).eq('user_id', user.id);
      setUserLikes(prev => prev.filter(id => id !== songId));
      setSongs(prev => prev.map(s => s.id === songId ? { ...s, likesCount: currentLikes - 1 } : s));
      if (currentSong?.id === songId) setCurrentSong({ ...currentSong, likesCount: currentLikes - 1 });
    } else {
      await supabase.from('music_likes').insert({ song_id: songId, user_id: user.id });
      setUserLikes(prev => [...prev, songId]);
      setSongs(prev => prev.map(s => s.id === songId ? { ...s, likesCount: currentLikes + 1 } : s));
      if (currentSong?.id === songId) setCurrentSong({ ...currentSong, likesCount: currentLikes + 1 });
    }
  };

  return (
    <div className="flex flex-col h-full relative" style={{ background: 'var(--app-bg)' }}>
      <div className="p-4 sticky top-0 z-20 liquid-glass">
        <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--app-text)' }}>Музыка</h2>
        <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Поиск..." className="w-full px-4 py-3 rounded-2xl outline-none liquid-glass" style={{ color: 'var(--app-text)' }} />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2 pb-28">
        {filteredSongs.map(song => (
          <div key={song.id} onClick={() => { playSong(song); setShowFullPlayer(true); }} className="flex items-center gap-4 p-3 rounded-2xl liquid-glass cursor-pointer active:scale-95 transition-transform">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white overflow-hidden" style={{ background: 'var(--app-accent)' }}>
              {song.cover ? <img src={song.cover} className="w-full h-full object-cover" /> : (currentSong?.id === song.id && isPlaying ? <PauseIcon size={20} /> : <PlayIcon size={20} />)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold truncate" style={{ color: 'var(--app-text)' }}>{song.title}</p>
              <p className="text-sm truncate" style={{ color: 'var(--app-text-muted)' }}>{song.artist}</p>
            </div>
            <button onClick={(e) => handleLike(e, song.id, song.likesCount)} className="p-2">
              <HeartIcon size={20} color={userLikes.includes(song.id) ? '#ef4444' : 'var(--app-text-muted)'} />
            </button>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {currentSong && !showFullPlayer && (
          <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} onClick={() => setShowFullPlayer(true)} className="fixed bottom-[90px] left-3 right-3 z-40 p-3 rounded-2xl liquid-glass flex items-center gap-4 cursor-pointer">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white overflow-hidden" style={{ background: 'var(--app-accent)' }}>
              {currentSong.cover ? <img src={currentSong.cover} className="w-full h-full object-cover" /> : <span className="text-xl">🎵</span>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate" style={{ color: 'var(--app-text)' }}>{currentSong.title}</p>
            </div>
            <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="w-8 h-8 rounded-full flex items-center justify-center text-white" style={{ background: 'var(--app-accent)' }}>
              {isPlaying ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showFullPlayer && currentSong && (
          <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="fixed inset-0 z-[999] flex flex-col" style={{ background: 'var(--app-bg)' }}>
            <div className="absolute inset-0 opacity-20 blur-2xl">
              {currentSong.authorBanner ? <img src={currentSong.authorBanner} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-purple-900" />}
            </div>

            <div className="relative z-10 flex flex-col h-full">
              {/* КНОПКА НАЗАД ТЕПЕРЬ РАБОТАЕТ КОРРЕКТНО */}
              <div className="flex justify-between items-center p-6">
                <button onClick={() => setShowFullPlayer(false)} className="p-2 bg-black/20 rounded-full text-white backdrop-blur-md active:scale-90 transition-transform"><BackIcon size={24} /></button>
                <p className="text-white/60 text-xs font-bold uppercase tracking-widest">Сейчас играет</p>
                <div className="w-10" />
              </div>

              <div className="flex justify-center mt-4">
                <div className="w-64 h-64 rounded-3xl overflow-hidden shadow-2xl border-4 border-white/10">
                  {currentSong.cover ? <img src={currentSong.cover} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-blue-600 flex items-center justify-center text-6xl">🎵</div>}
                </div>
              </div>

              <div className="text-center mt-6 px-6">
                <h1 className="text-2xl font-bold text-white mb-1">{currentSong.title}</h1>
                <p className="text-lg text-white/60">{currentSong.artist}</p>
                <div className="flex justify-center gap-6 mt-4">
                  <button onClick={(e) => handleLike(e, currentSong.id, currentSong.likesCount)} className="flex items-center gap-2">
                    <HeartIcon size={24} color={userLikes.includes(currentSong.id) ? '#ef4444' : 'white'} />
                    <span className="text-white font-bold">{currentSong.likesCount}</span>
                  </button>
                  <div className="flex items-center gap-2"><EyeIcon size={24} color="white" /><span className="text-white font-bold">{currentSong.playsCount}</span></div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 mt-6 text-center" style={{ maskImage: 'linear-gradient(to bottom, transparent, black 10%, black 90%, transparent)' }}>
                {currentSong.lyrics && currentSong.lyrics.length > 0 ? (
                  currentSong.lyrics.map((line: any, index: number) => (
                    <p key={index} className={`my-3 text-lg font-bold transition-all duration-300 ${index === currentLyricIndex ? 'text-purple-400 scale-110 drop-shadow-[0_0_10px_rgba(168,85,247,0.8)]' : 'text-white/30 scale-100'}`}>{line.text}</p>
                  ))
                ) : (
                  <p className="text-white/40 mt-10 italic">Текст песни отсутствует</p>
                )}
              </div>

              <div className="p-8 flex justify-center pb-12">
                <button onClick={togglePlay} className="w-20 h-20 rounded-full flex items-center justify-center text-white shadow-2xl active:scale-90 transition-transform" style={{ background: 'var(--app-accent)' }}>
                  {isPlaying ? <PauseIcon size={32} /> : <PlayIcon size={32} />}
                </button>
              </div>
            </div>
            
            <audio ref={audioRef} onTimeUpdate={handleTimeUpdate} onEnded={() => setIsPlaying(false)} className="hidden" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
