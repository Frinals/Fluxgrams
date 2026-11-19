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
  const { t, lang, setLang } = useLanguage();
  const { theme, setTheme } = useTheme();

  const [subPage, setSubPage] = useState<SubPage>('main');
  const [editMode, setEditMode] = useState<'none' | 'editAll'>('none');

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
    const file = e.target.files?.[0]; if (!file || !user) return;
    const folder = type === 'avatar' ? 'avatars' : type === 'banner' ? 'banners' : 'songs';
    const fileName = `${folder}/${user.id}/${Date.now()}.${file.name.split('.').pop()}`;
    
    const { error } = await supabase.storage.from('media').upload(fileName, file);
    if (error) return alert("Ошибка загрузки: " + error.message);
    
    const { data } = await supabase.storage.from('media').getPublicUrl(fileName);
    if (type === 'avatar') setAvatarUrl(data.publicUrl);
    if (type === 'banner') setBannerUrl(data.publicUrl);
    if (type === 'song') setSongUrl(data.publicUrl);
  };

  const handleSave = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!user) return;
    setSaving(true);
    
    const updates: any = {
      display_name: displayName, username: username.replace(/[^a-zA-Z0-9_]/g, ''), bio, 
      avatar_url: avatarUrl, banner_url: bannerUrl, profile_song_url: songUrl, song_title: songTitle, song_artist: songArtist,
    };

    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
    if (error) alert("Ошибка базы: " + error.message);
    else { await refreshProfile(); setEditMode('none'); }
    setSaving(false);
  };

  const cards = [
    { key: 'profile', icon: UserIcon, label: lang === 'ru' ? 'Профиль' : 'Profile', desc: lang === 'ru' ? 'Аватар, баннер, имя, био, песня' : 'Avatar, banner, name, bio, song' },
    { key: 'accounts', icon: UsersIcon, label: lang === 'ru' ? 'Аккаунты' : 'Accounts', desc: lang === 'ru' ? 'Переключение между аккаунтами' : 'Switch between accounts' },
    { key: 'notifications', icon: BellIcon, label: lang === 'ru' ? 'Уведомления' : 'Notifications', desc: lang === 'ru' ? 'Звуки, вибрации, превью' : 'Sounds, vibrations, previews' },
    { key: 'privacy', icon: LockIcon, label: lang === 'ru' ? 'Конфиденциальность' : 'Privacy', desc: lang === 'ru' ? 'Кто может писать и звонить' : 'Who can write and call' },
    { key: 'appearance', icon: PaletteIcon, label: lang === 'ru' ? 'Оформление' : 'Appearance', desc: lang === 'ru' ? 'Темы и язык' : 'Themes and language' },
  ];

  const initials = displayName.slice(0, 2).toUpperCase() || '?';

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: 'var(--app-bg)' }}>
      <AnimatePresence mode="wait">
        
        {subPage === 'main' && (
          <motion.div key="main" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="p-4 space-y-3 pb-24">
            <h2 className="text-[26px] font-bold mb-4" style={{ color: 'var(--app-text)' }}>{lang === 'ru' ? 'Настройки' : 'Settings'}</h2>
            <div className="glass-panel rounded-3xl p-5 flex items-center gap-4 mb-4" onClick={() => setSubPage('profile')}>
              {avatarUrl ? <img src={avatarUrl} className="w-16 h-16 rounded-full object-cover" /> : <div className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-xl text-white" style={{ background: 'var(--app-accent)' }}>{initials}</div>}
              <div className="flex-1"><p className="font-bold text-lg" style={{ color: 'var(--app-text)' }}>{displayName || 'User'}</p><p className="text-sm" style={{ color: 'var(--app-text-muted)' }}>@{profile?.username}</p></div>
              <ChevronRightIcon size={18} style={{ color: 'var(--app-text-muted)' }} />
            </div>
            {cards.map(({ key, icon: Icon, label, desc }) => (
              <motion.button key={key} whileTap={{ scale: 0.98 }} onClick={() => setSubPage(key as SubPage)} className="glass-panel rounded-2xl w-full p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-500 text-white"><Icon size={20} /></div>
                <div className="flex-1 text-left"><span className="font-medium block" style={{ color: 'var(--app-text)' }}>{label}</span><span className="text-xs block" style={{ color: 'var(--app-text-muted)' }}>{desc}</span></div>
              </motion.button>
            ))}
            <button onClick={() => signOut()} className="w-full py-3 rounded-2xl mt-4 bg-red-500/10 text-red-500 font-semibold">{lang === 'ru' ? 'Выйти' : 'Log out'}</button>
          </motion.div>
        )}

        {subPage === 'profile' && (
          <motion.div key="profile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-full overflow-y-auto pb-24">
            <div className="absolute top-4 left-4 right-4 z-20 flex justify-between items-center">
              <button onClick={() => setSubPage('main')} className="p-2 rounded-full bg-black/40 text-white backdrop-blur-md"><BackIcon size={22} /></button>
              <button onClick={() => setEditMode('editAll')} className="p-2 rounded-full bg-black/40 text-white backdrop-blur-md"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg></button>
            </div>
            <div className="h-40 w-full relative bg-gray-800" onClick={() => bannerInputRef.current?.click()}>
              {bannerUrl ? <img src={bannerUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gradient-to-r from-blue-600 to-purple-600" />}
            </div>
            <input ref={bannerInputRef} type="file" accept="image/*" hidden onChange={(e) => handleUpload(e, 'banner')} />
            <div className="relative -mt-16 flex flex-col items-center">
              <div onClick={() => fileInputRef.current?.click()} className="relative cursor-pointer">
                {avatarUrl ? <img src={avatarUrl} className="w-32 h-32 rounded-full border-4 object-cover" style={{ borderColor: 'var(--app-bg)' }} /> : <div className="w-32 h-32 rounded-full border-4 flex items-center justify-center text-4xl font-bold text-white" style={{ background: 'var(--app-accent)', borderColor: 'var(--app-bg)' }}>{initials}</div>}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={(e) => handleUpload(e, 'avatar')} />
              <h2 className="text-2xl font-bold mt-3" style={{ color: 'var(--app-text)' }}>{displayName}</h2>
              <p className="text-sm" style={{ color: 'var(--app-text-muted)' }}>@{profile?.username}</p>
              <div className="w-full px-4 mt-4 text-center">
                <p className="text-sm font-semibold mb-1" style={{ color: 'var(--app-text)' }}>{lang === 'ru' ? 'О себе' : 'About me'}</p>
                <p className="text-sm" style={{ color: 'var(--app-text-muted)' }}>{bio || (lang === 'ru' ? 'Нет описания' : 'No description')}</p>
              </div>
              <div className="w-full px-4 mt-6">
                <p className="text-sm font-semibold mb-2" style={{ color: 'var(--app-text)' }}>{lang === 'ru' ? 'Музыка' : 'Music'}</p>
                {songUrl ? <CustomAudioPlayer url={songUrl} title={songTitle} artist={songArtist} onUploadClick={() => songInputRef.current?.click()} /> : <button onClick={() => songInputRef.current?.click()} className="w-full py-3 rounded-xl border border-dashed flex justify-center items-center gap-2 text-sm" style={{ borderColor: 'var(--app-border)', color: 'var(--app-text-muted)' }}><MusicIcon size={18} /> {lang === 'ru' ? 'Загрузить трек' : 'Upload track'}</button>}
                <input ref={songInputRef} type="file" accept="audio/*" hidden onChange={(e) => handleUpload(e, 'song')} />
              </div>
            </div>
            {editMode === 'editAll' && (
              <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
                <div className="glass-panel p-5 rounded-2xl w-full max-w-sm space-y-4">
                  <h3 className="font-bold text-lg" style={{ color: 'var(--app-text)' }}>{lang === 'ru' ? 'Редактировать' : 'Edit'}</h3>
                  <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Name" className="w-full p-2 rounded-xl border bg-transparent" style={{ color: 'var(--app-text)', borderColor: 'var(--app-border)' }} />
                  <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" className="w-full p-2 rounded-xl border bg-transparent" style={{ color: 'var(--app-text)', borderColor: 'var(--app-border)' }} />
                  <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Bio" className="w-full p-2 rounded-xl border bg-transparent" style={{ color: 'var(--app-text)', borderColor: 'var(--app-border)' }} />
                  <input value={songTitle} onChange={(e) => setSongTitle(e.target.value)} placeholder="Song Title" className="w-full p-2 rounded-xl border bg-transparent text-sm" style={{ color: 'var(--app-text)', borderColor: 'var(--app-border)' }} />
                  <input value={songArtist} onChange={(e) => setSongArtist(e.target.value)} placeholder="Artist" className="w-full p-2 rounded-xl border bg-transparent text-sm" style={{ color: 'var(--app-text)', borderColor: 'var(--app-border)' }} />
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => setEditMode('none')} className="flex-1 py-2 rounded-xl border" style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)' }}>{lang === 'ru' ? 'Отмена' : 'Cancel'}</button>
                    <button onClick={() => handleSave()} disabled={saving} className="flex-1 py-2 rounded-xl text-white bg-blue-500">{saving ? '...' : (lang === 'ru' ? 'Сохранить' : 'Save')}</button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {subPage === 'appearance' && (
          <motion.div key="appearance" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 pb-24">
            <button onClick={() => setSubPage('main')} className="mb-4 flex items-center gap-2" style={{ color: 'var(--app-text)' }}><BackIcon size={22} /> {lang === 'ru' ? 'Назад' : 'Back'}</button>
            <h3 className="font-semibold mb-4" style={{ color: 'var(--app-text)' }}>{lang === 'ru' ? 'Выберите тему' : 'Choose theme'}</h3>
            <div className="grid grid-cols-3 gap-3 mb-6">
               {themeList.map((key) => (
                  <button key={key} onClick={() => setTheme(key)} className="p-3 rounded-xl border flex flex-col items-center gap-2" style={{ background: theme === key ? 'var(--app-surface)' : 'transparent', borderColor: theme === key ? 'var(--app-accent)' : 'var(--app-border)' }}>
                    <div className="w-10 h-10 rounded-full" style={{ background: themes[key].accentGradient }} />
                    <span className="text-xs" style={{ color: 'var(--app-text)' }}>{key}</span>
                  </button>
               ))}
            </div>
            <h3 className="flex items-center gap-2 font-semibold mb-4" style={{ color: 'var(--app-text)' }}><GlobeIcon size={20} /> {lang === 'ru' ? 'Язык' : 'Language'}</h3>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setLang('ru')} className={`py-2.5 rounded-xl font-medium border ${lang === 'ru' ? 'bg-blue-500 text-white' : 'text-gray-400'}`}>Русский</button>
              <button onClick={() => setLang('en')} className={`py-2.5 rounded-xl font-medium border ${lang === 'en' ? 'bg-blue-500 text-white' : 'text-gray-400'}`}>English</button>
            </div>
          </motion.div>
        )}

        {subPage === 'privacy' && (
           <div className="p-4">
             <button onClick={() => setSubPage('main')} className="mb-4 flex items-center gap-2" style={{ color: 'var(--app-text)' }}><BackIcon size={22} /> {lang === 'ru' ? 'Назад' : 'Back'}</button>
             <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--app-text)' }}>{lang === 'ru' ? 'Конфиденциальность' : 'Privacy'}</h2>
             <div className="p-4 glass-panel rounded-2xl space-y-4">
                <div className="flex justify-between items-center"><span style={{ color: 'var(--app-text)' }}>{lang === 'ru' ? 'Кто может писать' : 'Who can message'}</span><span className="text-blue-500 text-sm">{lang === 'ru' ? 'Все' : 'Everyone'}</span></div>
                <div className="flex justify-between items-center"><span style={{ color: 'var(--app-text)' }}>{lang === 'ru' ? 'Кто может звонить' : 'Who can call'}</span><span className="text-blue-500 text-sm">{lang === 'ru' ? 'Все' : 'Everyone'}</span></div>
             </div>
           </div>
        )}

        {subPage === 'accounts' && (
           <div className="p-4">
             <button onClick={() => setSubPage('main')} className="mb-4 flex items-center gap-2" style={{ color: 'var(--app-text)' }}><BackIcon size={22} /> {lang === 'ru' ? 'Назад' : 'Back'}</button>
             <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--app-text)' }}>{lang === 'ru' ? 'Аккаунты' : 'Accounts'}</h2>
             <div className="p-4 glass-panel rounded-2xl space-y-4">
                <div className="flex justify-between items-center"><span style={{ color: 'var(--app-text)' }}>@{profile?.username}</span><span className="text-green-500 text-sm">{lang === 'ru' ? 'Активный' : 'Active'}</span></div>
             </div>
           </div>
        )}

        {subPage === 'notifications' && (
           <div className="p-4">
             <button onClick={() => setSubPage('main')} className="mb-4 flex items-center gap-2" style={{ color: 'var(--app-text)' }}><BackIcon size={22} /> {lang === 'ru' ? 'Назад' : 'Back'}</button>
             <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--app-text)' }}>{lang === 'ru' ? 'Уведомления' : 'Notifications'}</h2>
             <div className="p-4 glass-panel rounded-2xl space-y-4">
                <div className="flex justify-between items-center"><span style={{ color: 'var(--app-text)' }}>{lang === 'ru' ? 'Звук' : 'Sound'}</span><span className="text-blue-500 text-sm">ON</span></div>
             </div>
           </div>
        )}
      </AnimatePresence>
    </div>
  );
}

const CustomAudioPlayer = memo(function CustomAudioPlayer({ url, title, artist, onUploadClick }: { url: string, title: string, artist: string, onUploadClick: () => void }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const toggle = () => { if (!audioRef.current) return; if (playing) audioRef.current.pause(); else audioRef.current.play(); setPlaying(!playing); };
  return (
    <div className="w-full rounded-2xl p-3 flex items-center gap-3 border relative overflow-hidden" style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
      <button onClick={toggle} className="w-12 h-12 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: 'var(--app-accent)' }}>{playing ? <PauseIcon size={22} /> : <PlayIcon size={22} />}</button>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold truncate" style={{ color: 'var(--app-text)' }}>{title || 'Трек'}</p>
        <p className="text-xs truncate" style={{ color: 'var(--app-text-muted)' }}>{artist || 'Исполнитель'}</p>
      </div>
      <button onClick={onUploadClick} className="p-2 text-gray-400"><MusicIcon size={18} /></button>
      <audio ref={audioRef} src={url} onEnded={() => setPlaying(false)} />
    </div>
  );
});
