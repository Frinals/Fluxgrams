import { useState, useEffect, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, Profile } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { themes, themeList } from '@/lib/types';
import { UserIcon, LockIcon, GlobeIcon, PaletteIcon, LogOutIcon, ChevronRightIcon, BackIcon, VerifiedIcon } from '@/components/Icons';

type SubPage = 'main' | 'profile' | 'privacy' | 'appearance' | 'notifications' | 'accounts';

const Toggle = ({ value, onChange }: { value: boolean, onChange: () => void }) => (
  <button onClick={onChange} className="relative w-12 h-6 rounded-full transition-all" style={{ background: value ? 'var(--app-accent)' : 'var(--app-border)' }}>
    <motion.div className="absolute top-0.5 w-5 h-5 rounded-full bg-white" animate={{ left: value ? '26px' : '2px' }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
  </button>
);

export default function SettingsView() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { lang, setLang } = useLanguage();
  const { theme, setTheme } = useTheme();

  const [subPage, setSubPage] = useState<SubPage>('main');
  
  // Стейты для настроек
  const [allowMessages, setAllowMessages] = useState(true);
  const [allowCalls, setAllowCalls] = useState(true);
  const [ghostMode, setGhostMode] = useState(false);
  const [notifSound, setNotifSound] = useState(true);

  useEffect(() => {
    if (profile) {
      setAllowMessages(profile.allow_messages ?? true);
      setAllowCalls(profile.allow_calls ?? true);
      setGhostMode(profile.ghost_mode ?? false);
      setNotifSound(profile.notif_sound ?? true);
    }
  }, [profile]);

  const updateSettings = async (updates: any) => {
    if (!user) return;
    await supabase.from('profiles').update(updates).eq('id', user.id);
    await refreshProfile();
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: 'var(--app-bg)' }}>
      <AnimatePresence mode="wait">
        
        {subPage === 'main' && (
          <motion.div key="main" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="p-4 space-y-3 pb-24">
            <h2 className="text-[26px] font-bold mb-4" style={{ color: 'var(--app-text)' }}>{lang === 'ru' ? 'Настройки' : 'Settings'}</h2>
            
            <div className="glass-panel rounded-3xl p-5 flex items-center gap-4 mb-4 cursor-pointer" onClick={() => setSubPage('profile')}>
              {profile?.avatar_url ? <img src={profile.avatar_url} className="w-16 h-16 rounded-full object-cover" /> : <div className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-xl text-white bg-blue-500">{(profile?.display_name || 'U').slice(0,2).toUpperCase()}</div>}
              <div className="flex-1">
                <div className="flex items-center gap-1">
                  <p className="font-bold text-lg" style={{ color: 'var(--app-text)' }}>{profile?.display_name || 'User'}</p>
                  {(profile as any)?.is_verified && <VerifiedIcon size={18} />}
                </div>
                <p className="text-sm" style={{ color: 'var(--app-text-muted)' }}>@{profile?.username}</p>
              </div>
              <ChevronRightIcon size={18} style={{ color: 'var(--app-text-muted)' }} />
            </div>

            <button onClick={() => setSubPage('privacy')} className="glass-panel rounded-2xl w-full p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-orange-500 text-white"><LockIcon size={20} /></div>
              <div className="flex-1 text-left"><span className="font-medium block" style={{ color: 'var(--app-text)' }}>Конфиденциальность</span></div>
            </button>
            <button onClick={() => setSubPage('notifications')} className="glass-panel rounded-2xl w-full p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-500 text-white"><GlobeIcon size={20} /></div>
              <div className="flex-1 text-left"><span className="font-medium block" style={{ color: 'var(--app-text)' }}>Уведомления</span></div>
            </button>
            <button onClick={() => setSubPage('appearance')} className="glass-panel rounded-2xl w-full p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-green-500 text-white"><PaletteIcon size={20} /></div>
              <div className="flex-1 text-left"><span className="font-medium block" style={{ color: 'var(--app-text)' }}>Оформление</span></div>
            </button>
            
            <button onClick={() => signOut()} className="w-full py-3 rounded-2xl mt-4 bg-red-500/10 text-red-500 font-semibold flex items-center justify-center gap-2"><LogOutIcon size={20} /> Выйти</button>
          </motion.div>
        )}

        {subPage === 'profile' && (
          <motion.div key="profile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 pb-24">
             <button onClick={() => setSubPage('main')} className="mb-4 flex items-center gap-2" style={{ color: 'var(--app-text)' }}><BackIcon size={22} /> Назад</button>
             <h2 className="text-xl font-bold mb-4 text-center" style={{ color: 'var(--app-text)' }}>Профиль</h2>
             <div className="flex flex-col items-center">
                {profile?.avatar_url ? <img src={profile.avatar_url} className="w-24 h-24 rounded-full object-cover" /> : <div className="w-24 h-24 rounded-full bg-blue-500" />}
                <div className="flex items-center gap-1 mt-3">
                  <p className="font-bold text-xl" style={{ color: 'var(--app-text)' }}>{profile?.display_name}</p>
                  {(profile as any)?.is_verified && <VerifiedIcon size={20} />}
                </div>
                <p style={{ color: 'var(--app-text-muted)' }}>@{profile?.username}</p>
             </div>
          </motion.div>
        )}

        {subPage === 'privacy' && (
          <motion.div key="privacy" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} className="p-4 pb-24">
             <button onClick={() => setSubPage('main')} className="mb-4 flex items-center gap-2" style={{ color: 'var(--app-text)' }}><BackIcon size={22} /> Назад</button>
             <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--app-text)' }}>Конфиденциальность</h2>
             <div className="glass-panel p-5 rounded-2xl space-y-6">
                
                <div className="flex justify-between items-center">
                  <span style={{ color: 'var(--app-text)' }}>Кто может писать</span>
                  <Toggle value={allowMessages} onChange={() => { setAllowMessages(!allowMessages); updateSettings({ allow_messages: !allowMessages }); }} />
                </div>
                <div className="flex justify-between items-center">
                  <span style={{ color: 'var(--app-text)' }}>Кто может звонить</span>
                  <Toggle value={allowCalls} onChange={() => { setAllowCalls(!allowCalls); updateSettings({ allow_calls: !allowCalls }); }} />
                </div>
                <div className="flex justify-between items-center">
                  <span style={{ color: 'var(--app-text)' }}>Режим призрака</span>
                  <Toggle value={ghostMode} onChange={() => { setGhostMode(!ghostMode); updateSettings({ ghost_mode: !ghostMode }); }} />
                </div>

             </div>
          </motion.div>
        )}

        {subPage === 'notifications' && (
          <motion.div key="notifications" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} className="p-4 pb-24">
             <button onClick={() => setSubPage('main')} className="mb-4 flex items-center gap-2" style={{ color: 'var(--app-text)' }}><BackIcon size={22} /> Назад</button>
             <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--app-text)' }}>Уведомления</h2>
             <div className="glass-panel p-5 rounded-2xl space-y-6">
                
                <div className="flex justify-between items-center">
                  <span style={{ color: 'var(--app-text)' }}>Звук</span>
                  <Toggle value={notifSound} onChange={() => { setNotifSound(!notifSound); updateSettings({ notif_sound: !notifSound }); }} />
                </div>

             </div>
          </motion.div>
        )}

        {subPage === 'appearance' && (
          <motion.div key="appearance" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} className="p-4 pb-24">
            <button onClick={() => setSubPage('main')} className="mb-4 flex items-center gap-2" style={{ color: 'var(--app-text)' }}><BackIcon size={22} /> Назад</button>
            <h3 className="font-semibold mb-4" style={{ color: 'var(--app-text)' }}>Выберите тему</h3>
            <div className="grid grid-cols-3 gap-3 mb-6">
               {themeList.map((key) => (
                  <button key={key} onClick={() => setTheme(key)} className="p-3 rounded-xl border flex flex-col items-center gap-2" style={{ background: theme === key ? 'var(--app-surface)' : 'transparent', borderColor: theme === key ? 'var(--app-accent)' : 'var(--app-border)' }}>
                    <div className="w-10 h-10 rounded-full" style={{ background: themes[key].accentGradient }} />
                    <span className="text-xs" style={{ color: 'var(--app-text)' }}>{key}</span>
                  </button>
               ))}
            </div>
            <h3 className="flex items-center gap-2 font-semibold mb-4" style={{ color: 'var(--app-text)' }}><GlobeIcon size={20} /> Язык</h3>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setLang('ru')} className={`py-2.5 rounded-xl font-medium border ${lang === 'ru' ? 'bg-blue-500 text-white border-transparent' : 'text-gray-400 border-[var(--app-border)]'}`}>Русский</button>
              <button onClick={() => setLang('en')} className={`py-2.5 rounded-xl font-medium border ${lang === 'en' ? 'bg-blue-500 text-white border-transparent' : 'text-gray-400 border-[var(--app-border)]'}`}>English</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
