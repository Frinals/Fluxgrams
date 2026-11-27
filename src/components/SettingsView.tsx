import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { themes, useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { BackIcon, ImageIcon, PlayIcon, VerifiedIcon, LockIcon, BellIcon, LeafIcon } from '@/components/Icons';
import MusicPlayer from './MusicPlayer';
import { AnimatePresence } from 'framer-motion';

type SubPage = 'main' | 'edit_profile' | 'appearance' | 'privacy' | 'notifications' | 'currency';

export default function SettingsView({ onViewProfile }: any) {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [subPage, setSubPage] = useState<SubPage>('main');
  
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingMusic, setIsUploadingMusic] = useState(false);
  
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorText, setErrorText] = useState('');

  const [showPlayer, setShowPlayer] = useState(false);
  const [playerIndex, setPlayerIndex] = useState(0);
  
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setEditName(profile.display_name || '');
      setEditUsername(profile.username || '');
    }
  }, [profile]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsSaving(true);
    const cleanUsername = editUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (cleanUsername.length < 3) { setErrorText('Минимум 3 символа'); setShowErrorModal(true); setIsSaving(false); return; }
    
    const { error } = await supabase.from('profiles').update({ display_name: editName.trim(), username: cleanUsername }).eq('id', user.id);
    if (error) { setErrorText(error.code === '23505' ? 'Данный юз занят' : 'Ошибка: ' + error.message); setShowErrorModal(true); } 
    else { await refreshProfile(); setSubPage('main'); }
    setIsSaving(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'banner') => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setIsSaving(true); 
    const fileName = `profile/${user.id}/${type}_${Date.now()}.${file.name.split('.').pop()}`;
    const { error: uploadError } = await supabase.storage.from('media').upload(fileName, file);
    if (uploadError) { alert('Ошибка: ' + uploadError.message); setIsSaving(false); return; }
    const { data } = supabase.storage.from('media').getPublicUrl(fileName);
    await supabase.from('profiles').update({ [`${type}_url`]: data.publicUrl }).eq('id', user.id);
    await refreshProfile();
    setIsSaving(false);
  };

  const handleMusicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const currentMusic = Array.isArray(profile?.profile_music) ? profile.profile_music : [];
    
    // ЛИМИТ НА 3 ПЕСНИ
    if (currentMusic.length >= 3) {
      alert('Лимит исчерпан! В профиле можно хранить максимум 3 песни.');
      return;
    }

    if (file.size > 15 * 1024 * 1024) { alert('Файл слишком большой (макс 15 МБ)'); return; }
    
    setIsUploadingMusic(true);
    try {
      const fileName = `music/${user.id}/${Date.now()}.${file.name.split('.').pop()}`;
      const { error: uploadError } = await supabase.storage.from('media').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('media').getPublicUrl(fileName);
      const newSong = { title: file.name.replace(/\.[^/.]+$/, ""), url: data.publicUrl };
      
      const { error: updateError } = await supabase.from('profiles').update({ profile_music: [...currentMusic, newSong] }).eq('id', user.id);
      if (updateError) throw updateError;
      
      await refreshProfile();
      alert('Трек успешно добавлен!');
    } catch (error: any) {
      alert('Ошибка: ' + error.message);
    } finally {
      setIsUploadingMusic(false);
    }
  };

  const settingsList = [
    { key: 'privacy', icon: LockIcon, label: 'Приватность', desc: 'Кто может писать' },
    { key: 'notifications', icon: BellIcon, label: 'Уведомления', desc: 'Звуки и вибрация' },
    { key: 'currency', icon: LeafIcon, label: 'Валюта', desc: 'Листики и подарки' },
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto relative" style={{ background: 'var(--app-bg)' }}>
      
      {showErrorModal && (
        <div className="fixed inset-0 z-[99999] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="rounded-3xl p-6 w-full max-w-xs text-center liquid-glass">
            <p className="font-bold mb-6" style={{ color: 'var(--app-text)' }}>{errorText}</p>
            <button onClick={() => setShowErrorModal(false)} className="w-full py-3 rounded-xl font-bold text-white active:scale-95 transition-transform" style={{ background: 'var(--app-accent)' }}>Понятно</button>
          </div>
        </div>
      )}

      {subPage === 'main' && (
        <div className="pb-24">
          <div className="relative w-full h-40" style={{ background: 'var(--app-accent)' }}>
             {profile?.banner_url && <img src={profile.banner_url} className="w-full h-full object-cover" />}
             <button onClick={() => bannerInputRef.current?.click()} className="absolute top-4 right-4 p-2 text-white rounded-full liquid-glass">
               <ImageIcon size={20} />
             </button>
             <input type="file" ref={bannerInputRef} hidden accept="image/*" onChange={(e) => handleImageUpload(e, 'banner')} />
          </div>

          <div className="px-4 flex flex-col items-center -mt-14 relative z-10">
            <div className="relative">
              <div className="w-28 h-28 rounded-full border-4 overflow-hidden flex items-center justify-center text-4xl text-white font-bold liquid-glass" style={{ borderColor: 'var(--app-bg)' }}>
                {profile?.avatar_url ? <img src={profile.avatar_url} className="w-full h-full object-cover" /> : profile?.display_name?.[0] || 'U'}
              </div>
              <button onClick={() => avatarInputRef.current?.click()} className="absolute bottom-0 right-0 p-2 rounded-full text-white liquid-glass">
                <ImageIcon size={16} />
              </button>
              <input type="file" ref={avatarInputRef} hidden accept="image/*" onChange={(e) => handleImageUpload(e, 'avatar')} />
            </div>

            <div className="text-center mt-3">
              <div className="flex items-center justify-center gap-1">
                <h2 className="text-2xl font-bold" style={{ color: 'var(--app-text)' }}>{profile?.display_name || 'Пользователь'}</h2>
                {profile?.is_verified && <VerifiedIcon size={20} className="text-green-500" />}
              </div>
              <p className="text-sm" style={{ color: 'var(--app-text-muted)' }}>@{profile?.username || 'user'}</p>
            </div>

            <div className="grid grid-cols-4 gap-3 w-full max-w-md mt-6">
              <button onClick={() => setSubPage('edit_profile')} className="flex flex-col items-center p-3 rounded-2xl liquid-glass">
                <span className="text-xl mb-1">✏️</span><span className="text-xs" style={{ color: 'var(--app-text)' }}>Имя</span>
              </button>
              <button onClick={() => setSubPage('appearance')} className="flex flex-col items-center p-3 rounded-2xl liquid-glass">
                <span className="text-xl mb-1">⚙️</span><span className="text-xs" style={{ color: 'var(--app-text)' }}>Темы</span>
              </button>
              <button onClick={() => signOut()} className="flex flex-col items-center p-3 rounded-2xl liquid-glass">
                <span className="text-xl mb-1">🚪</span><span className="text-xs" style={{ color: '#ef4444' }}>Выйти</span>
              </button>
            </div>

            <div className="w-full max-w-md mt-8">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-lg" style={{ color: 'var(--app-text)' }}>Музыка (Макс 3)</h3>
                <button onClick={() => musicInputRef.current?.click()} disabled={isUploadingMusic} className="text-sm font-semibold px-3 py-1 rounded-full text-white liquid-glass disabled:opacity-50" style={{ background: 'var(--app-accent)' }}>
                  {isUploadingMusic ? '...' : '+ Добавить'}
                </button>
                <input type="file" ref={musicInputRef} hidden accept="audio/*" onChange={handleMusicUpload} />
              </div>
              <div className="rounded-2xl overflow-hidden liquid-glass">
                {(!profile?.profile_music || profile.profile_music.length === 0) ? (
                  <p className="p-5 text-center text-sm" style={{ color: 'var(--app-text-muted)' }}>Нет добавленных треков</p>
                ) : (
                  profile.profile_music.map((song: any, idx: number) => (
                    <div key={idx} onClick={() => { setPlayerIndex(idx); setShowPlayer(true); }} className="flex items-center gap-3 p-4 cursor-pointer border-b last:border-0" style={{ borderColor: 'var(--app-border)' }}>
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0" style={{ background: 'var(--app-accent)' }}><PlayIcon size={18} /></div>
                      <div className="flex-1 min-w-0"><p className="text-[15px] font-medium truncate" style={{ color: 'var(--app-text)' }}>{song.title}</p></div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="w-full max-w-md mt-6 space-y-2">
              {settingsList.map(({ key, icon: Icon, label, desc }) => (
                <button key={key} onClick={() => setSubPage(key as SubPage)} className="w-full p-4 rounded-2xl liquid-glass flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--app-accent)', color: 'white' }}><Icon size={20} /></div>
                  <div className="flex-1 text-left"><span className="font-semibold block text-[15px]" style={{ color: 'var(--app-text)' }}>{label}</span><span className="text-xs block" style={{ color: 'var(--app-text-muted)' }}>{desc}</span></div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {subPage === 'edit_profile' && (
        <div className="p-4 pb-24">
          <button onClick={() => setSubPage('main')} className="mb-4 flex items-center gap-2" style={{ color: 'var(--app-text)' }}><BackIcon size={22} /> Назад</button>
          <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--app-text)' }}>Настройка аккаунта</h2>
          <div className="space-y-4">
            <div><label className="block text-sm mb-1" style={{ color: 'var(--app-text-muted)' }}>Имя</label><input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full p-4 rounded-2xl outline-none liquid-glass" style={{ color: 'var(--app-text)' }} /></div>
            <div><label className="block text-sm mb-1" style={{ color: 'var(--app-text-muted)' }}>Юзернейм (@)</label><input type="text" value={editUsername} onChange={e => setEditUsername(e.target.value)} className="w-full p-4 rounded-2xl outline-none liquid-glass" style={{ color: 'var(--app-text)' }} /></div>
            <button onClick={handleSaveProfile} disabled={isSaving} className="w-full py-4 rounded-2xl font-bold text-white mt-6 active:scale-95 transition-transform liquid-glass" style={{ background: 'var(--app-accent)' }}>Сохранить</button>
          </div>
        </div>
      )}

      {subPage === 'appearance' && (
        <div className="p-4 pb-24">
          <button onClick={() => setSubPage('main')} className="mb-4 flex items-center gap-2" style={{ color: 'var(--app-text)' }}><BackIcon size={22} /> Назад</button>
          <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--app-text)' }}>Оформление</h2>
          <div className="grid grid-cols-3 gap-3">
             {(['pitch_black', 'light', 'violet', 'new_year', 'halloween', 'cyberpunk'] as const).map((key) => (
                <button key={key} onClick={() => setTheme(key)} className="p-3 rounded-2xl border flex flex-col items-center gap-2 active:scale-95 transition-transform liquid-glass" style={{ borderColor: theme === key ? 'var(--app-accent)' : 'var(--app-border)' }}>
                  <div className="w-10 h-10 rounded-full border border-white/20" style={{ background: themes[key]?.accent || '#333' }} />
                  <span className="text-xs text-center" style={{ color: 'var(--app-text)' }}>{key.replace('_', ' ')}</span>
                </button>
             ))}
          </div>
        </div>
      )}

      {['privacy', 'notifications', 'currency'].includes(subPage) && (
        <div className="p-4 pb-24">
          <button onClick={() => setSubPage('main')} className="mb-4 flex items-center gap-2" style={{ color: 'var(--app-text)' }}><BackIcon size={22} /> Назад</button>
          <h2 className="text-xl font-bold capitalize mb-4" style={{ color: 'var(--app-text)' }}>{subPage}</h2>
          <p className="text-sm" style={{ color: 'var(--app-text-muted)' }}>Раздел в разработке.</p>
        </div>
      )}

      <AnimatePresence>
        {showPlayer && profile?.profile_music && (
          <MusicPlayer songs={profile.profile_music} initialIndex={playerIndex} onClose={() => setShowPlayer(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
