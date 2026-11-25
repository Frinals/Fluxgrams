import React, { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import AuthScreen from '@/components/AuthScreen';
import BottomNav, { Tab } from '@/components/BottomNav';
import ChatList from '@/components/ChatList';
import ChatView from '@/components/ChatView';
import SettingsView from '@/components/SettingsView';
import UserProfileModal from '@/components/UserProfileModal';
import SearchView from '@/components/SearchView';
import FeedView from '@/components/FeedView';
import CallScreen from '@/components/CallScreen';
import { useCall } from '@/hooks/useCall';
import { useNotifications } from '@/hooks/useNotifications';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) return <div style={{ padding: 20, background: 'red', color: 'white', minHeight: '100vh' }}><h1>Ошибка!</h1><p>{this.state.error?.message}</p></div>;
    return this.props.children;
  }
}

function MessengerApp() {
  const { user, loading, needsEmailVerification } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('chats');
  const [openChat, setOpenChat] = useState<any>(null);
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null);
  
  const [showPostModal, setShowPostModal] = useState(false);
  const [postText, setPostText] = useState('');
  const [isPosting, setIsPosting] = useState(false);

  useNotifications();

  const { callState, remotePeer, isMuted, startCall, acceptCall, endCall, toggleMute } = useCall();

  const handleOpenProfile = useCallback((id: string) => setViewingProfileId(id), []);
  const handleOpenChat = useCallback((chatId: string, peer: any) => setOpenChat({ chatId, peer }), []);

  const handleStartCall = (peer: any) => {
    startCall(peer);
  };

  const handleCreatePost = async () => {
    if (!postText.trim() || !user) return;
    setIsPosting(true);
    await supabase.from('user_posts').insert({ user_id: user.id, content: postText });
    setPostText(''); 
    setShowPostModal(false);
    setIsPosting(false);
    setViewingProfileId(user.id);
  };

  if (loading) return <div className="h-[100dvh] flex items-center justify-center font-bold text-white bg-black">Загрузка...</div>;
  if (!user || needsEmailVerification) return <AuthScreen />;

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-black relative">
      
      {/* 1. БАННЕР ВХОДЯЩЕГО ЗВОНКА (ВНУТРИ ПРИЛОЖЕНИЯ) */}
      <AnimatePresence>
        {callState === 'incoming' && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-4 left-4 right-4 z-[99999] rounded-3xl p-4 shadow-2xl flex items-center justify-between border"
            style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)', backdropFilter: 'blur(20px)' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center text-white font-bold text-xl shadow-lg" style={{ background: 'var(--app-accent)' }}>
                {remotePeer?.avatar_url ? (
                  <img src={remotePeer.avatar_url} className="w-full h-full object-cover" />
                ) : (
                  (remotePeer?.display_name || 'U')[0]
                )}
              </div>
              <div>
                <p className="font-bold text-[16px]" style={{ color: 'var(--app-text)' }}>
                  {remotePeer?.display_name || 'Пользователь'}
                </p>
                <p className="text-xs text-green-500 font-medium animate-pulse">Входящий звонок...</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={endCall} className="w-11 h-11 rounded-full bg-red-500 flex items-center justify-center text-white active:scale-90 transition-transform shadow-lg shadow-red-500/30">
                <span className="text-xl">✖</span>
              </button>
              <button onClick={acceptCall} className="w-11 h-11 rounded-full bg-green-500 flex items-center justify-center text-white active:scale-90 transition-transform shadow-lg shadow-green-500/30">
                <span className="text-xl">📞</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. ПОЛНОЭКРАННЫЙ ЗВОНОК (КОГДА УЖЕ ОТВЕТИЛИ ИЛИ ЗВОНИМ САМИ) */}
      <AnimatePresence>
        {(callState === 'calling' || callState === 'active') && (
          <CallScreen 
            callState={callState} 
            peer={remotePeer || { display_name: 'Собеседник' }} 
            isMuted={isMuted} 
            toggleMute={toggleMute} 
            endCall={endCall} 
          />
        )}
      </AnimatePresence>

      <div className="flex-1 relative overflow-hidden">
        {openChat ? (
          <ChatView 
            chatId={openChat.chatId} 
            peer={openChat.peer} 
            group={null} 
            onBack={() => setOpenChat(null)} 
            onCall={() => handleStartCall(openChat.peer)} 
            onViewProfile={handleOpenProfile} 
          />
        ) : (
          <>
            {activeTab === 'chats' && <ChatList onOpenChat={handleOpenChat} onViewProfile={handleOpenProfile} />}
            {activeTab === 'feed' && <FeedView onViewProfile={handleOpenProfile} />}
            {activeTab === 'search' && <SearchView onOpenChat={handleOpenChat} onViewProfile={handleOpenProfile} />}
            {activeTab === 'settings' && <SettingsView onViewProfile={handleOpenProfile} />}
          </>
        )}
      </div>

      {!openChat && <BottomNav active={activeTab} onChange={setActiveTab} onCreatePost={() => setShowPostModal(true)} />}

      <AnimatePresence>
        {viewingProfileId && <UserProfileModal profileId={viewingProfileId} onClose={() => setViewingProfileId(null)} />}
      </AnimatePresence>

      <AnimatePresence>
        {showPostModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[999] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowPostModal(false)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="rounded-3xl p-5 w-full max-w-md border border-white/10 shadow-2xl" style={{ background: 'var(--app-surface)' }} onClick={e => e.stopPropagation()}>
              <h2 className="font-bold text-xl mb-4" style={{ color: 'var(--app-text)' }}>Новый пост</h2>
              <textarea value={postText} onChange={e => setPostText(e.target.value)} placeholder="О чем думаешь?" className="w-full h-32 p-4 rounded-2xl outline-none resize-none border text-[16px]" style={{ background: 'var(--app-bg)', color: 'var(--app-text)', borderColor: 'var(--app-border)' }} />
              <div className="flex gap-3 mt-4">
                <button onClick={() => setShowPostModal(false)} className="flex-1 py-3 rounded-2xl font-semibold" style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--app-text)' }}>Отмена</button>
                <button onClick={handleCreatePost} disabled={isPosting || !postText.trim()} className="flex-1 py-3 rounded-2xl font-semibold text-white disabled:opacity-50" style={{ background: 'var(--app-accent)' }}>
                  {isPosting ? 'Публикация...' : 'Опубликовать'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <MessengerApp />
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
