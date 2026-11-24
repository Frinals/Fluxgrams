import { motion } from 'framer-motion';
import { ChatIcon, PhoneIcon, SettingsIcon, SearchIcon, PlusIcon } from '@/components/Icons';

export type Tab = 'chats' | 'search' | 'calls' | 'settings';

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
  onCreatePost: () => void;
}

export default function BottomNav({ active, onChange, onCreatePost }: Props) {
  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 flex justify-center">
      <div className="flex items-center justify-between w-full max-w-md px-4 py-3 rounded-[30px] glass-panel border shadow-2xl" style={{ background: 'rgba(20,20,25,0.85)', backdropFilter: 'blur(20px)', borderColor: 'rgba(255,255,255,0.1)' }}>
        
        <button onClick={() => onChange('chats')} className="flex flex-col items-center gap-1 w-12">
          <ChatIcon size={24} color={active === 'chats' ? 'var(--app-accent)' : '#666'} />
          <span className="text-[10px]" style={{ color: active === 'chats' ? 'var(--app-accent)' : '#666' }}>Чаты</span>
        </button>

        <button onClick={() => onChange('calls')} className="flex flex-col items-center gap-1 w-12">
          <PhoneIcon size={24} color={active === 'calls' ? 'var(--app-accent)' : '#666'} />
          <span className="text-[10px]" style={{ color: active === 'calls' ? 'var(--app-accent)' : '#666' }}>Звонки</span>
        </button>

        {/* КНОПКА ПЛЮС ПОСЕРЕДИНЕ */}
        <motion.button whileTap={{ scale: 0.9 }} onClick={onCreatePost} className="w-14 h-14 rounded-full flex items-center justify-center -mt-6 shadow-lg shadow-blue-500/50" style={{ background: 'var(--app-accent)' }}>
          <PlusIcon size={28} color="#fff" />
        </motion.button>

        <button onClick={() => onChange('search')} className="flex flex-col items-center gap-1 w-12">
          <SearchIcon size={24} color={active === 'search' ? 'var(--app-accent)' : '#666'} />
          <span className="text-[10px]" style={{ color: active === 'search' ? 'var(--app-accent)' : '#666' }}>Поиск</span>
        </button>

        <button onClick={() => onChange('settings')} className="flex flex-col items-center gap-1 w-12">
          <SettingsIcon size={24} color={active === 'settings' ? 'var(--app-accent)' : '#666'} />
          <span className="text-[10px]" style={{ color: active === 'settings' ? 'var(--app-accent)' : '#666' }}>Настройки</span>
        </button>

      </div>
    </div>
  );
}
