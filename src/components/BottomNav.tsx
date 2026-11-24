import { motion } from 'framer-motion';
import { ChatIcon, PhoneIcon, SettingsIcon, SearchIcon, PlusIcon } from '@/components/Icons';

export type Tab = 'chats' | 'search' | 'calls' | 'settings';

export default function BottomNav({ active, onChange, onCreatePost }: { active: Tab, onChange: (t: Tab) => void, onCreatePost: () => void }) {
  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 flex justify-center pointer-events-none">
      <div className="flex items-center justify-between w-full max-w-md px-6 py-3 rounded-[30px] bg-[#1a1a1a]/90 backdrop-blur-xl border border-white/10 shadow-2xl pointer-events-auto">
        
        <button onClick={() => onChange('chats')} className="flex flex-col items-center gap-1 w-12">
          <ChatIcon size={24} color={active === 'chats' ? 'var(--app-accent)' : '#666'} />
        </button>

        <button onClick={() => onChange('calls')} className="flex flex-col items-center gap-1 w-12">
          <PhoneIcon size={24} color={active === 'calls' ? 'var(--app-accent)' : '#666'} />
        </button>

        <motion.button whileTap={{ scale: 0.9 }} onClick={onCreatePost} className="w-14 h-14 rounded-full flex items-center justify-center -mt-8 shadow-lg shadow-blue-500/50 bg-blue-500">
          <PlusIcon size={28} color="#fff" />
        </motion.button>

        <button onClick={() => onChange('search')} className="flex flex-col items-center gap-1 w-12">
          <SearchIcon size={24} color={active === 'search' ? 'var(--app-accent)' : '#666'} />
        </button>

        <button onClick={() => onChange('settings')} className="flex flex-col items-center gap-1 w-12">
          <SettingsIcon size={24} color={active === 'settings' ? 'var(--app-accent)' : '#666'} />
        </button>

      </div>
    </div>
  );
}
