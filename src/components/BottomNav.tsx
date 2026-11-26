import { ChatIcon, PhoneIcon, SettingsIcon, PlusIcon } from '@/components/Icons';

export type Tab = 'chats' | 'calls' | 'feed' | 'settings';

export default function BottomNav({ active, onChange, onCreatePost }: { active: Tab, onChange: (t: Tab) => void, onCreatePost: () => void }) {
  return (
    <div className="fixed bottom-4 left-4 right-4 z-50">
      <div className="max-w-md mx-auto relative px-4 py-2 rounded-[2rem] liquid-glass bottom-nav-glass flex justify-between items-center">
        
        <button onClick={() => onChange('chats')} className="flex flex-col items-center justify-center w-12 gap-1" style={{ color: active === 'chats' ? 'var(--app-accent)' : 'var(--app-text-muted)' }}>
          <ChatIcon size={22} /><span className="text-[9px] font-medium">Чаты</span>
        </button>
        
        <button onClick={() => onChange('calls')} className="flex flex-col items-center justify-center w-12 gap-1" style={{ color: active === 'calls' ? 'var(--app-accent)' : 'var(--app-text-muted)' }}>
          <PhoneIcon size={22} /><span className="text-[9px] font-medium">Звонки</span>
        </button>
        
        <div className="relative -top-5">
          <button onClick={onCreatePost} className="w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg" style={{ background: 'var(--app-accent)' }}>
            <PlusIcon size={28} />
          </button>
        </div>

        <button onClick={() => onChange('feed')} className="flex flex-col items-center justify-center w-12 gap-1" style={{ color: active === 'feed' ? 'var(--app-accent)' : 'var(--app-text-muted)' }}>
          <span className="text-[20px]">🌐</span><span className="text-[9px] font-medium">Лента</span>
        </button>
        
        <button onClick={() => onChange('settings')} className="flex flex-col items-center justify-center w-12 gap-1" style={{ color: active === 'settings' ? 'var(--app-accent)' : 'var(--app-text-muted)' }}>
          <SettingsIcon size={22} /><span className="text-[9px] font-medium">Настройки</span>
        </button>
      </div>
    </div>
  );
}
