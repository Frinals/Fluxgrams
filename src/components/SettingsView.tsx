import { useState, useEffect, useRef, FormEvent, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, Profile } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeName, Language, TranslationKey, themes, themeList } from '@/lib/types';
import { UserIcon, LockIcon, GlobeIcon, PaletteIcon, LogOutIcon, CheckIcon, ChevronRightIcon, MusicIcon, BellIcon, BackIcon, UsersIcon, AddUserIcon, PlayIcon, PauseIcon } from '@/components/Icons';

type PrivacyOption = 'everyone' | 'contacts' | 'nobody';
type ChatSize = 'small' | 'medium' | 'large';
type SubPage = 'main' | 'profile' | 'privacy' | 'appearance' | 'notifications' | 'accounts';
const springTransition = { type: 'spring' as const, stiffness: 300, damping: 30 };

export default function SettingsView() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { t } = useLanguage();
  const { lang, setLang } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [subPage, setSubPage] = useState<SubPage>('main');

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? '');
  const [songUrl, setSongUrl] = useState(profile?.profile_song_url ?? '');
  const [songTitle, setSongTitle] = useState(profile?.song_title ?? '');
  const [songArtist, setSongArtist] = useState(profile?.song_artist ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  
  const [ghostMode, setGhostMode] = useState(profile?.ghost_mode ?? false);
  const [privacyMessages, setPrivacyMessages] = useState<PrivacyOption>('everyone');
  const [privacyCalls, setPrivacyCalls] = useState<PrivacyOption>('everyone');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const songInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? '');
      setBio(profile.bio ?? '');
      setUsername(profile.username ?? '');
      setAvatarUrl(profile.avatar_url ?? '');
      setSongUrl(profile.profile_song_url ?? '');
      setSongTitle(profile.song_title ?? '');
      setSongArtist(profile.song_artist ?? '');
      setGhostMode(profile.ghost_mode ?? false);
    }
  }, [profile]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !user) return;
    const fileName = `avatars/${user.id}.${file.name.split('.').pop()}`;
    await supabase.storage.from('media').upload(fileName, file, { upsert: true });
    const { data } = supabase.storage.from('media').getPublicUrl(fileName);
    setAvatarUrl(data.publicUrl);
  };

  const handleSongUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !user) return;
    const fileName = `songs/${user.id}/${Date.now()}.mp3`;
    const { error } = await supabase.storage.from('media').upload(fileName, file);
    if (error) return;
    const { data } = supabase.storage.from('media').getPublicUrl(fileName);
    setSongUrl(data.publicUrl);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault(); if (!user) return;
    setSaving(true);
    const updates: any = {
      display_name: displayName.trim() || null, bio: bio.trim() || null,
      avatar_url: avatarUrl || null, profile_song_url: songUrl || null,
      song_title: songTitle.trim() || null, song_artist: songArtist.trim() || null,
    };
    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
    if (error) alert("Ошибка: " + error.message);
    else { await refreshProfile(); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    setSaving(false);
  };

  const cards = [
    { key: 'profile', icon: UserIcon, label: t('profilePersonalization'), desc: 'Аватар, баннер, имя, био, песня' },
    { key: 'accounts', icon: UsersIcon, label: t('accounts'), desc: 'Переключение между аккаунтами' },
    { key: 'notifications', icon: BellIcon, label: t('notifications'), desc: 'Звуки, вибрации, превью' },
    { key: 'privacy', icon: LockIcon, label: t('privacy'), desc: 'Кто может писать и звонить' },
    { key: 'appearance', icon: PaletteIcon, label: t('appearanceAndLanguage'), desc: 'Темы и язык' },
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: 'var(--app-bg)' }}>
      <AnimatePresence mode="wait">
        {subPage === 'main' && (
          <motion.div key="main" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="p-4 space-y-3">
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--app-text)' }}>{t('settings')}</h2>
            <div className="glass-panel rounded-3xl p-5 flex items-center gap-4 mb-4">
              {avatarUrl ? <img src={avatarUrl} className="w-16 h-16 rounded-full object-cover" /> : <div className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-xl text-white" style={{ background: 'var(--app-accent-gradient)' }}>{displayName.slice(0,2).toUpperCase()}</div>}
              <div><p className="font-bold" style={{ color: 'var(--app-text)' }}>{displayName || 'User'}</p><p className="text-sm" style={{ color: 'var(--app-text-muted)' }}>@{username}</p></div>
            </div>
            {cards.map(({ key, icon: Icon, label, desc }) => (
              <motion.button key={key} whileTap={{ scale: 0.98 }} onClick={() => setSubPage(key as SubPage)} className="glass-panel rounded-2xl w-full p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-500 text-white"><Icon size={20} /></div>
                <div className="flex-1 text-left"><span className="font-medium block" style={{ color: 'var(--app-text)' }}>{label}</span><span className="text-xs block truncate" style={{ color: 'var(--app-text-muted)' }}>{desc}</span></div>
                <ChevronRightIcon size={18} style={{ color: 'var(--app-text-muted)' }} />
              </motion.button>
            ))}
            <button onClick={() => signOut()} className="w-full py-3 rounded-2xl mt-4 flex items-center justify-center gap-2 bg-red-500/10 text-red-500 font-semibold"><LogOutIcon size={20} /> Выйти</button>
          </motion.div>
        )}

        {subPage === 'profile' && (
          <motion.div key="profile" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="p-4">
            <button onClick={() => setSubPage('main')} className="mb-4 flex items-center gap-2" style={{ color: 'var(--app-text)' }}><BackIcon size={22} /> Назад</button>
            <div className="glass-panel rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-4">
                {avatarUrl ? <img src={avatarUrl} className="w-20 h-20 rounded-full object-cover" /> : <div className="w-20 h-20 rounded-full bg-blue-500" />}
                <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 rounded-xl text-sm font-medium border">Сменить фото</button>
                <input ref={fileInputRef} type="file" hidden onChange={handleAvatarUpload} />
              </div>
              <form onSubmit={handleSave} className="space-y-4">
                <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Имя" className="w-full px-4 py-2.5 rounded-xl border" style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }} />
                <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="О себе" className="w-full px-4 py-2.5 rounded-xl border" style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }} />
                
                <div className="pt-2">
                  <label className="block text-sm mb-1.5" style={{ color: 'var(--app-text-muted)' }}>Музыка</label>
                  <input type="text" value={songTitle} onChange={(e) => setSongTitle(e.target.value)} placeholder="Название песни" className="w-full px-4 py-2.5 rounded-xl border mb-2" style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }} />
                  <input type="text" value={songArtist} onChange={(e) => setSongArtist(e.target.value)} placeholder="Исполнитель" className="w-full px-4 py-2.5 rounded-xl border mb-2" style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }} />
                  <button type="button" onClick={() => songInputRef.current?.click()} className="px-4 py-2 rounded-xl text-sm font-medium border flex items-center gap-2"><MusicIcon size={16} /> Загрузить аудио</button>
                  <input ref={songInputRef} type="file" accept="audio/*" hidden onChange={handleSongUpload} />
                  {songUrl && <div className="mt-2 text-xs text-green-500">Аудио загружено!</div>}
                </div>
                
                <button type="submit" disabled={saving} className="w-full py-2.5 rounded-xl font-semibold text-white bg-blue-500">{saved ? 'Сохранено!' : 'Сохранить'}</button>
              </form>
            </div>
          </motion.div>
        )}

        {subPage === 'appearance' && (
          <motion.div key="appearance" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4">
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

        {subPage !== 'main' && subPage !== 'profile' && subPage !== 'appearance' && (
          <div className="p-4">
             <button onClick={() => setSubPage('main')} className="mb-4 flex items-center gap-2" style={{ color: 'var(--app-text)' }}><BackIcon size={22} /> Назад</button>
             <p style={{ color: 'var(--app-text-muted)' }}>Этот раздел в разработке...</p>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
