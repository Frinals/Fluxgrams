import { memo } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { XIcon } from '@/components/Icons';

export interface GiftType {
  id: string;
  nameKey: 'liquidRose' | 'neonStar' | 'goldenCrown';
  gradient: string;
  emoji: string;
  glow: string;
}

const GIFTS: GiftType[] = [
  { id: 'rose', nameKey: 'liquidRose', gradient: 'linear-gradient(135deg, #ff6b9d, #c44569)', emoji: '🌹', glow: 'rgba(255,107,157,0.4)' },
  { id: 'star', nameKey: 'neonStar', gradient: 'linear-gradient(135deg, #00f5d4, #00bbf9)', emoji: '⭐', glow: 'rgba(0,245,212,0.4)' },
  { id: 'crown', nameKey: 'goldenCrown', gradient: 'linear-gradient(135deg, #ffd700, #ffaa00)', emoji: '👑', glow: 'rgba(255,215,0,0.4)' },
];

const springTransition = { type: 'spring' as const, stiffness: 300, damping: 30 };

interface Props {
  onClose: () => void;
  onSendGift: (gift: GiftType) => void;
}

function GiftsModalInner({ onClose, onSendGift }: Props) {
  const { t } = useLanguage();

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={springTransition}
        className="glass-panel rounded-3xl p-6 max-w-sm w-full"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold" style={{ color: 'var(--app-text)' }}>{t('gifts')}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10" style={{ color: 'var(--app-text-muted)' }}>
            <XIcon size={20} />
          </button>
        </div>
        <div className="flex items-center gap-1.5 mb-5">
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{ background: 'var(--app-accent)', color: '#fff' }}>{t('comingSoon')}</span>
        </div>

        <div className="space-y-3">
          {GIFTS.map((gift, idx) => (
            <motion.button
              key={gift.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...springTransition, delay: idx * 0.08 }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onSendGift(gift)}
              className="w-full flex items-center gap-4 p-4 rounded-2xl transition-all relative overflow-hidden"
              style={{
                background: 'var(--app-surface)',
                border: '1px solid var(--app-border-glass)',
              }}
            >
              {/* Animated glow background */}
              <div className="absolute inset-0 opacity-30"
                   style={{ background: gift.gradient, filter: 'blur(20px)' }} />

              {/* Gift icon circle */}
              <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
                   style={{
                     background: gift.gradient,
                     boxShadow: `0 0 20px ${gift.glow}, inset 0 1px 1px rgba(255,255,255,0.3)`,
                   }}>
                {gift.emoji}
              </div>

              <div className="relative flex-1 text-left">
                <p className="font-bold" style={{ color: 'var(--app-text)' }}>{t(gift.nameKey)}</p>
                <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>{t('sendGift')}</p>
              </div>

              <motion.div
                animate={{ y: [0, -4, 0] }}
                transition={{ repeat: Infinity, duration: 2, delay: idx * 0.3 }}
                className="relative text-2xl"
              >
                →
              </motion.div>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

export const GiftsModal = memo(GiftsModalInner);
export { GIFTS };
