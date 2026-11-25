import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { themes, themeList } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { UserIcon, LockIcon, PaletteIcon, ChevronRightIcon, BellIcon, BackIcon, UsersIcon, VerifiedIcon, LeafIcon, ImageIcon } from '@/components/Icons';

type SubPage = 'main' | 'edit_profile' | 'privacy' | 'appearance' | 'notifications' | 'currency';

export default function SettingsView({ onViewProfile }: any) {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [subPage, setSubPage] = useState<SubPage>('main');
  
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorText, setErrorText] = useState('');
  
  const avatarInputRef = useRef<HTMLInputElement>(null);
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

    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', cleanUsername)
      .neq('id', user.id)
      .maybeSingle();

    if (existingUser) {
      setErrorText('Данный юз занят');
      setShowErrorModal(true);
      setIsSaving(false);
      return;
    }

    const { error } = await supabase.from('profiles').update({ 
      display_name: editName.trim(), 
      username: cleanUsername 
    }).eq('id', user.id);

    if (error) {
      setErrorText('Ошибка сохранения: ' + error.message);
      setShowErrorModal(true);
      setIsSaving(false);
      return;
    }
    
    await refreshProfile();
    setIsSaving(false);
    setSubPage('main');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'music') => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    setIsSaving(true); 
    const fileName = `profile/${user.id}/${type}_${Date.now()}.${file.name.split('.').pop()}`;
    
    const { error: uploadError } = await supabase.storage.from('media').upload(fileName, file);
    if (uploadError) { 
      alert('Ошибка загрузки файла: ' + uploadError.message); 
      setIsSaving(false); 
      return; 
    }

    const { data } = supabase.storage.from('media').getPublicUrl(fileName);

    if (type === 'music') {
      const newSong = { title: file.name.split('.')[0], url: data.publicUrl };
      const currentMusic = profile?.profile_music || [];
      const { error: updateError } = await supabase.from('profiles').update({ profile_music: [...currentMusic, newSong] }).eq('id', user.id);
      
      if (updateError) alert('Ошибка сохранения музыки: ' + updateError.message);
      else alert('Трек успешно добавлен!');
    } else {
      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', user.id);
      
      if (updateError) alert('Ошибка сохранения аватара: ' + updateError.message);
      else alert('Аватар успешно обновлен!');
    }
    
    await refreshProfile();
    setIsSaving(false);
  };

  const cards = [
    { key: 'notifications', icon: BellIcon, label: 'Уведомления', desc: 'Звуки' },
    { key: 'privacy', icon: LockIcon, label: 'Приватность', desc: 'Кто пишет' },
    { key: 'appearance', icon: PaletteIcon, label: 'Оформление', desc: 'Темы' },
    { key: 'currency', icon: LeafIcon, label: 'Валюта', desc: 'Листики' },
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: 'var(--app-bg)' }}>
      
      {showErrorModal && (
        <div className="fixed inset-0 z-[99999] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="rounded-3xl p-6 w-full max-w-xs text-center border shadow-2xl" style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
            <div className="text-4xl mb-3">⚠️</div>
            <p className="font-bold text-[15px] mb-6" style={{ color: 'var(--app-text)' }}>{errorText}</p>
            <button onClick={() => setShowErrorModal(false)} className="w-full py-3 rounded-xl font-bold text-white" style={{ background: 'var(--app-accent)' }}>
              Понятно
            </button>
          </div>
        </div>
      )}

      {subPage === 'main' && (
        <div className="p-4 space-y-3 pb-24">
          <h2 className="text-[26px] font-bold mb-4" style={{ color: 'var(--app-text)' }}>Настройки</h2>
          
          <div onClick={() => onViewProfile(profile?.id)} className="rounded-3xl p-5 flex items-center gap-4 mb-4 cursor-pointer border" style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
            {profile?.avatar_url ? <img src={profile.avatar_url} className="w-16 h-16 rounded-full object-cover" /> : <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold" style={{ background: 'var(--app-accent)' }}>{profile?.display_name?.[0] || 'U'}</div>}
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <p className="font-bold text-lg" style={{ color: 'var(--app-text)' }}>{profile?.display_name || 'User'}</p>
                {profile?.is_verified && <VerifiedIcon size={18} className="text-blue-500" />}
              </div>
              <p className="text-sm" style={{ color: 'var(--app-text-muted)' }}>@{profile?.username || 'user'}</p>
            </div>
            <ChevronRightIcon size={18} color="var(--app-text-muted)" />
          </div>

          <button onClick={() => setSubPage('edit_profile')} className="border rounded-2xl w-full p-4 flex items-center gap-3 mb-2" style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ background: 'var(--app-accent)' }}><UsersIcon size={20} /></div>
            <div className="flex-1 text-left">
              <span className="font-medium block" style={{ color: 'var(--app-text)' }}>Аккаунты</span>
              <span className="text-xs block" style={{ color: 'var(--app-text-muted)' }}>Ник, юзернейм, музыка</span>
            </div>
          </button>

          {cards.map(({ key, icon: Icon, label, desc }) => (
            <button key={key} onClick={() => setSubPage(key as SubPage)} className="border rounded-2xl w-full p-4 flex items-center gap-3" style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ background: 'var(--app-accent)' }}><Icon size={20} /></div>
              <div className="flex-1 text-left"><span className="font-medium block" style={{ color: 'var(--app-text)' }}>{label}</span><span className="text-xs block" style={{ color: 'var(--app-text-muted)' }}>{desc}</span></div>
            </button>
          ))}
          <button onClick={() => signOut()} className="w-full py-3 rounded-2xl mt-4 font-semibold" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>Выйти</button>
        </div>
      )}

      {subPage === 'edit_profile' && (
        <div className="p-4 pb-24">
          <button onClick={() => setSubPage('main')} className="mb-4 flex items-center gap-2" style={{ color: 'var(--app-text)' }}><BackIcon size={22} /> Назад</button>
          <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--app-text)' }}>Настройка аккаунта</h2>
          
          <div className="flex flex-col items-center mb-6">
            <div className="relative">
              <div className="w-24 h-24 rounded-full overflow-hidden border-4" style={{ borderColor: 'var(--app-surface)' }}>
                {profile?.avatar_url ? <img src={profile.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-white" style={{ background: 'var(--app-accent)' }}>U</div>}
              </div>
              <button onClick={() => avatarInputRef.current?.click()} disabled={isSaving} className="absolute bottom-0 right-0 p-2 rounded-full text-white border-2 disabled:opacity-50" style={{ background: 'var(--app-accent)', borderColor: 'var(--app-bg)' }}><ImageIcon size={16} /></button>
              <input type="file" ref={avatarInputRef} hidden accept="image/*" onChange={(e) => handleFileUpload(e, 'avatar')} />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm mb-1" style={{ color: 'var(--app-text-muted)' }}>Имя (как тебя видят)</label>
              <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full p-3 rounded-xl border outline-none" style={{ background: 'var(--app-surface)', color: 'var(--app-text)', borderColor: 'var(--app-border)' }} />
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: 'var(--app-text-muted)' }}>Юзернейм (@)</label>
              <input type="text" value={editUsername} onChange={e => setEditUsername(e.target.value)} className="w-full p-3 rounded-xl border outline-none" style={{ background: 'var(--app-surface)', color: 'var(--app-text)', borderColor: 'var(--app-border)' }} placeholder="например: flux" />
            </div>
            
            <div className="pt-4 border-t" style={{ borderColor: 'var(--app-border)' }}>
              <label className="block text-sm mb-2" style={{ color: 'var(--app-text-muted)' }}>Музыка в профиль</label>
              <button onClick={() => musicInputRef.current?.click()} disabled={isSaving} className="w-full p-3 rounded-xl border text-center font-medium disabled:opacity-50" style={{ background: 'var(--app-surface)', color: 'var(--app-text)', borderColor: 'var(--app-border)' }}>
                {isSaving ? 'Загрузка...' : '+ Загрузить трек (mp3)'}
              </button>
              <input type="file" ref={musicInputRef} hidden accept="audio/*" onChange={(e) => handleFileUpload(e, 'music')} />
            </div>

            <button onClick={handleSaveProfile} disabled={isSaving} className="w-full py-4 rounded-2xl font-bold text-white mt-6 disabled:opacity-50" style={{ background: 'var(--app-accent)' }}>
              {isSaving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </div>
      )}

      {['privacy', 'notifications', 'currency', 'appearance'].includes(subPage) && (
        <div className="p-4 pb-24">
          <button onClick={() => setSubPage('main')} className="mb-4 flex items-center gap-2" style={{ color: 'var(--app-text)' }}><BackIcon size={22} /> Назад</button>
          <h2 className="text-xl font-bold capitalize mb-4" style={{ color: 'var(--app-text)' }}>{subPage}</h2>
          <p className="text-sm" style={{ color: 'var(--app-text-muted)' }}>Раздел в разработке.</p>
        </div>
      )}
    </div>
  );
}
