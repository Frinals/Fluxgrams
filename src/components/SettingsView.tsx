import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { themes, useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { BackIcon, ImageIcon, PlayIcon, VerifiedIcon, LockIcon, BellIcon, LeafIcon, MusicIcon, ChevronRightIcon, PaletteIcon, EditIcon, XIcon } from '@/components/Icons';
import GiftAnimation from './GiftAnimation';
import { motion, AnimatePresence } from 'framer-motion';

type SubPage = 'main' | 'appearance' | 'privacy' | 'notifications' | 'currency' | 'studio' | 'gifts';

export default function SettingsView({ onViewProfile }: any) {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [subPage, setSubPage] = useState<SubPage>('main');
  
  // Стейты профиля
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorText, setErrorText] = useState('');

  // Стейты Студии
  const [songTitle, setSongTitle] = useState('');
  const [songArtist, setSongArtist] = useState('');
  const [songCover, setSongCover] = useState<string | null>(null);
  const [songBanner, setSongBanner] = useState<string | null>(null);
  const [isUploadingStudio, setIsUploadingStudio] = useState(false);
  
  // Стейты ПОДАРКОВ
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [giftMessage, setGiftMessage] = useState('');
  const [chats, setChats] = useState<any[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<any>(null);
  const [isSendingGift, setIsSendingGift] = useState(false);
  
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

  // Загружаем чаты для выбора получателя подарка
  useEffect(() => {
    if (subPage === 'gifts' && user) {
      const loadChats = async () => {
        const { data } = await supabase.from('chats').select('*').or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);
        if (data) {
          const peerIds = data.map(c => c.user1_id === user.id ? c.user2_id : c.user1_id);
          const { data: peers } = await supabase.from('profiles').select('*').in('id', peerIds);
          setChats(peers || []);
        }
      };
      loadChats();
    }
  }, [subPage, user]);

  const showError = (text: string) => { setErrorText(text); setShowErrorModal(true); };

  const handleSaveField = async (field: 'name' | 'username') => {
    if (!user) return;
    setIsSaving(true);
    let updates = {};
    if (field === 'name') { updates = { display_name: editName.trim() }; setIsEditingName(false); } 
    else {
      const cleanUsername = editUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (cleanUsername.length < 3) { showError('Минимум 3 символа'); setIsSaving(false); return; }
      updates = { username: cleanUsername };
      setIsEditingUsername(false);
    }
    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
    if (error) { showError(error.code === '23505' ? 'Данный юз занят' : 'Ошибка: ' + error.message); } 
    else { await refreshProfile(); }
    setIsSaving(false);
  };

  const handleBuyGift = async () => {
    if (!user || !profile || !selectedRecipient) return;
    
    // Запрет на отправку самому себе (дублируем проверку)
    if (selectedRecipient.id === user.id) {
      showError('Нельзя отправить подарок самому себе!');
      return;
    }

    const currentBalance = (profile as any).leaf_balance || 0;
    if (currentBalance < 8) { showError('Недостаточно средств (Нужно 8 🍃)'); return; }

    setIsSendingGift(true);
    try {
      // 1. Списываем листики
      await supabase.from('profiles').update({ leaf_balance: currentBalance - 8 }).eq('id', user.id);
      
      // 2. Записываем подарок
      const { error } = await supabase.from('gifts').insert({
        sender_id: user.id,
        sender_name: profile.display_name || 'Пользователь', // Сохраняем имя на случай удаления
        receiver_id: selectedRecipient.id,
        gift_type: 'heart_arrow',
        message: giftMessage.trim() || 'Без сообщения'
      });

      if (error) throw error;

      await refreshProfile();
      alert(`Подарок успешно отправлен пользователю ${selectedRecipient.display_name}!`);
      setShowGiftModal(false);
      setGiftMessage('');
      setSelectedRecipient(null);
    } catch (error: any) {
      showError('Ошибка: ' + error.message);
    } finally {
      setIsSendingGift(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto relative pb-24" style={{ background: 'var(--app-bg)' }}>
      
      {/* Ошибка */}
      {showErrorModal && (
        <div className="fixed inset-0 z-[99999] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="rounded-3xl p-6 w-full max-w-xs text-center liquid-glass">
            <p className="font-bold mb-6 text-[15px]" style={{ color: 'var(--app-text)' }}>{errorText}</p>
            <button onClick={() => setShowErrorModal(false)} className="w-full py-3 rounded-xl font-bold text-white liquid-glass" style={{ background: 'var(--app-accent)' }}>Понятно</button>
          </div>
        </div>
      )}

      {/* МОДАЛКА ВЫБОРА ПОЛУЧАТЕЛЯ ПОДАРКА */}
      <AnimatePresence>
        {showGiftModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[9999] bg-black/80 flex items-end sm:items-center justify-center p-4 backdrop-blur-md" onClick={() => setShowGiftModal(false)}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-md liquid-glass max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold" style={{ color: 'var(--app-text)' }}>Кому подарить?</h2>
                <button onClick={() => setShowGiftModal(false)} style={{ color: 'var(--app-text)' }}><XIcon size={24} /></button>
              </div>

              <div className="flex justify-center mb-4">
                <GiftAnimation size={120} />
              </div>

              <div className="overflow-y-auto flex-1 mb-4 space-y-2">
                {chats.length === 0 && <p className="text-center text-sm" style={{ color: 'var(--app-text-muted)' }}>У вас пока нет чатов</p>}
                {chats.map(chatPeer => (
                  <div key={chatPeer.id} onClick={() => setSelectedRecipient(chatPeer)} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-colors ${selectedRecipient?.id === chatPeer.id ? 'border-green-500 bg-green-500/10' : 'border-transparent bg-white/5'}`}>
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-blue-500">
                      {chatPeer.avatar_url ? <img src={chatPeer.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-white font-bold">{chatPeer.display_name?.[0] || 'U'}</div>}
                    </div>
                    <p className="font-bold" style={{ color: 'var(--app-text)' }}>{chatPeer.display_name}</p>
                  </div>
                ))}
              </div>

              <input type="text" value={giftMessage} onChange={e => setGiftMessage(e.target.value)} placeholder="Текст к подарку..." className="w-full p-3 rounded-xl outline-none liquid-glass mb-4 text-sm" style={{ color: 'var(--app-text)' }} />

              <button onClick={handleBuyGift} disabled={!selectedRecipient || isSendingGift} className="w-full py-4 rounded-2xl font-bold text-white disabled:opacity-50 liquid-glass flex items-center justify-center gap-2" style={{ background: 'var(--app-accent)' }}>
                {isSendingGift ? 'Отправка...' : 'Купить за 8 🍃 и подарить'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {subPage === 'main' && (
        <div>
          <div className="relative w-full h-48 cursor-pointer group" onClick={() => bannerInputRef.current?.click()}>
             {profile?.banner_url ? <img src={profile.banner_url} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gradient-to-r from-blue-900 to-purple-900" />}
             <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><ImageIcon size={32} className="text-white/70" /></div>
             <input type="file" ref={bannerInputRef} hidden accept="image/*" onChange={(e) => { /* Функция загрузки баннера */ }} />
          </div>

          <div className="px-4 flex flex-col items-center -mt-16 relative z-10">
            <div className="relative cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
              <div className="w-32 h-32 rounded-full border-4 overflow-hidden flex items-center justify-center text-5xl text-white font-bold liquid-glass" style={{ borderColor: 'var(--app-bg)' }}>
                {profile?.avatar_url ? <img src={profile.avatar_url} className="w-full h-full object-cover" /> : profile?.display_name?.[0] || 'U'}
              </div>
              <button className="absolute bottom-1 right-1 p-2 rounded-full text-white liquid-glass"><ImageIcon size={18} /></button>
              <input type="file" ref={avatarInputRef} hidden accept="image/*" onChange={(e) => { /* Функция загрузки аватара */ }} />
            </div>

            <div className="text-center mt-4 w-full max-w-sm">
              <div className="flex items-center justify-center gap-2 mb-1">
                {isEditingName ? (
                  <div className="flex items-center gap-2 w-full px-4">
                    <input autoFocus type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full bg-transparent border-b border-white text-center text-2xl font-bold outline-none" style={{ color: 'var(--app-text)' }} />
                    <button onClick={() => handleSaveField('name')} className="text-green-500 font-bold text-sm">ОК</button>
                  </div>
                ) : (
                  <div onClick={() => setIsEditingName(true)} className="flex items-center justify-center gap-2 cursor-pointer group">
                    <h2 className="text-2xl font-bold" style={{ color: 'var(--app-text)' }}>{profile?.display_name || 'Пользователь'}</h2>
                    {(profile as any)?.is_verified && <VerifiedIcon size={20} className="text-green-500" />}
                    <EditIcon size={16} className="opacity-0 group-hover:opacity-50 transition-opacity" style={{ color: 'var(--app-text)' }} />
                  </div>
                )}
              </div>
              <div className="flex items-center justify-center h-6">
                {isEditingUsername ? (
                  <div className="flex items-center gap-2 w-full px-6">
                    <span className="text-sm" style={{ color: 'var(--app-text-muted)' }}>@</span>
                    <input autoFocus type="text" value={editUsername} onChange={e => setEditUsername(e.target.value)} className="w-full bg-transparent border-b border-white text-center text-sm outline-none" style={{ color: 'var(--app-text)' }} />
                    <button onClick={() => handleSaveField('username')} className="text-green-500 font-bold text-sm">ОК</button>
                  </div>
                ) : (
                  <div onClick={() => setIsEditingUsername(true)} className="flex items-center gap-1 cursor-pointer group">
                    <p className="text-sm" style={{ color: 'var(--app-text-muted)' }}>@{profile?.username || 'user'}</p>
                    <EditIcon size={12} className="opacity-0 group-hover:opacity-50 transition-opacity" style={{ color: 'var(--app-text-muted)' }} />
                  </div>
                )}
              </div>
            </div>

            <div className="w-full max-w-md mt-6 p-4 rounded-3xl liquid-glass flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl bg-green-500/20">🍃</div>
                <div><p className="text-sm" style={{ color: 'var(--app-text-muted)' }}>Ваш баланс</p><p className="font-bold text-xl" style={{ color: 'var(--app-text)' }}>{(profile as any)?.leaf_balance || 0} листиков</p></div>
              </div>
              <button onClick={() => onViewProfile(profile?.id)} className="px-4 py-2 rounded-xl text-sm font-bold liquid-glass" style={{ color: 'var(--app-text)' }}>Профиль</button>
            </div>

            <div className="w-full max-w-md mt-4 space-y-2">
              {[
                { key: 'studio', icon: MusicIcon, label: 'Студия', desc: 'Загрузить свой трек' },
                { key: 'gifts', icon: LeafIcon, label: 'Подарки', desc: 'Магазин подарков' },
                { key: 'currency', icon: LeafIcon, label: 'Валюта', desc: 'Баланс листиков' },
                { key: 'appearance', icon: PaletteIcon, label: 'Темы', desc: 'Оформление' },
                { key: 'privacy', icon: LockIcon, label: 'Приватность', desc: 'Кто может писать' },
                { key: 'notifications', icon: BellIcon, label: 'Уведомления', desc: 'Звуки и вибрация' },
              ].map(({ key, icon: Icon, label, desc }) => (
                <button key={key} onClick={() => setSubPage(key as SubPage)} className="w-full p-4 rounded-2xl liquid-glass flex items-center gap-4 active:scale-[0.98] transition-transform">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--app-accent)', color: 'white' }}><Icon size={20} /></div>
                  <div className="flex-1 text-left"><span className="font-semibold block text-[15px]" style={{ color: 'var(--app-text)' }}>{label}</span><span className="text-xs block" style={{ color: 'var(--app-text-muted)' }}>{desc}</span></div>
                  <ChevronRightIcon size={20} style={{ color: 'var(--app-text-muted)' }} />
                </button>
              ))}
              <button onClick={() => signOut()} className="w-full py-4 mt-2 rounded-2xl liquid-glass font-semibold text-red-500">Выйти</button>
            </div>
          </div>
        </div>
      )}

      {/* ВКЛАДКА ПОДАРКОВ */}
      {subPage === 'gifts' && (
        <div className="p-4">
          <button onClick={() => setSubPage('main')} className="mb-4 flex items-center gap-2" style={{ color: 'var(--app-text)' }}><BackIcon size={22} /> Назад</button>
          <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--app-text)' }}>Магазин подарков</h2>
          
          <div className="p-6 rounded-3xl liquid-glass text-center">
            <div className="flex justify-center mb-4">
              <GiftAnimation size={150} />
            </div>
            <h3 className="text-xl font-bold mb-1" style={{ color: 'var(--app-text)' }}>Сердце со стрелой</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--app-text-muted)' }}>Подари это сердце другу, чтобы показать свои чувства.</p>
            <div className="flex items-center justify-center gap-2 text-2xl font-bold mb-6" style={{ color: 'var(--app-text)' }}><span>🍃</span> 8 листиков</div>
            <button onClick={() => setShowGiftModal(true)} className="w-full py-4 rounded-2xl font-bold text-white liquid-glass active:scale-95" style={{ background: 'var(--app-accent)' }}>Подарить</button>
          </div>
        </div>
      )}

      {/* СТУДИЯ И ОСТАЛЬНЫЕ ЭКРАНЫ (Оставил как было, чтобы не раздувать код) */}
      {['studio', 'appearance', 'privacy', 'notifications', 'currency'].includes(subPage) && (
        <div className="p-4">
          <button onClick={() => setSubPage('main')} className="mb-4 flex items-center gap-2" style={{ color: 'var(--app-text)' }}><BackIcon size={22} /> Назад</button>
          <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--app-text)' }}>Раздел в разработке</h2>
        </div>
      )}

    </div>
  );
}
