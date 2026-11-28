import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { themes, useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { BackIcon, ImageIcon, PlayIcon, VerifiedIcon, LockIcon, BellIcon, LeafIcon, MusicIcon, ChevronRightIcon, PaletteIcon, EditIcon } from '@/components/Icons';
import MusicPlayer from './MusicPlayer';
import { AnimatePresence, motion } from 'framer-motion';

type SubPage = 'main' | 'appearance' | 'privacy' | 'notifications' | 'currency' | 'studio' | 'gifts';

export default function SettingsView({ onViewProfile }: any) {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [subPage, setSubPage] = useState<SubPage>('main');
  
  // Стейты для быстрого редактирования
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorText, setErrorText] = useState('');

  const [showPlayer, setShowPlayer] = useState(false);
  const [playerIndex, setPlayerIndex] = useState(0);

  // Стейты для Студии
  const [songTitle, setSongTitle] = useState('');
  const [songArtist, setSongArtist] = useState('');
  const [songCover, setSongCover] = useState<string | null>(null);
  const [songBanner, setSongBanner] = useState<string | null>(null);
  const [isUploadingStudio, setIsUploadingStudio] = useState(false);
  
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);
  const studioAudioRef = useRef<HTMLInputElement>(null);
  const studioCoverRef = useRef<HTMLInputElement>(null);
  const studioBannerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setEditName(profile.display_name || '');
      setEditUsername(profile.username || '');
    }
  }, [profile]);

  const showError = (text: string) => {
    setErrorText(text);
    setShowErrorModal(true);
  };

  // Сохранение имени/юзернейма
  const handleSaveField = async (field: 'name' | 'username') => {
    if (!user) return;
    setIsSaving(true);
    
    let updates = {};
    if (field === 'name') {
      updates = { display_name: editName.trim() };
      setIsEditingName(false);
    } else {
      const cleanUsername = editUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (cleanUsername.length < 3) { showError('Минимум 3 символа'); setIsSaving(false); return; }
      updates = { username: cleanUsername };
      setIsEditingUsername(false);
    }
    
    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
    if (error) { 
      showError(error.code === '23505' ? 'Данный юз занят' : 'Ошибка: ' + error.message); 
    } else { 
      await refreshProfile(); 
    }
    setIsSaving(false);
  };

  // Загрузка аватарки/баннера профиля
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'banner') => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setIsSaving(true); 
    const fileName = `profile/${user.id}/${type}_${Date.now()}.${file.name.split('.').pop()}`;
    const { error: uploadError } = await supabase.storage.from('media').upload(fileName, file);
    if (uploadError) { showError('Ошибка: ' + uploadError.message); setIsSaving(false); return; }
    const { data } = supabase.storage.from('media').getPublicUrl(fileName);
    await supabase.from('profiles').update({ [`${type}_url`]: data.publicUrl }).eq('id', user.id);
    await refreshProfile();
    setIsSaving(false);
  };

  // Покупка Студии
  const handleBuyStudio = async () => {
    if (!user || !profile) return;
    const currentBalance = (profile as any).leaf_balance || 0;
    if (currentBalance < 80) { showError('Недостаточно средств (Нужно 80 🍃)'); return; }

    setIsSaving(true);
    const { error } = await supabase.from('profiles').update({
      leaf_balance: currentBalance - 80,
      has_studio_access: true 
    }).eq('id', user.id);

    if (error) { showError('Ошибка при покупке: ' + error.message); } 
    else { await refreshProfile(); alert('Доступ к Студии открыт навсегда!'); }
    setIsSaving(false);
  };

  // Загрузка обложки/баннера для Студии
  const handleStudioImage = async (e: React.ChangeEvent<HTMLInputElement>, type: 'cover' | 'banner') => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const fileName = `studio/${user.id}/${type}_${Date.now()}.${file.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('media').upload(fileName, file);
    if (error) { showError('Ошибка: ' + error.message); return; }
    const { data } = supabase.storage.from('media').getPublicUrl(fileName);
    
    if (type === 'cover') setSongCover(data.publicUrl);
    else setSongBanner(data.publicUrl);
  };

  // Загрузка песни в Студию
  const handleStudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!songTitle.trim() || !songArtist.trim()) { showError('Введите название песни и исполнителя!'); return; }
    if (file.size > 20 * 1024 * 1024) { showError('Файл слишком большой (макс 20 МБ)'); return; }
    
    setIsUploadingStudio(true);
    try {
      const fileName = `studio/${user.id}/track_${Date.now()}.${file.name.split('.').pop()}`;
      const { error: uploadError } = await supabase.storage.from('media').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('media').getPublicUrl(fileName);
      const newStudioSong = { 
        title: songTitle.trim(), 
        artist: songArtist.trim(), 
        url: data.publicUrl,
        cover: songCover || null,
        banner: songBanner || null
      };
      
      const { error: updateError } = await supabase.from('profiles').update({ studio_song: newStudioSong }).eq('id', user.id);
      if (updateError) throw updateError;
      
      await refreshProfile();
      alert('Песня успешно загружена в Студию!');
    } catch (error: any) {
      showError('Ошибка: ' + error.message);
    } finally {
      setIsUploadingStudio(false);
    }
  };

  const settingsList = [
    { key: 'studio', icon: MusicIcon, label: 'Студия', desc: 'Загрузить свой трек (1 раз)' },
    { key: 'gifts', icon: LeafIcon, label: 'Подарки', desc: 'Магазин и мои подарки' }, // <-- ВКЛАДКА ПОДАРКОВ
    { key: 'currency', icon: LeafIcon, label: 'Валюта', desc: 'Баланс листиков' },
    { key: 'appearance', icon: PaletteIcon, label: 'Темы', desc: 'Оформление приложения' },
    { key: 'privacy', icon: LockIcon, label: 'Приватность', desc: 'Кто может писать' },
    { key: 'notifications', icon: BellIcon, label: 'Уведомления', desc: 'Звуки и вибрация' },
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto relative pb-24" style={{ background: 'var(--app-bg)' }}>
      
      {/* МОДАЛКА ОШИБКИ */}
      {showErrorModal && (
        <div className="fixed inset-0 z-[99999] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="rounded-3xl p-6 w-full max-w-xs text-center liquid-glass">
            <p className="font-bold mb-6 text-[15px]" style={{ color: 'var(--app-text)' }}>{errorText}</p>
            <button onClick={() => setShowErrorModal(false)} className="w-full py-3 rounded-xl font-bold text-white active:scale-95 transition-transform" style={{ background: 'var(--app-accent)' }}>Понятно</button>
          </div>
        </div>
      )}

      {subPage === 'main' && (
        <div>
          {/* БАННЕР (Кликабельный) */}
          <div className="relative w-full h-48 cursor-pointer group" onClick={() => bannerInputRef.current?.click()}>
             {profile?.banner_url ? (
               <img src={profile.banner_url} className="w-full h-full object-cover" />
             ) : (
               <div className="w-full h-full bg-gradient-to-r from-blue-900 to-purple-900" />
             )}
             <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
               <ImageIcon size={32} className="text-white/70" />
             </div>
             <input type="file" ref={bannerInputRef} hidden accept="image/*" onChange={(e) => handleImageUpload(e, 'banner')} />
          </div>

          <div className="px-4 flex flex-col items-center -mt-16 relative z-10">
            
            {/* АВАТАРКА (Кликабельная) */}
            <div className="relative cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
              <div className="w-32 h-32 rounded-full border-4 overflow-hidden flex items-center justify-center text-5xl text-white font-bold liquid-glass" style={{ borderColor: 'var(--app-bg)' }}>
                {profile?.avatar_url ? <img src={profile.avatar_url} className="w-full h-full object-cover" /> : profile?.display_name?.[0] || 'U'}
              </div>
              <button className="absolute bottom-1 right-1 p-2 rounded-full text-white liquid-glass">
                <ImageIcon size={18} />
              </button>
              <input type="file" ref={avatarInputRef} hidden accept="image/*" onChange={(e) => handleImageUpload(e, 'avatar')} />
            </div>

            {/* ИМЯ И ЮЗЕРНЕЙМ (Быстрое редактирование) */}
            <div className="text-center mt-4 w-full max-w-sm">
              
              {/* Имя */}
              <div className="flex items-center justify-center gap-2 mb-1">
                {isEditingName ? (
                  <div className="flex items-center gap-2 w-full px-4">
                    <input autoFocus type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full bg-transparent border-b border-white text-center text-2xl font-bold outline-none" style={{ color: 'var(--app-text)' }} />
                    <button onClick={() => handleSaveField('name')} disabled={isSaving} className="text-green-500 font-bold text-sm">ОК</button>
                  </div>
                ) : (
                  <div onClick={() => setIsEditingName(true)} className="flex items-center justify-center gap-2 cursor-pointer group">
                    <h2 className="text-2xl font-bold" style={{ color: 'var(--app-text)' }}>{profile?.display_name || 'Пользователь'}</h2>
                    {(profile as any)?.is_verified && <VerifiedIcon size={20} className="text-green-500" />}
                    <EditIcon size={16} className="opacity-0 group-hover:opacity-50 transition-opacity" style={{ color: 'var(--app-text)' }} />
                  </div>
                )}
              </div>

              {/* Юзернейм */}
              <div className="flex items-center justify-center h-6">
                {isEditingUsername ? (
                  <div className="flex items-center gap-2 w-full px-6">
                    <span className="text-sm" style={{ color: 'var(--app-text-muted)' }}>@</span>
                    <input autoFocus type="text" value={editUsername} onChange={e => setEditUsername(e.target.value)} className="w-full bg-transparent border-b border-white text-center text-sm outline-none" style={{ color: 'var(--app-text)' }} />
                    <button onClick={() => handleSaveField('username')} disabled={isSaving} className="text-green-500 font-bold text-sm">ОК</button>
                  </div>
                ) : (
                  <div onClick={() => setIsEditingUsername(true)} className="flex items-center gap-1 cursor-pointer group">
                    <p className="text-sm" style={{ color: 'var(--app-text-muted)' }}>@{profile?.username || 'user'}</p>
                    <EditIcon size={12} className="opacity-0 group-hover:opacity-50 transition-opacity" style={{ color: 'var(--app-text-muted)' }} />
                  </div>
                )}
              </div>
            </div>

            {/* БАЛАНС */}
            <div className="w-full max-w-md mt-6 p-4 rounded-3xl liquid-glass flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl bg-green-500/20">🍃</div>
                <div>
                  <p className="text-sm" style={{ color: 'var(--app-text-muted)' }}>Ваш баланс</p>
                  <p className="font-bold text-xl" style={{ color: 'var(--app-text)' }}>{(profile as any)?.leaf_balance || 0} листиков</p>
                </div>
              </div>
              <button onClick={() => onViewProfile(profile?.id)} className="px-4 py-2 rounded-xl text-sm font-bold liquid-glass" style={{ color: 'var(--app-text)' }}>Профиль</button>
            </div>

            {/* СПИСОК НАСТРОЕК */}
            <div className="w-full max-w-md mt-4 space-y-2">
              {settingsList.map(({ key, icon: Icon, label, desc }) => (
                <button key={key} onClick={() => setSubPage(key as SubPage)} className="w-full p-4 rounded-2xl liquid-glass flex items-center gap-4 active:scale-[0.98] transition-transform">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--app-accent)', color: 'white' }}><Icon size={20} /></div>
                  <div className="flex-1 text-left">
                    <span className="font-semibold block text-[15px]" style={{ color: 'var(--app-text)' }}>{label}</span>
                    <span className="text-xs block" style={{ color: 'var(--app-text-muted)' }}>{desc}</span>
                  </div>
                  <ChevronRightIcon size={20} style={{ color: 'var(--app-text-muted)' }} />
                </button>
              ))}
              <button onClick={() => signOut()} className="w-full py-4 mt-2 rounded-2xl liquid-glass font-semibold text-red-500 active:scale-[0.98] transition-transform">Выйти из аккаунта</button>
            </div>
          </div>
        </div>
      )}

      {/* СТУДИЯ */}
      {subPage === 'studio' && (
        <div className="p-4">
          <button onClick={() => setSubPage('main')} className="mb-4 flex items-center gap-2" style={{ color: 'var(--app-text)' }}><BackIcon size={22} /> Назад</button>
          <div className="text-center mb-6">
            <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center text-4xl bg-purple-500/20 text-purple-500 mb-3">🎙️</div>
            <h2 className="text-2xl font-bold" style={{ color: 'var(--app-text)' }}>Flux Studio</h2>
          </div>

          {!(profile as any)?.has_studio_access ? (
            <div className="p-6 rounded-3xl liquid-glass text-center">
              <h3 className="font-bold text-lg mb-2" style={{ color: 'var(--app-text)' }}>Доступ закрыт</h3>
              <p className="text-sm mb-6" style={{ color: 'var(--app-text-muted)' }}>Купите бессрочный доступ к студии.</p>
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-2 text-2xl font-bold" style={{ color: 'var(--app-text)' }}><span>🍃</span> 80 листиков</div>
                <button onClick={handleBuyStudio} disabled={isSaving} className="w-full py-4 rounded-2xl font-bold text-white active:scale-95 transition-transform" style={{ background: 'var(--app-accent)' }}>
                  {isSaving ? 'Покупка...' : 'Купить доступ'}
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-3xl liquid-glass">
              {(profile as any)?.studio_song ? (
                <div className="text-center">
                  <h3 className="font-bold text-lg mb-4" style={{ color: 'var(--app-text)' }}>Ваш трек</h3>
                  <div className="p-4 rounded-2xl bg-black/20 mb-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-white" style={{ background: 'var(--app-accent)' }}><PlayIcon size={24} /></div>
                    <div className="text-left flex-1">
                      <p className="font-bold text-[16px]" style={{ color: 'var(--app-text)' }}>{(profile as any).studio_song.title}</p>
                      <p className="text-sm" style={{ color: 'var(--app-text-muted)' }}>{(profile as any).studio_song.artist}</p>
                    </div>
                  </div>
                  <audio controls src={(profile as any).studio_song.url} className="w-full" />
                  <p className="text-xs text-red-400 mt-4">Вы уже использовали свой шанс.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="font-bold text-lg mb-4" style={{ color: 'var(--app-text)' }}>Загрузка трека</h3>
                  <div><label className="block text-sm mb-1" style={{ color: 'var(--app-text-muted)' }}>Название</label><input type="text" value={songTitle} onChange={e => setSongTitle(e.target.value)} className="w-full p-3 rounded-xl outline-none liquid-glass" style={{ color: 'var(--app-text)' }} /></div>
                  <div><label className="block text-sm mb-1" style={{ color: 'var(--app-text-muted)' }}>Исполнитель</label><input type="text" value={songArtist} onChange={e => setSongArtist(e.target.value)} className="w-full p-3 rounded-xl outline-none liquid-glass" style={{ color: 'var(--app-text)' }} /></div>
                  
                  {/* ЗАГРУЗКА ОБЛОЖКИ И БАННЕРА ДЛЯ ПЕСНИ */}
                  <div className="flex gap-2">
                    <button onClick={() => studioCoverRef.current?.click()} className="flex-1 p-3 rounded-xl liquid-glass text-white font-bold text-xs bg-white/5 active:scale-95 transition-transform">Обложка</button>
                    <button onClick={() => studioBannerRef.current?.click()} className="flex-1 p-3 rounded-xl liquid-glass text-white font-bold text-xs bg-white/5 active:scale-95 transition-transform">Баннер</button>
                    <input type="file" ref={studioCoverRef} hidden accept="image/*" onChange={(e) => handleStudioImage(e, 'cover')} />
                    <input type="file" ref={studioBannerRef} hidden accept="image/*" onChange={(e) => handleStudioImage(e, 'banner')} />
                  </div>

                  <div className="pt-2">
                    <button onClick={() => studioAudioRef.current?.click()} disabled={isUploadingStudio} className="w-full py-4 rounded-xl font-bold text-white liquid-glass disabled:opacity-50" style={{ background: 'var(--app-accent)' }}>
                      {isUploadingStudio ? 'Загрузка...' : 'Загрузить трек'}
                    </button>
                    <input type="file" ref={studioAudioRef} hidden accept="audio/*" onChange={handleStudioUpload} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ТЕМЫ */}
      {subPage === 'appearance' && (
        <div className="p-4">
          <button onClick={() => setSubPage('main')} className="mb-4 flex items-center gap-2" style={{ color: 'var(--app-text)' }}><BackIcon size={22} /> Назад</button>
          <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--app-text)' }}>Темы</h2>
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

      {/* ЗАГЛУШКИ (Приватность, Уведомления, Валюта, Подарки) */}
      {['privacy', 'notifications', 'currency', 'gifts'].includes(subPage) && (
        <div className="p-4">
          <button onClick={() => setSubPage('main')} className="mb-4 flex items-center gap-2" style={{ color: 'var(--app-text)' }}><BackIcon size={22} /> Назад</button>
          <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--app-text)' }}>
            {subPage === 'currency' ? 'Валюта' : subPage === 'privacy' ? 'Приватность' : subPage === 'gifts' ? 'Подарки' : 'Уведомления'}
          </h2>
          
          {subPage === 'currency' && (
            <div className="p-6 rounded-3xl liquid-glass text-center">
              <div className="text-6xl mb-4">🍃</div>
              <p className="text-4xl font-bold mb-2" style={{ color: 'var(--app-text)' }}>{(profile as any)?.leaf_balance || 0}</p>
              <p className="text-sm mb-6" style={{ color: 'var(--app-text-muted)' }}>Ваш баланс</p>
              <button onClick={() => showError('Пополнение временно недоступно')} className="w-full py-3 rounded-xl font-bold text-white liquid-glass active:scale-95 transition-transform" style={{ background: 'var(--app-accent)' }}>Пополнить</button>
            </div>
          )}

          {subPage === 'gifts' && (
            <div className="p-6 rounded-3xl liquid-glass text-center">
              <div className="text-6xl mb-4 animate-bounce">🎁</div>
              <p className="text-lg font-bold mb-2" style={{ color: 'var(--app-text)' }}>Магазин подарков</p>
              <p className="text-sm mb-6" style={{ color: 'var(--app-text-muted)' }}>Скоро здесь можно будет дарить подарки!</p>
            </div>
          )}

          {['privacy', 'notifications'].includes(subPage) && <p className="text-sm" style={{ color: 'var(--app-text-muted)' }}>Раздел в разработке.</p>}
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
