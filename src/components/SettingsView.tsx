import { useState, useEffect, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, Profile } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { themes, themeList } from '@/lib/types';
import { UserIcon, LockIcon, GlobeIcon, PaletteIcon, LogOutIcon, ChevronRightIcon, MusicIcon, BellIcon, BackIcon, UsersIcon, PlayIcon, PauseIcon, VerifiedIcon, ImageIcon } from '@/components/Icons';

type SubPage = 'main' | 'profile' | 'privacy' | 'appearance' | 'notifications' | 'accounts';
const springTransition = { type: 'spring' as const, stiffness: 300, damping: 30 };

export default function SettingsView() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { lang, setLang } = useLanguage();
  const { theme, setTheme } = useTheme();

  const [subPage, setSubPage] = useState<SubPage>('main');
  const [isEditing, setIsEditing] = useState(false); // Режим редактирования профиля

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [songUrl, setSongUrl] = useState('');
  const [songTitle, setSongTitle] = useState('');
  const [songArtist, setSongArtist] = useState('');
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const songInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setUsername(profile.username || '');
      setBio(profile.bio || '');
      setAvatarUrl(profile.avatar_url || '');
      setBannerUrl((profile as any).banner_url || '');
      setSongUrl(profile.profile_song_url || '');
      setSongTitle(profile.song_title || '');
      setSongArtist(profile.song_artist || '');
    }
  }, [profile]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'banner' | 'song') => {
    const file = e.target.files?.[0]; 
    if (!file || !user) return;
    const folder = type === 'avatar' ? 'avatars' : type === 'banner' ? 'banners' : 'songs';
    const fileName = `${folder}/${user.id}/${Date.now()}.${file.name.split('.').pop()}`;
    
    const { error } = await supabase.storage.from('media').upload(fileName, file);
    if (error) return alert("Ошибка загрузки: " + error.message);
    
    const { data } = supabase.storage.from('media').getPublicUrl(fileName);
    if (type === 'avatar') setAvatarUrl(data.publicUrl);
    if (type === 'banner') setBannerUrl(data.publicUrl);
    if (type === 'song') setSongUrl(data.publicUrl);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const updates: any = {
      display_name: displayName, username: username.replace(/[^a-zA-Z0-9_]/g, ''), bio, 
      avatar_url: avatarUrl, banner_url: bannerUrl, profile_song_url: songUrl, song_title: songTitle, song_artist: songArtist,
    };
    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
    if (error) alert("Ошибка базы: " + error.message);
    else { await refreshProfile(); setIsEditing(false); }
    setSaving(false);
  };

  const updateSetting = async (updates: any) => {
    if (!user) return;
    await supabase.from('profiles').update(updates).eq('id', user.id);
    await refreshProfile();
  };

  const cards = [
    { key: 'profile', icon: UserIcon, label: 'Профиль', desc: 'Аватар, баннер, посты' },
    { key: 'accounts', icon: UsersIcon, label: 'Аккаунты', desc: 'Управление аккаунтами' },
    { key: 'notifications', icon: BellIcon, label: 'Уведомления', desc: 'Звуки и вибрации' },
    { key: 'privacy', icon: LockIcon, label: 'Конфиденциальность', desc: 'Кто может писать' },
    { key: 'appearance', icon: PaletteIcon, label: 'Оформление', desc: 'Темы и язык' },
  ];

  const initials = displayName.slice(0, 2).toUpperCase() || '?';
  
  // Применяем стили
  const fontStyleClass = `font-${(profile as any)?.font_style || 'default'}`;
  const frameStyleClass = `frame-${(profile as any)?.avatar_frame || 'default'}`;

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: 'var(--app-bg)' }}>
      <AnimatePresence mode="wait">
        
        {/* ГЛАВНЫЙ ЭКРАН НАСТРОЕК */}
        {subPage === 'main' && (
          <motion.div key="main" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={springTransition} className="p-4 space-y-3 pb-24">
            <h2 className="text-[26px] font-bold mb-4" style={{ color: 'var(--app-text)' }}>Настройки</h2>
            <div className="glass-panel rounded-3xl p-5 flex items-center gap-4 mb-4 cursor-pointer" onClick={() => { setSubPage('profile'); setIsEditing(false); }}>
              {avatarUrl ? <img src={avatarUrl} className="w-16 h-16 rounded-full object-cover" /> : <div className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-xl text-white" style={{ background: 'var(--app-accent)' }}>{initials}</div>}
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="font-bold text-lg" style={{ color: 'var(--app-text)' }}>{displayName || 'User'}</p>
                  {(profile as any)?.is_verified && <VerifiedIcon size={18} />}
                </div>
                <p className="text-sm" style={{ color: 'var(--app-text-muted)' }}>@{profile?.username}</p>
              </div>
              <ChevronRightIcon size={18} style={{ color: 'var(--app-text-muted)' }} />
            </div>
            
            {cards.map(({ key, icon: Icon, label, desc }) => (
              <motion.button key={key} whileTap={{ scale: 0.98 }} onClick={() => setSubPage(key as SubPage)} className="glass-panel rounded-2xl w-full p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-500 text-white"><Icon size={20} /></div>
                <div className="flex-1 text-left"><span className="font-medium block" style={{ color: 'var(--app-text)' }}>{label}</span><span className="text-xs block" style={{ color: 'var(--app-text-muted)' }}>{desc}</span></div>
              </motion.button>
            ))}
            <button onClick={() => signOut()} className="w-full py-3 rounded-2xl mt-4 bg-red-500/10 text-red-500 font-semibold">Выйти</button>
          </motion.div>
        )}

        {/* ПРОСМОТР ПРОФИЛЯ (БЕЗ РЕДАКТИРОВАНИЯ) */}
        {subPage === 'profile' && !isEditing && (
          <motion.div key="profile-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-full overflow-y-auto pb-24">
            <div className="absolute top-4 left-4 right-4 z-20 flex justify-between items-center">
              <button onClick={() => setSubPage('main')} className="p-2 rounded-full bg-black/40 text-white backdrop-blur-md"><BackIcon size={22} /></button>
              <button onClick={() => setIsEditing(true)} className="px-4 py-2 rounded-full bg-black/40 text-white backdrop-blur-md font-medium text-sm">Изменить</button>
            </div>
            
            <div className="h-40 w-full relative bg-gray-800">
              {bannerUrl ? <img src={bannerUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gradient-to-r from-blue-600 to-purple-600" />}
            </div>

            <div className="relative -mt-16 flex flex-col items-center">
              <div className={`w-32 h-32 rounded-full border-4 flex items-center justify-center text-4xl font-bold text-white shadow-xl ${frameStyleClass}`} style={{ background: 'var(--app-accent)', borderColor: 'var(--app-bg)' }}>
                {avatarUrl ? <img src={avatarUrl} className="w-full h-full rounded-full object-cover" /> : initials}
              </div>

              <div className="flex items-center gap-1.5 mt-3">
                <h2 className={`text-2xl ${fontStyleClass}`} style={{ color: 'var(--app-text)' }}>{displayName}</h2>
                {(profile as any)?.is_verified && <VerifiedIcon size={24} />}
              </div>
              <p className="text-sm" style={{ color: 'var(--app-text-muted)' }}>@{profile?.username}</p>
              
              <div className="w-full px-4 mt-4 text-center">
                <p className="text-sm font-semibold mb-1" style={{ color: 'var(--app-text)' }}>О себе</p>
                <p className="text-sm" style={{ color: 'var(--app-text-muted)' }}>{bio || 'Нет описания'}</p>
              </div>

              <div className="w-full px-4 mt-6">
                <p className="text-sm font-semibold mb-2" style={{ color: 'var(--app-text)' }}>Музыка</p>
                {songUrl ? (
                  <CustomAudioPlayer url={songUrl} title={songTitle} artist={songArtist} />
                ) : (
                  <p className="text-sm text-gray-500">Трек не добавлен</p>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* РЕДАКТИРОВАНИЕ ПРОФИЛЯ */}
        {subPage === 'profile' && isEditing && (
          <motion.div key="profile-edit" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="p-4 pb-24">
            <div className="flex justify-between items-center mb-6">
              <button onClick={() => setIsEditing(false)} className="text-blue-500 font-medium">Отмена</button>
              <h2 className="text-xl font-bold" style={{ color: 'var(--app-text)' }}>Редактировать</h2>
              <button onClick={handleSave} disabled={saving} className="text-blue-500 font-bold">{saving ? '...' : 'Готово'}</button>
            </div>

            <div className="glass-panel p-5 rounded-2xl space-y-4">
              <div className="flex items-center gap-4">
                {avatarUrl ? <img src={avatarUrl} className="w-20 h-20 rounded-full object-cover" /> : <div className="w-20 h-20 rounded-full bg-blue-500" />}
                <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 rounded-xl text-sm font-medium border bg-transparent text-white border-[var(--app-border)]">Сменить фото</button>
                <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={(e) => handleUpload(e, 'avatar')} />
              </div>
              
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Имя" className="w-full p-3 rounded-xl border bg-transparent" style={{ color: 'var(--app-text)', borderColor: 'var(--app-border)' }} />
              <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Ник" className="w-full p-3 rounded-xl border bg-transparent" style={{ color: 'var(--app-text)', borderColor: 'var(--app-border)' }} />
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="О себе" className="w-full p-3 rounded-xl border bg-transparent" style={{ color: 'var(--app-text)', borderColor: 'var(--app-border)' }} />
              
              <div>
                <p className="text-sm text-gray-400 mb-2">Музыка</p>
                <input value={songTitle} onChange={(e) => setSongTitle(e.target.value)} placeholder="Название песни" className="w-full p-2 rounded-xl border bg-transparent mb-2 text-sm" style={{ color: 'var(--app-text)', borderColor: 'var(--app-border)' }} />
                <input value={songArtist} onChange={(e) => setSongArtist(e.target.value)} placeholder="Исполнитель" className="w-full p-2 rounded-xl border bg-transparent mb-2 text-sm" style={{ color: 'var(--app-text)', borderColor: 'var(--app-border)' }} />
                <button onClick={() => songInputRef.current?.click()} className="px-3 py-1.5 rounded-lg text-xs bg-blue-500 text-white">Загрузить трек</button>
                <input ref={songInputRef} type="file" accept="audio/*" hidden onChange={(e) => handleUpload(e, 'song')} />
              </div>

              <div className="pt-4 border-t border-[var(--app-border)]">
                <p className="text-sm font-semibold text-white mb-2">Стиль ника</p>
                <select value={(profile as any)?.font_style || 'default'} onChange={(e) => updateSetting({ font_style: e.target.value })} className="w-full p-2 rounded-xl border bg-transparent text-white mb-4" style={{ borderColor: 'var(--app-border)' }}>
                  <option value="default">Обычный</option>
                  <option value="bold-caps">Жирный (КАПС)</option>
                  <option value="serif">Курсив</option>
                  <option value="mono">Печатный</option>
                </select>

                <p className="text-sm font-semibold text-white mb-2">Рамка аватарки</p>
                <select value={(profile as any)?.avatar_frame || 'default'} onChange={(e) => updateSetting({ avatar_frame: e.target.value })} className="w-full p-2 rounded-xl border bg-transparent text-white" style={{ borderColor: 'var(--app-border)' }}>
                  <option value="default">Обычная</option>
                  <option value="gold">Золотая</option>
                  <option value="neon">Неоновая</option>
                  <option value="fire">Огонь</option>
                </select>
              </div>
            </div>
          </motion.div>
        )}

        {/* ОСТАЛЬНЫЕ РАЗДЕЛЫ */}
        {/* ... (Остальные разделы privacy, appearance, notifications, accounts можно оставить как были, они не меняются) ... */}
        {subPage === 'appearance' && (
          <motion.div key="appearance" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 pb-24">
            <button onClick={() => setSubPage('main')} className="mb-4 flex items-center gap-2 text-white"><BackIcon size={22} /> Назад</button>
            <h3 className="font-semibold mb-4 text-white">Выберите тему</h3>
            <div className="grid grid-cols-3 gap-3 mb-6">
               {themeList.map((key) => (
                  <button key={key} onClick={() => setTheme(key)} className="p-3 rounded-xl border flex flex-col items-center gap-2" style={{ background: theme === key ? 'var(--app-surface)' : 'transparent', borderColor: theme === key ? 'var(--app-accent)' : 'var(--app-border)' }}>
                    <div className="w-10 h-10 rounded-full" style={{ background: themes[key].accentGradient }} />
                    <span className="text-xs text-white">{key}</span>
                  </button>
               ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ПЛЕЕР С ВОЗМОЖНОСТЬЮ РАСКРЫТИЯ
const CustomAudioPlayer = memo(function CustomAudioPlayer({ url, title, artist }: { url: string, title: string, artist: string }) {
  const [playing, setPlaying] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return; 
    if (playing) audioRef.current.pause(); 
    else audioRef.current.play(); 
    setPlaying(!playing); 
  };

  return (
    <>
      <div onClick={() => setIsExpanded(true)} className="w-full rounded-2xl p-3 flex items-center gap-3 border relative overflow-hidden cursor-pointer glass-panel" style={{ borderColor: 'var(--app-border)' }}>
        <button onClick={togglePlay} className="w-12 h-12 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: 'var(--app-accent)' }}>
          {playing ? <PauseIcon size={22} /> : <PlayIcon size={22} />}
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate text-white">{title || 'Трек'}</p>
          <p className="text-xs truncate text-gray-400">{artist || 'Исполнитель'}</p>
        </div>
        <MusicIcon size={18} className="text-gray-400" />
        <audio ref={audioRef} src={url} onEnded={() => setPlaying(false)} />
      </div>

      {/* РАСКРЫТЫЙ ПЛЕЕР */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="fixed inset-0 z-[200] flex flex-col p-6" style={{ background: 'var(--app-bg)' }}>
            <button onClick={() => setIsExpanded(false)} className="self-start p-2 mb-8 text-white"><BackIcon size={24} /></button>
            <div className="flex-1 flex flex-col items-center justify-center">
               <div className="w-64 h-64 rounded-3xl bg-blue-500/20 flex items-center justify-center mb-8 shadow-2xl">
                 <MusicIcon size={80} className="text-blue-500" />
               </div>
               <h2 className="text-2xl font-bold text-white text-center">{title}</h2>
               <p className="text-gray-400 mt-2">{artist}</p>
               
               <button onClick={togglePlay} className="w-20 h-20 rounded-full mt-10 flex items-center justify-center text-white shadow-xl" style={{ background: 'var(--app-accent)' }}>
                 {playing ? <PauseIcon size={32} /> : <PlayIcon size={32} />}
               </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});
