import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { PlayIcon, PauseIcon, BackIcon } from '@/components/Icons';
import { motion, AnimatePresence } from 'framer-motion';

export default function MusicView() {
  const [query, setQuery] = useState('');
  const [songs, setSongs] = useState<any[]>([]);
  const [currentSong, setCurrentSong] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [offlineMessage, setOfflineMessage] = useState('');
  
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const fetchSongs = async () => {
      const { data } = await supabase.from('profiles').select('id, display_name, studio_song').not('studio_song', 'is', null);
      if (data) {
        const allSongs = data.map(p => ({ ...p.studio_song, authorName: p.display_name, id: `${p.id}-${p.studio_song.title}` }));
        setSongs(allSongs);
      }
    };
    fetchSongs();
  }, []);

  const filteredSongs = songs.filter(s => s.title.toLowerCase().includes(query.toLowerCase()) || s.artist.toLowerCase().includes(query.toLowerCase()));

  const playSong = async (song: any) => {
    setOfflineMessage('');
    setCurrentSong(song);
    setIsPlaying(true);

    if (audioRef.current) {
      try {
        const cache = await caches.open('flux-music-cache');
        const cachedResponse = await cache.match(song.url);

        if (cachedResponse) {
          const blob = await cachedResponse.blob();
          audioRef.current.src = URL.createObjectURL(blob);
        } else {
          audioRef.current.src = song.url;
          try {
            const response = await fetch(song.url);
            if (response.ok) await cache.put(song.url, response.clone());
          } catch (e) {
             setOfflineMessage('Нет интернета! Эта песня не была скачана ранее.');
             setIsPlaying(false); return;
          }
        }
        await audioRef.current.play();
      } catch (err) {
        audioRef.current.src = song.url; 
        audioRef.current.play();
      }
    }
  };

  const togglePlay = () => {
    if (isPlaying) audioRef.current?.pause();
    else audioRef.current?.play();
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="flex flex-col h-full relative" style={{ background: 'var(--app-bg)' }}>
      <div className="p-4 sticky top-0 z-20 liquid-glass">
        <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--app-text)' }}>Музыка</h2>
        <input 
          type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Поиск песен или исполнителей..."
          className="w-full px-4 py-3 rounded-2xl outline-none liquid-glass" style={{ color: 'var(--app-text)' }}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2 pb-24">
        {offlineMessage && <div className="p-3 rounded-xl mb-4 text-center font-bold text-sm" style={{ background: '#ef4444', color: 'white' }}>{offlineMessage}</div>}

        {filteredSongs.length === 0 ? (
          <p className="text-center mt-10" style={{ color: 'var(--app-text-muted)' }}>Ничего не найдено</p>
        ) : (
          filteredSongs.map(song => (
            <div key={song.id} onClick={() => playSong(song)} className="flex items-center gap-4 p-3 rounded-2xl liquid-glass cursor-pointer active:scale-95 transition-transform">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white" style={{ background: 'var(--app-accent)' }}>
                {currentSong?.id === song.id && isPlaying ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold truncate" style={{ color: 'var(--app-text)' }}>{song.title}</p>
                <p className="text-sm truncate" style={{ color: 'var(--app-text-muted)' }}>{song.artist}</p>
              </div>
            </div>
          ))
        )}
      </div>

      <AnimatePresence>
        {currentSong && (
          <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} className="fixed bottom-[90px] left-3 right-3 z-40 p-4 rounded-3xl liquid-glass border-t border-white/30 shadow-2xl flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white" style={{ background: 'var(--app-accent)' }}><span className="text-2xl">🎵</span></div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate" style={{ color: 'var(--app-text)' }}>{currentSong.title}</p>
              <p className="text-xs truncate" style={{ color: 'var(--app-text-muted)' }}>{currentSong.artist}</p>
            </div>
            <button onClick={togglePlay} className="w-10 h-10 rounded-full flex items-center justify-center text-white" style={{ background: 'var(--app-accent)' }}>
              {isPlaying ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
            </button>
            <audio ref={audioRef} onEnded={() => setIsPlaying(false)} className="hidden" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
