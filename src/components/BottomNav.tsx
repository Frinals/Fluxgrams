import { motion } from 'framer-motion';
import { ChatIcon, PhoneIcon, SearchIcon, SettingsIcon, PlusIcon } from '@/components/Icons'; // Добавь FeedIcon если есть, иначе эмодзи

export type Tab = 'chats' | 'calls' | 'feed' | 'search' | 'settings';

export default function BottomNav({ active, onChange, onCreatePost }: { active: Tab, onChange: (t: Tab) => void, onCreatePost: () => void }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-2 pb-safe" style={{ background: 'var(--app-surface)', borderTop: '1px solid var(--app-border)' }}>
      <div className="flex justify-between items-center max-w-md mx-auto relative px-2">
        <NavBtn icon={<ChatIcon size={24} />} label="Чаты" isActive={active === 'chats'} onClick={() => onChange('chats')} />
        <NavBtn icon={<PhoneIcon size={24} />} label="Звонки" isActive={active === 'calls'} onClick={() => onChange('calls')} />
        
        {/* Кнопка плюс */}
        <div className="relative -top-4">
          <motion.button whileTap={{ scale: 0.9 }} onClick={onCreatePost} className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg text-white" style={{ background: 'var(--app-accent)' }}>
            <PlusIcon size={28} />
          </motion.button>
        </div>

        <NavBtn icon={<span className="text-[22px]">🌐</span>} label="Лента" isActive={active === 'feed'} onClick={() => onChange('feed')} />
        <NavBtn icon={<SettingsIcon size={24} />} label="Настройки" isActive={active === 'settings'} onClick={() => onChange('settings')} />
      </div>
    </div>
  );
}

const NavBtn = ({ icon, label, isActive, onClick }: any) => (
  <button onClick={onClick} className="flex flex-col items-center justify-center w-14 gap-1 transition-colors" style={{ color: isActive ? 'var(--app-accent)' : 'var(--app-text-muted)' }}>
    {icon}
    <span className="text-[10px] font-medium">{label}</span>
  </button>
);
