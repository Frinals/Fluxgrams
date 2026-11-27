import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { themes, useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { BackIcon, ImageIcon, PlayIcon, VerifiedIcon, LockIcon, BellIcon, LeafIcon, MusicIcon } from '@/components/Icons';
import MusicPlayer from './MusicPlayer';
import { AnimatePresence } from 'framer-motion';

type SubPage = 'main' | 'edit_profile' | 'appearance' | 'privacy' | 'notifications' | 'currency' | 'studio';

export default function SettingsView({ onViewProfile }: any) {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [subPage, setSubPage] = useState<SubPage>('main');
  
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
  const [isUploadingStudio, setIsUploadingStudio] = useState(false);
  
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);
  const studioAudioRef = useRef<HTMLInputElement>(null);

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

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsSaving(true);
    const cleanUsername = editUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (cleanUsername.length < 3) { showError('Минимум 3 символа'); setIsSaving(false); return; }
    
    const { error } = await supabase.from('profiles').update({ display_name: editName.trim(), username: cleanUsername }).eq('id', user.id);
    if (error) { showError(error.code === '23505' ? 'Данный юз занят' : 'Ошибка: ' + error.message); } 
    else { await refreshProfile(); setSubPage('main'); }
    setIsSaving(false);
  };

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

  // ЛОГИКА ПОКУПКИ СТУДИИ
  const handleBuyStudio = async () => {
    if (!user || !profile) return;
    
    const currentLeaves = profile.leaves || 0;
    if (currentLeaves < 80) {
      showError('Недостаточно средств (Нужно 80 🍃)');
      return;
    }

    setIsSaving(true);
    const { error } = await supabase.from('profiles').update({
      leaves: currentLeaves - 80,
      has_studio_access: true // Сохраняем навсегда!
    }).eq('id', user.id);

    if (error) {
      showError('Ошибка при покупке: ' + error.message);
    } else {
      await refreshProfile();
    }
    setIsSaving(false);
  };

  // ЗАГРУЗКА ЕДИНСТВЕННОЙ ПЕСНИ В СТУДИИ
  const handleStudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!songTitle.trim() || !songArtist.trim()) {
      showError('Введите название песни и исполнителя!');
      return;
    }

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
        url: data.publicUrl 
      };
      
      const { error: updateError } = await supabase.from('profiles').update({ 
        studio_song: newStudioSong 
      }).eq('id', user.id);

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
    { key: 'studio', icon: MusicIcon, label: 'Студия', desc: 'Загрузить свой трек (1 раз)' }, // <-- НОВЫЙ ПУНКТ
    { key: 'currency', icon: LeafIcon, label: 'Валюта', desc: 'Баланс листиков' },
    { key: 'privacy', icon: LockIcon, label: 'Приватность', desc: 'Кто может писать' },
    { key: 'notifications', icon: BellIcon, label: 'Уведомления', desc: 'Звуки и вибрация' },
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto relative" style={{ background: 'var(--app-bg)' }}>
      
      {/* Модалка ошибок */}
      {showErrorModal && (
        <div className="fixed inset-0 z-[99999] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="rounded-3xl p-6 w-full max-w-xs text-center liquid-glass">
            <p className="font-bold mb-6 text-[15px]" style={{ color: 'var(--app-text)' }}>{errorText}</p>
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

            {/* БАЛАНС ЛИСТИКОВ */}
            <div className="w-full max-w-md mt-6 p-4 rounded-3xl liquid-glass flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl bg-green-500/20">🍃</div>
                <div>
                  <p className="text-sm" style={{ color: 'var(--app-text-muted)' }}>Ваш баланс</p>
                  <p className="font-bold text-xl" style={{ color: 'var(--app-text)' }}>{profile?.leaves || 0} листиков</p>
                </div>
              </div>
            </div>

            <div className="w-full max-w-md mt-4 space-y-2">
              {settingsList.map(({ key, icon: Icon, label, desc }) => (
                <button key={key} onClick={() => setSubPage(key as SubPage)} className="w-full p-4 rounded-2xl liquid-glass flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--app-accent)', color: 'white' }}><Icon size={20} /></div>
                  <div className="flex-1 text-left">
                    <span className="font-semibold block text-[15px]" style={{ color: 'var(--app-text)' }}>{label}</span>
                    <span className="text-xs block" style={{ color: 'var(--app-text-muted)' }}>{desc}</span>
                  </div>
                </button>
              ))}
              <button onClick={() => signOut()} className="w-full py-4 mt-2 rounded-2xl liquid-glass font-semibold text-red-500">Выйти</button>
            </div>
          </div>
        </div>
      )}

      {/* ЭКРАН СТУДИИ */}
      {subPage === 'studio' && (
        <div className="p-4 pb-24">
          <button onClick={() => setSubPage('main')} className="mb-4 flex items-center gap-2" style={{ color: 'var(--app-text)' }}><BackIcon size={22} /> Назад</button>
          
          <div className="text-center mb-6">
            <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center text-4xl bg-purple-500/20 text-purple-500 mb-3">
              🎙️
            </div>
            <h2 className="text-2xl font-bold" style={{ color: 'var(--app-text)' }}>Flux Studio</h2>
            <p className="text-sm mt-1" style={{ color: 'var(--app-text-muted)' }}>Загрузи свой трек один раз и навсегда</p>
          </div>

          {/* ЕСЛИ ДОСТУПА НЕТ */}
          {!profile?.has_studio_access ? (
            <div className="p-6 rounded-3xl liquid-glass text-center">
              <h3 className="font-bold text-lg mb-2" style={{ color: 'var(--app-text)' }}>Доступ закрыт</h3>
              <p className="text-sm mb-6" style={{ color: 'var(--app-text-muted)' }}>Купите бессрочный доступ к студии, чтобы выложить свою музыку.</p>
              
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-2 text-2xl font-bold" style={{ color: 'var(--app-text)' }}>
                  <span>🍃</span> 80 листиков
                </div>
                <button onClick={handleBuyStudio} disabled={isSaving} className="w-full py-4 rounded-2xl font-bold text-white active:scale-95 transition-transform" style={{ background: 'var(--app-accent)' }}>
                  {isSaving ? 'Покупка...' : 'Купить доступ'}
                </button>
              </div>
            </div>
          ) : (
            /* ЕСЛИ ДОСТУП ЕСТЬ */
            <div className="p-6 rounded-3xl liquid-glass">
              
              {/* Если песня УЖЕ загружена (показываем её, форму скрываем) */}
              {profile?.studio_song ? (
                <div className="text-center">
                  <h3 className="font-bold text-lg mb-4" style={{ color: 'var(--app-text)' }}>Ваш трек в Студии</h3>
                  <div className="p-4 rounded-2xl bg-black/20 mb-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-white" style={{ background: 'var(--app-accent)' }}><PlayIcon size={24} /></div>
                    <div className="text-left flex-1">
                      <p className="font-bold text-[16px]" style={{ color: 'var(--app-text)' }}>{profile.studio_song.title}</p>
                      <p className="text-sm" style={{ color: 'var(--app-text-muted)' }}>{profile.studio_song.artist}</p>
                    </div>
                  </div>
                  <audio controls src={profile.studio_song.url} className="w-full" />
                  <p className="text-xs text-red-400 mt-4">Вы уже использовали свой шанс. Изменить трек нельзя.</p>
                </div>
              ) : (
                /* Если песни еще нет (показываем форму) */
                <div className="space-y-4">
                  <h3 className="font-bold text-lg mb-4" style={{ color: 'var(--app-text)' }}>Загрузка трека</h3>
                  
                  <div>
                    <label className="block text-sm mb-1" style={{ color: 'var(--app-text-muted)' }}>Название песни</label>
                    <input type="text" value={songTitle} onChange={e => setSongTitle(e.target.value)} className="w-full p-3 rounded-xl outline-none liquid-glass" style={{ color: 'var(--app-text)' }} placeholder="Например: Тёмный принц" />
                  </div>
                  
                  <div>
                    <label className="block text-sm mb-1" style={{ color: 'var(--app-text-muted)' }}>Исполнитель</label>
                    <input type="text" value={songArtist} onChange={e => setSongArtist(e.target.value)} className="w-full p-3 rounded-xl outline-none liquid-glass" style={{ color: 'var(--app-text)' }} placeholder="Ваш никнейм" />
                  </div>

                  <div className="pt-2">
                    <button onClick={() => studioAudioRef.current?.click()} disabled={isUploadingStudio} className="w-full py-4 rounded-xl font-bold text-white liquid-glass disabled:opacity-50" style={{ background: 'var(--app-accent)' }}>
                      {isUploadingStudio ? 'Загрузка...' : 'Выбрать файл и загрузить'}
                    </button>
                    <input type="file" ref={studioAudioRef} hidden accept="audio/*" onChange={handleStudioUpload} />
                  </div>
                  
                  <p className="text-xs text-center text-red-400 mt-2">Внимание! Вы можете загрузить только 1 трек за всё время.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ОСТАЛЬНЫЕ ЭКРАНЫ (Профиль, Темы, Приватность) */}
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
          <h2 className="text-xl font-bold capitalize mb-4" style={{ color: 'var(--app-text)' }}>
            {subPage === 'currency' ? 'Валюта' : subPage === 'privacy' ? 'Приватность' : 'Уведомления'}
          </h2>
          
          {subPage === 'currency' && (
            <div className="p-6 rounded-3xl liquid-glass text-center">
              <div className="text-6xl mb-4">🍃</div>
              <p className="text-4xl font-bold mb-2" style={{ color: 'var(--app-text)' }}>{profile?.leaves || 0}</p>
              <p className="text-sm mb-6" style={{ color: 'var(--app-text-muted)' }}>Ваш баланс листиков</p>
              <button onClick={() => showError('Пополнение временно недоступно')} className="w-full py-3 rounded-xl font-bold text-white liquid-glass" style={{ background: 'var(--app-accent)' }}>Пополнить</button>
            </div>
          )}

          {subPage !== 'currency' && <p className="text-sm" style={{ color: 'var(--app-text-muted)' }}>Раздел в разработке.</p>}
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
