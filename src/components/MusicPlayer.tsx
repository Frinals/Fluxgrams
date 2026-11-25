import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PlayIcon, PauseIcon, BackIcon } from '@/components/Icons';

export default function MusicPlayer({ songs, initialIndex, onClose }: any) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const currentSong = songs && songs[currentIndex] ? songs[currentIndex] : null;

  useEffect(() => {
    if (audioRef.current && currentSong) {
      audioRef.current.src = currentSong.url;
      audioRef.current.play().catch(e => console.log("Ошибка воспроизведения:", e));
      setIsPlaying(true);
    }
  }, [currentIndex, currentSong]);

  if (!currentSong) return null; // Защита

  const togglePlay = () => {
    if (isPlaying) audioRef.current?.pause();
    else audioRef.current?.play();
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setProgress(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleSeek = (e: any) => {
    const time = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setProgress(time);
    }
  };

  const nextSong = () => {
    if (currentIndex < songs.length - 1) setCurrentIndex(currentIndex + 1);
    else setCurrentIndex(0);
  };

  const prevSong = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
    else setCurrentIndex(songs.length - 1);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  return (
    <motion.div 
      initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-[9999] flex flex-col p-6" style={{ background: 'var(--app-bg)' }}
    >
      <div className="flex justify-between items-center mb-10">
        <button onClick={onClose} style={{ color: 'var(--app-text)' }}><BackIcon size={28} /></button>
        <span className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--app-text-muted)' }}>Сейчас играет</span>
        <div className="w-7" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="w-64 h-64 rounded-full flex items-center justify-center text-6xl shadow-2xl mb-10 animate-pulse" style={{ background: 'var(--app-accent)', color: 'white' }}>
          🎵
        </div>
        <h2 className="text-2xl font-bold mb-2 text-center" style={{ color: 'var(--app-text)' }}>{currentSong.title}</h2>
        <p className="text-sm mb-8" style={{ color: 'var(--app-text-muted)' }}>Fluxgram Music</p>

        <div className="w-full max-w-sm flex flex-col items-center">
          <input 
            type="range" min={0} max={duration || 100} value={progress} onChange={handleSeek}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer mb-2"
            style={{ background: 'var(--app-border)', accentColor: 'var(--app-accent)' }}
          />
          <div className="flex justify-between w-full text-xs font-medium" style={{ color: 'var(--app-text-muted)' }}>
            <span>{formatTime(progress)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="flex items-center gap-8 mt-10">
          <button onClick={prevSong} style={{ color: 'var(--app-text)' }} className="text-3xl">⏮</button>
          <button onClick={togglePlay} className="w-20 h-20 rounded-full flex items-center justify-center shadow-lg" style={{ background: 'var(--app-accent)', color: 'white' }}>
            {isPlaying ? <PauseIcon size={32} /> : <PlayIcon size={32} />}
          </button>
          <button onClick={nextSong} style={{ color: 'var(--app-text)' }} className="text-3xl">⏭</button>
        </div>
      </div>
      <audio ref={audioRef} onTimeUpdate={handleTimeUpdate} onEnded={nextSong} className="hidden" />
    </motion.div>
  );
}
