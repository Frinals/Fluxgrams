import { ChatIcon, PhoneIcon, SettingsIcon, PlusIcon, MusicIcon } from '@/components/Icons';

export type Tab = 'chats' | 'calls' | 'feed' | 'music' | 'settings';

export default function BottomNav({ active, onChange, onCreatePost }: { active: Tab, onChange: (t: Tab) => void, onCreatePost: () => void }) {
  return (
    <div className="bottom-nav-floating">
      <div className="max-w-md mx-auto px-2 py-2 rounded-[30px] liquid-glass flex justify-between items-center">
        <NavBtn icon={<ChatIcon size={22} />} label="Чаты" isActive={active === 'chats'} onClick={() => onChange('chats')} />
        <NavBtn icon={<PhoneIcon size={22} />} label="Звонки" isActive={active === 'calls'} onClick={() => onChange('calls')} />
        
        <div className="relative -top-5">
          <button onClick={onCreatePost} className="w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg active:scale-90 transition-transform" style={{ background: 'var(--app-accent)' }}>
            <PlusIcon size={28} />
          </button>
        </div>

        <NavBtn icon={<span className="text-[20px]">🌐</span>} label="Лента" isActive={active === 'feed'} onClick={() => onChange('feed')} />
        <NavBtn icon={<MusicIcon size={22} />} label="Музыка" isActive={active === 'music'} onClick={() => onChange('music')} />
        <NavBtn icon={<SettingsIcon size={22} />} label="Настройки" isActive={active === 'settings'} onClick={() => onChange('settings')} />
      </div>
    </div>
  );
}

const NavBtn = ({ icon, label, isActive, onClick }: any) => (
  <button onClick={onClick} className="flex flex-col items-center justify-center w-11 gap-1 transition-all" style={{ color: isActive ? 'var(--app-accent)' : 'var(--app-text-muted)', transform: isActive ? 'scale(1.1)' : 'scale(1)' }}>
    {icon}
    <span className="text-[9px] font-bold">{label}</span>
  </button>
);
