import { motion } from 'framer-motion';
import { ChatIcon, SearchIcon, SettingsIcon, PlusIcon } from '@/components/Icons';

// Оставили 4 вкладки + кнопка плюс
export type Tab = 'chats' | 'feed' | 'search' | 'settings';

export default function BottomNav({ active, onChange, onCreatePost }: { active: Tab, onChange: (t: Tab) => void, onCreatePost: () => void }) {
  return (
    <div className="fixed bottom-4 left-4 right-4 z-50">
      <div className="max-w-md mx-auto relative px-4 py-3 rounded-[2rem] flex justify-between items-center shadow-2xl backdrop-blur-xl border border-white/10" style={{ background: 'rgba(26, 26, 26, 0.8)' }}>
        
        <NavBtn icon={<ChatIcon size={22} />} label="Чаты" isActive={active === 'chats'} onClick={() => onChange('chats')} />
        <NavBtn icon={<SearchIcon size={22} />} label="Поиск" isActive={active === 'search'} onClick={() => onChange('search')} />
        
        {/* Кнопка плюс (создание поста) */}
        <div className="relative -top-6">
          <motion.button whileTap={{ scale: 0.9 }} onClick={onCreatePost} className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg text-white" style={{ background: 'var(--app-accent)' }}>
            <PlusIcon size={28} />
          </motion.button>
        </div>

        <NavBtn icon={<span className="text-[20px]">🌐</span>} label="Лента" isActive={active === 'feed'} onClick={() => onChange('feed')} />
        <NavBtn icon={<SettingsIcon size={22} />} label="Настройки" isActive={active === 'settings'} onClick={() => onChange('settings')} />
      </div>
    </div>
  );
}

const NavBtn = ({ icon, label, isActive, onClick }: any) => (
  <button onClick={onClick} className="flex flex-col items-center justify-center w-12 gap-1 transition-colors" style={{ color: isActive ? 'var(--app-accent)' : 'var(--app-text-muted)' }}>
    {icon}
    <span className="text-[9px] font-medium">{label}</span>
  </button>
);
