import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { themes, themeList } from '@/lib/types';
import { UserIcon, LockIcon, PaletteIcon, ChevronRightIcon, BellIcon, BackIcon, UsersIcon, VerifiedIcon, LeafIcon } from '@/components/Icons';

type SubPage = 'main' | 'privacy' | 'appearance' | 'notifications' | 'accounts' | 'currency';

export default function SettingsView({ onViewProfile }: any) {
  const { profile, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [subPage, setSubPage] = useState<SubPage>('main');

  const cards = [
    { key: 'accounts', icon: UsersIcon, label: 'Аккаунты', desc: 'Управление' },
    { key: 'notifications', icon: BellIcon, label: 'Уведомления', desc: 'Звуки' },
    { key: 'privacy', icon: LockIcon, label: 'Приватность', desc: 'Кто пишет' },
    { key: 'appearance', icon: PaletteIcon, label: 'Оформление', desc: 'Темы' },
    { key: 'currency', icon: LeafIcon, label: 'Валюта', desc: 'Листики' },
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-[#0f1115]">
      {subPage === 'main' && (
        <div className="p-4 space-y-3 pb-24">
          <h2 className="text-[26px] font-bold mb-4 text-white">Настройки</h2>
          
          {/* Клик по этой карточке открывает модалку профиля */}
          <div className="bg-white/5 rounded-3xl p-5 flex items-center gap-4 mb-4 cursor-pointer border border-white/10" onClick={() => onViewProfile && onViewProfile(profile?.id)}>
            {profile?.avatar_url ? <img src={profile.avatar_url} className="w-16 h-16 rounded-full object-cover" /> : <div className="w-16 h-16 rounded-full bg-blue-500" />}
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <p className="font-bold text-lg text-white">{profile?.display_name || 'User'}</p>
                {profile?.is_verified && <VerifiedIcon size={18} className="text-blue-500" />}
              </div>
              <p className="text-sm text-gray-400">@{profile?.username || 'user'}</p>
            </div>
            <ChevronRightIcon size={18} color="#666" />
          </div>

          {cards.map(({ key, icon: Icon, label, desc }) => (
            <button key={key} onClick={() => setSubPage(key as SubPage)} className="bg-white/5 border border-white/10 rounded-2xl w-full p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-500"><Icon size={20} color="white" /></div>
              <div className="flex-1 text-left"><span className="font-medium block text-white">{label}</span><span className="text-xs block text-gray-400">{desc}</span></div>
            </button>
          ))}
          <button onClick={() => signOut()} className="w-full py-3 rounded-2xl mt-4 bg-red-500/10 text-red-500 font-semibold">Выйти</button>
        </div>
      )}

      {subPage === 'currency' && (
        <div className="p-4 pb-24">
          <button onClick={() => setSubPage('main')} className="mb-4 text-white flex items-center gap-2"><BackIcon size={22} /> Назад</button>
          <h2 className="text-xl font-bold text-white mb-4">Валюта</h2>
          <div className="bg-white/5 p-6 rounded-3xl border border-white/10 text-center">
            <LeafIcon size={48} color="#2ecc71" className="mx-auto mb-2" />
            <p className="text-4xl font-bold text-white mb-6">{(profile as any)?.leaves || 0} 🍃</p>
          </div>
        </div>
      )}

      {subPage === 'appearance' && (
        <div className="p-4 pb-24">
          <button onClick={() => setSubPage('main')} className="mb-4 text-white flex items-center gap-2"><BackIcon size={22} /> Назад</button>
          <div className="grid grid-cols-3 gap-3 mb-6">
             {themeList.map((key) => (
                <button key={key} onClick={() => setTheme(key)} className="p-3 rounded-xl border flex flex-col items-center gap-2" style={{ background: theme === key ? 'var(--app-surface)' : 'transparent', borderColor: theme === key ? 'var(--app-accent)' : 'var(--app-border)' }}>
                  <div className="w-10 h-10 rounded-full" style={{ background: themes[key].accentGradient }} />
                  <span className="text-xs text-white">{key}</span>
                </button>
             ))}
          </div>
        </div>
      )}

      {['privacy', 'accounts', 'notifications'].includes(subPage) && (
        <div className="p-4 pb-24">
          <button onClick={() => setSubPage('main')} className="mb-4 text-white flex items-center gap-2"><BackIcon size={22} /> Назад</button>
          <h2 className="text-xl font-bold text-white mb-4 capitalize">{subPage}</h2>
          <p className="text-gray-400 text-sm">Этот раздел в разработке.</p>
        </div>
      )}
    </div>
  );
}
