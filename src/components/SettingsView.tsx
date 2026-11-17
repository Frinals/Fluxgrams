import { useState, useEffect, useRef, FormEvent, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, Profile } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeName, Language, TranslationKey, themes, themeList } from '@/lib/types';
import { UserIcon, LockIcon, GlobeIcon, PaletteIcon, LogOutIcon, CheckIcon, ChevronRightIcon, MusicIcon, BellIcon, BackIcon, UsersIcon, AddUserIcon, PlayIcon, PauseIcon, ImageIcon } from '@/components/Icons';

type SubPage = 'main' | 'profile' | 'privacy' | 'appearance' | 'notifications' | 'accounts';
const springTransition = { type: 'spring' as const, stiffness: 300, damping: 30 };

export default function SettingsView() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { t } = useLanguage();
  const { theme, setTheme } = useTheme();

  const [subPage, setSubPage] = useState<SubPage>('main');
  const [editMode, setEditMode] = useState<'none' | 'photo' | 'banner' | 'bio'>('none');

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [songUrl, setSongUrl] = useState('');
  const [songTitle, setSongTitle] = useState('');
  const [songArtist, setSongArtist] = useState('');
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const songInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setBio(profile.bio || '');
      setAvatarUrl(profile.avatar_url || '');
      setSongUrl(profile.profile_song_url || '');
      setSongTitle(profile.song_title || '');
      setSongArtist(profile.song_artist || '');
    }
  }, [profile]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !user) return;
    const fileName = `avatars/${user.id}.${file.name.split('.').pop()}`;
    await supabase.storage.from('media').upload(fileName, file, { upsert: true });
    const { data } = supabase.storage.from('media').getPublicUrl(fileName);
    setAvatarUrl(data.publicUrl);
    setEditMode('none');
  };

  const handleSongUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !user) return;
    const fileName = `songs/${user.id}/${Date.now()}.mp3`;
    const { error } = await supabase.storage.from('media').upload(fileName, file);
    if (error) return;
    const { data } = supabase.storage.from('media').getPublicUrl(fileName);
    setSongUrl(data.publicUrl);
  };

  const handleSave = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!user) return;
    setSaving(true);
    const updates: any = {
      display_name: displayName, bio, avatar_url: avatarUrl,
      profile_song_url: songUrl, song_title: songTitle, song_artist: songArtist,
    };
    await supabase.from('profiles').update(updates).eq('id', user.id);
    await refreshProfile();
    setSaving(false);
    setEditMode('none');
  };

  const cards = [
    { key: 'profile', icon: UserIcon, label: t('profilePersonalization'), desc: 'Аватар, баннер, имя, био, песня' },
    { key: 'accounts', icon: UsersIcon, label: t('accounts'), desc: 'Переключение между аккаунтами' },
    { key: 'notifications', icon: BellIcon, label: t('notifications'), desc: 'Звуки, вибрации, превью' },
    { key: 'privacy', icon: LockIcon, label: t('privacy'), desc: 'Кто может писать и звонить' },
    { key: 'appearance', icon: PaletteIcon, label: t('appearanceAndLanguage'), desc: 'Темы и язык' },
  ];

  const initials = displayName.slice(0, 2).toUpperCase() || '?';

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: 'var(--app-bg)' }}>
      <AnimatePresence mode="wait">
        
        {/* ГЛАВНЫЙ ЭКРАН НАСТРОЕК */}
        {subPage === 'main' && (
          <motion.div key="main" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="p-4 space-y-3 pb-24">
            <h2 className="text-[26px] font-bold mb-4" style={{ color: 'var(--app-text)' }}>{t('settings')}</h2>
            <div className="glass-panel rounded-3xl p-5 flex items-center gap-4 mb-4">
              {avatarUrl ? <img src={avatarUrl} className="w-16 h-16 rounded-full object-cover" /> : <div className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-xl text-white" style={{ background: 'var(--app-accent-gradient)' }}>{initials}</div>}
              <div><p className="font-bold text-lg" style={{ color: 'var(--app-text)' }}>{displayName || 'User'}</p><p className="text-sm" style={{ color: 'var(--app-text-muted)' }}>@{profile?.username}</p></div>
            </div>
            {cards.map(({ key, icon: Icon, label, desc }) => (
              <motion.button key={key} whileTap={{ scale: 0.98 }} onClick={() => { setSubPage(key as SubPage); setEditMode('none'); }} className="glass-panel rounded-2xl w-full p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-500 text-white"><Icon size={20} /></div>
                <div className="flex-1 text-left"><span className="font-medium block" style={{ color: 'var(--app-text)' }}>{label}</span><span className="text-xs block truncate" style={{ color: 'var(--app-text-muted)' }}>{desc}</span></div>
                <ChevronRightIcon size={18} style={{ color: 'var(--app-text-muted)' }} />
              </motion.button>
            ))}
            <button onClick={() => signOut()} className="w-full py-3 rounded-2xl mt-4 flex items-center justify-center gap-2 bg-red-500/10 text-red-500 font-semibold"><LogOutIcon size={20} /> Выйти</button>
          </motion.div>
        )}

        {/* КРАСИВЫЙ ПРОФИЛЬ (КАК НА ФОТО) */}
        {subPage === 'profile' && (
          <motion.div key="profile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col h-full overflow-y-auto pb-24">
            
            {/* ФИКС: Шапка с кнопкой назад слева и КАРАНДАШОМ справа */}
            <div className="absolute top-4 left-4 right-4 z-20 flex justify-between items-center">
              <button onClick={() => setSubPage('main')} className="p-2 rounded-full bg-black/30 text-white backdrop-blur-md">
                <BackIcon size={22} />
              </button>
              <button onClick={() => setSubPage('main')} className="p-2 rounded-full bg-black/30 text-white backdrop-blur-md">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                </svg>
              </button>
            </div>
            
            {/* Баннер */}
            <div className="h-40 w-full relative" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}></div>

            {/* Аватар поверх баннера */}
            <div className="relative -mt-16 flex flex-col items-center">
              {avatarUrl ? (
                <img src={avatarUrl} className="w-32 h-32 rounded-full border-4 object-cover shadow-xl" style={{ borderColor: 'var(--app-bg)' }} />
              ) : (
                <div className="w-32 h-32 rounded-full border-4 flex items-center justify-center text-4xl font-bold text-white shadow-xl" style={{ background: 'var(--app-accent-gradient)', borderColor: 'var(--app-bg)' }}>{initials}</div>
              )}
              <h2 className="text-2xl font-bold mt-3" style={{ color: 'var(--app-text)' }}>{displayName}</h2>
              <p className="text-sm" style={{ color: 'var(--app-text-muted)' }}>@{profile?.username}</p>
              
              {/* Кнопки: Фото, Баннер, Био, Настройки */}
              <div className="grid grid-cols-4 gap-2 mt-6 w-full px-4">
                <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-1 p-3 rounded-2xl glass-panel">
                  <ImageIcon size={20} color="var(--app-accent)" /><span className="text-[10px]" style={{ color: 'var(--app-text)' }}>Фото</span>
                </button>
                <button onClick={() => setEditMode('banner')} className="flex flex-col items-center gap-1 p-3 rounded-2xl glass-panel">
                  <ImageIcon size={20} color="var(--app-accent)" /><span className="text-[10px]" style={{ color: 'var(--app-text)' }}>Баннер</span>
                </button>
                <button onClick={() => setEditMode('bio')} className="flex flex-col items-center gap-1 p-3 rounded-2xl glass-panel">
                  <UserIcon size={20} color="var(--app-accent)" /><span className="text-[10px]" style={{ color: 'var(--app-text)' }}>Био</span>
                </button>
                <button onClick={() => setSubPage('main')} className="flex flex-col items-center gap-1 p-3 rounded-2xl glass-panel">
                  <PaletteIcon size={20} color="var(--app-accent)" /><span className="text-[10px]" style={{ color: 'var(--app-text)' }}>Настр.</span>
                </button>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleAvatarUpload} />

              {/* О себе (Bio) */}
              <div className="w-full px-4 mt-4 text-center">
                <p className="text-sm font-semibold mb-1" style={{ color: 'var(--app-text)' }}>О себе</p>
                <p className="text-sm" style={{ color: 'var(--app-text-muted)' }}>{bio || 'Нет описания'}</p>
              </div>

              {/* МУЗЫКА (Красивый плеер с перемоткой) */}
              <div className="w-full px-4 mt-6">
                <p className="text-sm font-semibold mb-2" style={{ color: 'var(--app-text)' }}>Музыка</p>
                {songUrl ? (
                  <CustomAudioPlayer url={songUrl} title={songTitle} artist={songArtist} onUploadClick={() => songInputRef.current?.click()} />
                ) : (
                  <button onClick={() => songInputRef.current?.click()} className="w-full py-3 rounded-xl border border-dashed flex justify-center items-center gap-2 text-sm" style={{ borderColor: 'var(--app-border)', color: 'var(--app-text-muted)' }}>
                    <MusicIcon size={18} /> Загрузить трек профиля
                  </button>
                )}
                <input ref={songInputRef} type="file" accept="audio/*" hidden onChange={handleSongUpload} />
              </div>

              {/* Подарки */}
              <div className="w-full px-4 mt-6">
                 <p className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: 'var(--app-text)' }}>🎁 Подарки</p>
                 <div className="p-4 rounded-xl text-center text-xs glass-panel" style={{ color: 'var(--app-text-muted)' }}>Пока нет подарков</div>
              </div>
            </div>

            {/* Модалки для редактирования */}
            {editMode !== 'none' && (
              <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
                <div className="glass-panel p-5 rounded-2xl w-full max-w-sm space-y-4">
                  <h3 className="font-bold text-lg" style={{ color: 'var(--app-text)' }}>Редактировать {editMode === 'bio' ? 'Био' : 'Баннер'}</h3>
                  {editMode === 'bio' && (
                    <textarea value={bio} onChange={(e) => setBio(e.target.value)} className="w-full px-4 py-2 rounded-xl border" style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }} />
                  )}
                  {editMode === 'banner' && (
                    <p className="text-sm" style={{ color: 'var(--app-text-muted)' }}>Загрузка баннера будет в следующем обновлении.</p>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => setEditMode('none')} className="flex-1 py-2 rounded-xl border" style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)' }}>Отмена</button>
                    <button onClick={() => handleSave()} className="flex-1 py-2 rounded-xl text-white bg-blue-500">Сохранить</button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ОСТАЛЬНЫЕ РАЗДЕЛЫ (темы и т.д.) */}
        {subPage === 'appearance' && (
          <motion.div key="appearance" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 pb-24">
            <button onClick={() => setSubPage('main')} className="mb-4 flex items-center gap-2" style={{ color: 'var(--app-text)' }}><BackIcon size={22} /> Назад</button>
            <h3 className="font-semibold mb-4" style={{ color: 'var(--app-text)' }}>Выберите тему</h3>
            <div className="grid grid-cols-3 gap-3">
               {themeList.map((key) => (
                  <button key={key} onClick={() => setTheme(key)} className="p-3 rounded-xl border flex flex-col items-center gap-2" style={{ background: theme === key ? 'var(--app-surface)' : 'transparent', borderColor: theme === key ? 'var(--app-accent)' : 'var(--app-border)' }}>
                    <div className="w-10 h-10 rounded-full" style={{ background: themes[key].accentGradient }} />
                    <span className="text-xs" style={{ color: 'var(--app-text)' }}>{key}</span>
                  </button>
               ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// КРАСИВЫЙ ПЛЕЕР С ПЕРЕМОТКОЙ
const CustomAudioPlayer = memo(function CustomAudioPlayer({ url, title, artist, onUploadClick }: { url: string, title: string, artist: string, onUploadClick: () => void }) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) audioRef.current.pause(); else audioRef.current.play();
    setPlaying(!playing);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) setDuration(audioRef.current.duration);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current) {
      const time = Number(e.target.value);
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const format = (time: number) => {
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full rounded-2xl p-3 flex items-center gap-3 border relative overflow-hidden" style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
      <button onClick={toggle} className="w-12 h-12 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: 'var(--app-accent-gradient)' }}>
        {playing ? <PauseIcon size={22} /> : <PlayIcon size={22} />}
      </button>
      
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold truncate" style={{ color: 'var(--app-text)' }}>{title || 'Неизвестный трек'}</p>
        <p className="text-xs truncate mb-2" style={{ color: 'var(--app-text-muted)' }}>{artist || 'Неизвестный исполнитель'}</p>
        
        {/* Ползунок перемотки */}
        <div className="flex items-center gap-2">
          <span className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>{format(currentTime)}</span>
          <input 
            type="range" min="0" max={duration || 100} value={currentTime} onChange={handleSeek}
            className="flex-1 h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-blue-500" 
          />
          <span className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>{format(duration)}</span>
        </div>
      </div>

      <button onClick={onUploadClick} className="p-2 shrink-0 text-gray-400"><MusicIcon size={18} /></button>

      <audio ref={audioRef} src={url} onTimeUpdate={handleTimeUpdate} onLoadedMetadata={handleLoadedMetadata} onEnded={() => setPlaying(false)} />
    </div>
  );
});
