import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { themes, useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { BackIcon, ImageIcon, PlayIcon, VerifiedIcon, LockIcon, BellIcon, LeafIcon } from '@/components/Icons';
import MusicPlayer from './MusicPlayer';
import { AnimatePresence, motion } from 'framer-motion';

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

    if (cleanUsername.length < 3) {
      setErrorText('Юзернейм должен быть не короче 3 символов');
      setShowErrorModal(true);
      setIsSaving(false);
      return;
    }

    const { error } = await supabase.from('profiles').update({ 
      display_name: editName.trim(), username: cleanUsername 
    }).eq('id', user.id);

    if (error) {
      setErrorText(error.code === '23505' ? 'Данный юз занят' : 'Ошибка: ' + error.message);
      setShowErrorModal(true);
    } else {
      await refreshProfile();
      setSubPage('main');
    }
    setIsSaving(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'banner') => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    setIsSaving(true); 
    const fileName = `profile/${user.id}/${type}_${Date.now()}.${file.name.split('.').pop()}`;
    
    const { error: uploadError } = await supabase.storage.from('media').upload(fileName, file);
    if (uploadError) { 
      alert('Ошибка загрузки: ' + uploadError.message); 
      setIsSaving(false); return; 
    }

    const { data } = supabase.storage.from('media').getPublicUrl(fileName);
    await supabase.from('profiles').update({ [`${type}_url`]: data.publicUrl }).eq('id', user.id);
    
    await refreshProfile();
    setIsSaving(false);
  };

  const handleMusicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Проверка размера (макс 15 МБ)
    if (file.size > 15 * 1024 * 1024) {
      alert('Файл слишком большой! Максимум 15 МБ.');
      return;
    }
    
    setIsUploadingMusic(true);
    try {
      const fileName = `music/${user.id}/${Date.now()}.${file.name.split('.').pop()}`;
      const { error: uploadError } = await supabase.storage.from('media').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('media').getPublicUrl(fileName);

      // Правильно формируем новый трек
      const newSong = { title: file.name.replace(/\.[^/.]+$/, ""), url: data.publicUrl };
      const currentMusic = Array.isArray(profile?.profile_music) ? profile.profile_music : [];
      
      const { error: updateError } = await supabase.from('profiles').update({ 
        profile_music: [...currentMusic, newSong] 
      }).eq('id', user.id);

      if (updateError) throw updateError;
      
      await refreshProfile();
      alert('Трек успешно добавлен!');
    } catch (error: any) {
      alert('Ошибка при добавлении музыки: ' + error.message);
    } finally {
      setIsUploadingMusic(false);
    }
  };

  const openPlayer = (index: number) => {
    setPlayerIndex(index);
    setShowPlayer(true);
  };

  const settingsList = [
    { key: 'privacy', icon: LockIcon, label: 'Приватность', desc: 'Кто может писать' },
    { key: 'notifications', icon: BellIcon, label: 'Уведомления', desc: 'Звуки и вибрация' },
    { key: 'currency', icon: LeafIcon, label: 'Валюта', desc: 'Листики и подарки' },
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-black text-white relative">
      
      {/* Ошибки */}
      {showErrorModal && (
        <div className="fixed inset-0 z-[99999] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="rounded-3xl p-6 w-full max-w-xs text-center border border-white/10 shadow-2xl bg-[#1a1a1a]">
            <div className="text-4xl mb-3">⚠️</div>
            <p className="font-bold text-[15px] mb-6">{errorText}</p>
            <button onClick={() => setShowErrorModal(false)} className="w-full py-3 rounded-xl font-bold bg-blue-500 text-white active:scale-95 transition-transform">Понятно</button>
          </div>
        </div>
      )}

      {subPage === 'main' && (
        <div className="pb-24">
          {/* Баннер */}
          <div className="relative w-full h-40 bg-gradient-to-r from-blue-900 to-black">
             {profile?.banner_url && <img src={profile.banner_url} className="w-full h-full object-cover" />}
             <button onClick={() => bannerInputRef.current?.click()} className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full backdrop-blur-md active:scale-95 transition-transform">
               <ImageIcon size={20} />
             </button>
             <input type="file" ref={bannerInputRef} hidden accept="image/*" onChange={(e) => handleImageUpload(e, 'banner')} />
          </div>

          <div className="px-4 flex flex-col items-center -mt-14 relative z-10">
            {/* Аватар */}
            <div className="relative">
              <div className="w-28 h-28 rounded-full border-4 border-black overflow-hidden flex items-center justify-center text-4xl text-white font-bold shadow-2xl bg-[#1a1a1a]">
                {profile?.avatar_url ? <img src={profile.avatar_url} className="w-full h-full object-cover" /> : profile?.display_name?.[0] || 'U'}
              </div>
              <button onClick={() => avatarInputRef.current?.click()} className="absolute bottom-0 right-0 p-2 rounded-full text-white border-2 border-black bg-blue-500 active:scale-95 transition-transform">
                <ImageIcon size={16} />
              </button>
              <input type="file" ref={avatarInputRef} hidden accept="image/*" onChange={(e) => handleImageUpload(e, 'avatar')} />
            </div>

            <div className="text-center mt-3">
              <div className="flex items-center justify-center gap-1">
                <h2 className="text-2xl font-bold">{profile?.display_name || 'Пользователь'}</h2>
                {profile?.is_verified && <VerifiedIcon size={20} className="text-green-500" />}
              </div>
              <p className="text-sm text-gray-400">@{profile?.username || 'user'}</p>
              <p className="text-xs mt-1 text-green-500 font-medium">В сети</p>
            </div>

            {/* Кнопки быстрого доступа */}
            <div className="grid grid-cols-4 gap-3 w-full max-w-md mt-6">
              <button onClick={() => avatarInputRef.current?.click()} className="flex flex-col items-center p-3 rounded-2xl bg-[#1a1a1a] border border-white/5 active:scale-95 transition-all">
                <span className="text-xl mb-1">📷</span><span className="text-xs text-gray-300">Фото</span>
              </button>
              <button onClick={() => bannerInputRef.current?.click()} className="flex flex-col items-center p-3 rounded-2xl bg-[#1a1a1a] border border-white/5 active:scale-95 transition-all">
                <span className="text-xl mb-1">🖼️</span><span className="text-xs text-gray-300">Баннер</span>
              </button>
              <button onClick={() => setSubPage('edit_profile')} className="flex flex-col items-center p-3 rounded-2xl bg-[#1a1a1a] border border-white/5 active:scale-95 transition-all">
                <span className="text-xl mb-1">✏️</span><span className="text-xs text-gray-300">Имя</span>
              </button>
              <button onClick={() => setSubPage('appearance')} className="flex flex-col items-center p-3 rounded-2xl bg-[#1a1a1a] border border-white/5 active:scale-95 transition-all">
                <span className="text-xl mb-1">⚙️</span><span className="text-xs text-gray-300">Темы</span>
              </button>
            </div>

            {/* Музыка */}
            <div className="w-full max-w-md mt-8">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-lg">Музыка</h3>
                <button onClick={() => musicInputRef.current?.click()} disabled={isUploadingMusic} className="text-sm font-semibold px-4 py-1.5 rounded-full text-white bg-blue-500 disabled:opacity-50 active:scale-95 transition-transform">
                  {isUploadingMusic ? 'Загрузка...' : '+ Добавить'}
                </button>
                <input type="file" ref={musicInputRef} hidden accept="audio/*" onChange={handleMusicUpload} />
              </div>
              <div className="rounded-3xl overflow-hidden border border-white/5 bg-[#1a1a1a]">
                {(!profile?.profile_music || profile.profile_music.length === 0) ? (
                  <p className="p-6 text-center text-sm text-gray-500">Нет добавленных треков</p>
                ) : (
                  profile.profile_music.map((song: any, idx: number) => (
                    <div key={idx} onClick={() => openPlayer(idx)} className="flex items-center gap-3 p-4 cursor-pointer border-b border-white/5 last:border-0 active:bg-white/5 transition-colors">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0 bg-blue-500 shadow-lg">
                        <PlayIcon size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-medium truncate">{song.title}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* СПИСОК НАСТРОЕК (ВЕРНУЛИ!) */}
            <div className="w-full max-w-md mt-6 space-y-2">
              {settingsList.map(({ key, icon: Icon, label, desc }) => (
                <button key={key} onClick={() => setSubPage(key as SubPage)} className="w-full p-4 rounded-2xl bg-[#1a1a1a] border border-white/5 flex items-center gap-4 active:scale-[0.98] transition-transform">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-500/20 text-blue-500">
                    <Icon size={20} />
                  </div>
                  <div className="flex-1 text-left">
                    <span className="font-semibold block text-[15px]">{label}</span>
                    <span className="text-xs text-gray-500 block">{desc}</span>
                  </div>
                  <span className="text-gray-500">›</span>
                </button>
              ))}
            </div>
            
            <button onClick={() => signOut()} className="w-full max-w-md py-4 rounded-2xl mt-6 font-semibold bg-red-500/10 text-red-500 active:scale-[0.98] transition-transform">Выйти из аккаунта</button>
          </div>
        </div>
      )}

      {/* ... Остальные страницы (edit_profile, appearance) оставляем без изменений, они уже были ... */}
      {subPage === 'edit_profile' && (
        <div className="p-4 pb-24">
          <button onClick={() => setSubPage('main')} className="mb-4 flex items-center gap-2 text-white"><BackIcon size={22} /> Назад</button>
          <h2 className="text-2xl font-bold mb-6">Настройка аккаунта</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm mb-1 text-gray-400">Имя</label>
              <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full p-4 rounded-2xl bg-[#1a1a1a] text-white border border-white/10 outline-none focus:border-blue-500 transition-colors" />
            </div>
            <div>
              <label className="block text-sm mb-1 text-gray-400">Юзернейм (@)</label>
              <input type="text" value={editUsername} onChange={e => setEditUsername(e.target.value)} className="w-full p-4 rounded-2xl bg-[#1a1a1a] text-white border border-white/10 outline-none focus:border-blue-500 transition-colors" />
            </div>
            <button onClick={handleSaveProfile} disabled={isSaving} className="w-full py-4 rounded-2xl font-bold text-white mt-6 bg-blue-500 disabled:opacity-50 active:scale-95 transition-transform">Сохранить</button>
          </div>
        </div>
      )}

      {subPage === 'appearance' && (
        <div className="p-4 pb-24">
          <button onClick={() => setSubPage('main')} className="mb-4 flex items-center gap-2 text-white"><BackIcon size={22} /> Назад</button>
          <h2 className="text-xl font-bold mb-4">Оформление</h2>
          <div className="grid grid-cols-3 gap-3">
             {(['pitch_black', 'light', 'new_year', 'halloween', 'cyberpunk', 'dark'] as const).map((key) => (
                <button key={key} onClick={() => setTheme(key)} className="p-3 rounded-2xl border flex flex-col items-center gap-2 active:scale-95 transition-transform" style={{ background: theme === key ? 'var(--app-surface)' : 'transparent', borderColor: theme === key ? 'var(--app-accent)' : 'var(--app-border)' }}>
                  <div className="w-10 h-10 rounded-full border border-white/20" style={{ background: themes[key]?.accent || '#333' }} />
                  <span className="text-xs text-center">{key.replace('_', ' ')}</span>
                </button>
             ))}
          </div>
        </div>
      )}

      {['privacy', 'notifications', 'currency'].includes(subPage) && (
        <div className="p-4 pb-24">
          <button onClick={() => setSubPage('main')} className="mb-4 flex items-center gap-2 text-white"><BackIcon size={22} /> Назад</button>
          <h2 className="text-xl font-bold capitalize mb-4">{subPage === 'privacy' ? 'Приватность' : subPage === 'notifications' ? 'Уведомления' : 'Валюта'}</h2>
          <p className="text-sm text-gray-400">Этот раздел в разработке.</p>
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
