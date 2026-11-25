import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { themes, themeList } from '@/lib/types';
import { UserIcon, LockIcon, GlobeIcon, PaletteIcon, LogOutIcon, ChevronRightIcon, BellIcon, BackIcon, UsersIcon, VerifiedIcon, LeafIcon } from '@/components/Icons';

type SubPage = 'main' | 'profile' | 'privacy' | 'appearance' | 'notifications' | 'accounts' | 'currency';

export default function SettingsView({ onViewProfile }: any) {
  const { user, profile, signOut } = useAuth();
  const { lang, setLang } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [subPage, setSubPage] = useState<SubPage>('main');

  const cards = [
    { key: 'profile', icon: UserIcon, label: 'Профиль', desc: 'Аватар, баннер, посты' },
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
          <div className="bg-white/5 rounded-3xl p-5 flex items-center gap-4 mb-4 cursor-pointer border border-white/10" onClick={() => onViewProfile && onViewProfile(profile?.id)}>
            {profile?.avatar_url ? <img src={profile.avatar_url} className="w-16 h-16 rounded-full object-cover" /> : <div className="w-16 h-16 rounded-full bg-blue-500" />}
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <p className="font-bold text-lg text-white">{profile?.display_name || 'User'}</p>
                {(profile as any)?.is_verified && <VerifiedIcon size={18} />}
              </div>
              <p className="text-sm text-gray-400">@{profile?.username}</p>
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
            <div className="flex gap-2">
              <button className="flex-1 py-3 bg-blue-500 text-white rounded-xl font-bold opacity-50">Пополнить</button>
              <button className="flex-1 py-3 bg-white/10 text-white rounded-xl font-bold opacity-50">Отправить</button>
            </div>
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

      {['privacy', 'accounts', 'notifications', 'profile'].includes(subPage) && (
        <div className="p-4 pb-24">
          <button onClick={() => setSubPage('main')} className="mb-4 text-white flex items-center gap-2"><BackIcon size={22} /> Назад</button>
          <h2 className="text-xl font-bold text-white mb-4 capitalize">{subPage}</h2>
          <p className="text-gray-400 text-sm">Этот раздел в разработке.</p>
        </div>
      )}
    </div>
  );
}
{subPage === 'profile' && (
  <div className="p-4">
    <button onClick={() => setSubPage('main')} className="mb-4 text-white flex items-center gap-2">
      <BackIcon /> Назад
    </button>
    <h2 className="text-xl font-bold mb-4">Профиль</h2>
    <div className="flex items-center gap-3 mb-4">
      {profile?.avatar_url ? (
        <img src={profile.avatar_url} className="w-16 h-16 rounded-full" />
      ) : (
        <div className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center text-xl font-bold">
          {profile?.display_name?.[0] || 'U'}
        </div>
      )}
      <div>
        <div className="font-semibold flex items-center gap-1">
          {profile?.display_name || 'User'}
          {profile?.is_verified && <VerifiedIcon className="w-4 h-4 text-blue-400" />}
        </div>
        <div className="text-sm text-gray-400">@{profile?.username}</div>
      </div>
    </div>
    <button
      onClick={() => onViewProfile?.(profile?.id)}
      className="w-full py-3 bg-blue-500 rounded-xl font-semibold mb-2"
    >
      Просмотреть профиль
    </button>
    <button className="w-full py-3 bg-white/10 rounded-xl font-semibold">
      Настроить профиль
    </button>
  </div>
)}
