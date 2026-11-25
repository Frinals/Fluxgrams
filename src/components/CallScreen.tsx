import { motion } from 'framer-motion';

export default function CallScreen({ callState, peer, isMuted, toggleMute, endCall }: any) {
  if (callState === 'idle') return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 50 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: 50 }}
      className="fixed inset-0 z-[99999] flex flex-col items-center justify-between py-20 px-6"
      style={{ 
        background: 'linear-gradient(135deg, var(--app-bg) 0%, var(--app-surface) 100%)',
        backdropFilter: 'blur(20px)' 
      }}
    >
      {/* Верхняя часть: Информация о собеседнике */}
      <div className="flex flex-col items-center mt-10">
        <div className="w-32 h-32 rounded-full overflow-hidden mb-6 shadow-2xl border-4" style={{ borderColor: 'var(--app-accent)' }}>
          {peer?.avatar_url ? (
            <img src={peer.avatar_url} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl font-bold bg-gray-700 text-white">
              {peer?.display_name?.[0] || 'U'}
            </div>
          )}
        </div>
        <h2 className="text-3xl font-bold mb-2" style={{ color: 'var(--app-text)' }}>
          {peer?.display_name || 'Пользователь'}
        </h2>
        <p className="text-lg font-medium animate-pulse" style={{ color: 'var(--app-accent)' }}>
          {callState === 'calling' ? 'Вызов...' : callState === 'incoming' ? 'Входящий звонок...' : 'В сети'}
        </p>
      </div>

      {/* Нижняя часть: Кнопки управления */}
      <div className="flex items-center gap-8 mb-10">
        {/* Кнопка Микрофона */}
        <button 
          onClick={toggleMute}
          className="w-16 h-16 rounded-full flex items-center justify-center transition-all active:scale-90"
          style={{ 
            background: isMuted ? '#ef4444' : 'var(--app-surface)', 
            border: `1px solid ${isMuted ? '#ef4444' : 'var(--app-border)'}`,
            color: isMuted ? '#fff' : 'var(--app-text)'
          }}
        >
          {isMuted ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
          )}
        </button>

        {/* Кнопка Сброса */}
        <button 
          onClick={endCall}
          className="w-20 h-20 rounded-full flex items-center justify-center bg-red-500 text-white shadow-xl shadow-red-500/30 transition-all active:scale-90"
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"></path><line x1="23" y1="1" x2="1" y2="23"></line></svg>
        </button>
      </div>
    </motion.div>
  );
}
