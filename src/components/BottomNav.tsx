import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { ChatIcon, PhoneIcon, SettingsIcon, SearchIcon } from '@/components/Icons';

export type Tab = 'chats' | 'search' | 'calls' | 'settings';

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
}

const springTransition = { type: 'spring' as const, stiffness: 300, damping: 30 };

export default function BottomNav({ active, onChange }: Props) {
  const { t } = useLanguage();

  const tabs: { key: Tab; label: string; icon: typeof ChatIcon }[] = [
    { key: 'chats', label: t('chats'), icon: ChatIcon },
    { key: 'calls', label: t('calls'), icon: PhoneIcon },
    { key: 'settings', label: t('settings'), icon: SettingsIcon },
    { key: 'search', label: t('searchTab'), icon: SearchIcon },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pointer-events-none">
      <motion.nav
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={springTransition}
        className="pointer-events-auto mb-5 rounded-full border"
        style={{
          borderColor: 'var(--app-border-glass)',
          background: 'var(--app-nav-bg)',
          backdropFilter: 'blur(32px) saturate(180%)',
          WebkitBackdropFilter: 'blur(32px) saturate(180%)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.25), inset 0 1px 1px 0 rgba(255,255,255,0.1)',
        }}
      >
        <div className="flex items-center justify-center gap-1 px-2 py-2 relative">
          {tabs.map(({ key, label, icon: Icon }) => {
            const isActive = active === key;
            return (
              <button
                key={key}
                onClick={() => onChange(key)}
                className="relative flex flex-col items-center justify-center gap-0.5 px-4 py-2 rounded-full transition-colors"
                style={{
                  color: isActive ? 'var(--app-nav-active)' : 'var(--app-text-muted)',
                }}
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-active-glass"
                    transition={springTransition}
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: 'var(--app-glass)',
                      backdropFilter: 'blur(20px) saturate(200%)',
                      WebkitBackdropFilter: 'blur(20px) saturate(200%)',
                      border: '1px solid var(--app-border-glass)',
                      boxShadow: 'inset 0 1px 1.5px 0 rgba(255,255,255,0.25), inset 0 -1px 1.5px 0 rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.12), 0 0 20px var(--app-glow)',
                    }}
                  />
                )}
                {isActive && (
                  <motion.div
                    layoutId="nav-active-gloss"
                    transition={springTransition}
                    className="absolute top-1 left-2 right-2 h-1/3 rounded-full pointer-events-none"
                    style={{
                      background: 'linear-gradient(180deg, rgba(255,255,255,0.25) 0%, transparent 100%)',
                    }}
                  />
                )}
                <motion.div
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.88 }}
                  transition={springTransition}
                  className="relative z-10 flex flex-col items-center gap-0.5"
                >
                  <Icon size={22} />
                  <span className="text-[10px] font-semibold">{label}</span>
                </motion.div>
              </button>
            );
          })}
        </div>
      </motion.nav>
    </div>
  );
}
