import { useState, useEffect, useRef, FormEvent, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, Profile } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeName, Language, TranslationKey, themes, themeList } from '@/lib/types';
import {
  UserIcon, LockIcon, GlobeIcon, PaletteIcon, LogOutIcon, CheckIcon,
  ChevronRightIcon, MusicIcon, BellIcon, BackIcon, UsersIcon, AddUserIcon,
  PlayIcon, PauseIcon
} from '@/components/Icons';

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
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'available' | 'taken'>('idle');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? '');
  const [songUrl, setSongUrl] = useState(profile?.profile_song_url ?? '');
  
  // НОВЫЕ ПОЛЯ ДЛЯ МУЗЫКИ
  const [songTitle, setSongTitle] = useState(profile?.song_title ?? '');
  const [songArtist, setSongArtist] = useState(profile?.song_artist ?? '');

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  
  // ... (остальные состояния privacy, notifications, accounts остаются прежними)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const songInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? '');
      setBio(profile.bio ?? '');
      setUsername(profile.username ?? '');
      setAvatarUrl(profile.avatar_url ?? '');
      setSongUrl(profile.profile_song_url ?? '');
      setSongTitle(profile.song_title ?? ''); // Подгружаем название
      setSongArtist(profile.song_artist ?? ''); // Подгружаем исполнителя
    }
  }, [profile]);

  const handleSongUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const ext = file.name.split('.').pop() || 'mp3';
    const fileName = `songs/${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('media').upload(fileName, file);
    if (error) { console.error(error); return; }
    const { data: urlData } = supabase.storage.from('media').getPublicUrl(fileName);
    setSongUrl(urlData.publicUrl);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    
    const updates: Partial<Profile> = {
      display_name: displayName.trim() || null,
      bio: bio.trim() || null,
      avatar_url: avatarUrl || null,
      profile_song_url: songUrl || null,
      song_title: songTitle.trim() || null, // Сохраняем название
      song_artist: songArtist.trim() || null, // Сохраняем исполнителя
    };
    
    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
    if (error) { alert("Ошибка: " + error.message); setSaving(false); return; }

    await refreshProfile();
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  // ... (Интерфейс профиля, добавь эти инпуты в форму)
  return (
     <div className="p-4">
        {/* ... (Твой код аватара и имени) */}
        <form onSubmit={handleSave} className="space-y-4">
          {/* ... Инпуты displayName и bio ... */}
          
          <div>
            <label className="block text-sm mb-1.5" style={{ color: 'var(--app-text-muted)' }}>Песня профиля</label>
            <div className="flex flex-col gap-2">
              <input 
                type="text" value={songTitle} onChange={(e) => setSongTitle(e.target.value)} 
                placeholder="Название песни" 
                className="w-full px-4 py-2.5 rounded-xl border" 
                style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }} 
              />
              <input 
                type="text" value={songArtist} onChange={(e) => setSongArtist(e.target.value)} 
                placeholder="Исполнитель" 
                className="w-full px-4 py-2.5 rounded-xl border" 
                style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }} 
              />
            </div>
            <button type="button" onClick={() => songInputRef.current?.click()} className="mt-2 px-4 py-2 rounded-xl text-sm font-medium border flex items-center gap-2" style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
              <MusicIcon size={16} /> Загрузить аудиофайл
            </button>
            <input ref={songInputRef} type="file" accept="audio/*" hidden onChange={handleSongUpload} />
          </div>
          
          <button type="submit" className="w-full py-2.5 rounded-xl font-semibold bg-blue-500 text-white">Сохранить</button>
        </form>
     </div>
  );
}
