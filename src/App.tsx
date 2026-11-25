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

  // Оптимизация: функции не пересоздаются при каждом рендере
  const handleOpenProfile = useCallback((id: string) => setViewingProfileId(id), []);
  const handleOpenChat = useCallback((chatId: string, peer: any) => setOpenChat({ chatId, peer }), []);

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
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-black">
      <div className="flex-1 relative overflow-hidden">
        {openChat ? (
          <ChatView 
            chatId={openChat.chatId} 
            peer={openChat.peer} 
            group={null} 
            onBack={() => setOpenChat(null)} 
            onCall={() => alert('Звонки в разработке')} 
            onViewProfile={handleOpenProfile} 
          />
        ) : (
          <>
            {activeTab === 'chats' && <ChatList onOpenChat={handleOpenChat} onViewProfile={handleOpenProfile} />}
            {activeTab === 'feed' && <FeedView onViewProfile={handleOpenProfile} />}
            {activeTab === 'search' && <SearchView onOpenChat={handleOpenChat} onViewProfile={handleOpenProfile} />}
            {activeTab === 'settings' && <SettingsView onViewProfile={handleOpenProfile} />}
            {activeTab === 'calls' && (
              <div className="h-full flex flex-col items-center justify-center text-white">
                <div className="text-6xl mb-4">📞</div>
                <h2 className="text-xl font-bold">Звонки в разработке</h2>
              </div>
            )}
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
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="rounded-3xl p-5 w-full max-w-md border border-white/10 shadow-2xl bg-[#1a1a1a]" onClick={e => e.stopPropagation()}>
              <h2 className="font-bold text-xl mb-4 text-white">Новый пост</h2>
              <textarea value={postText} onChange={e => setPostText(e.target.value)} placeholder="О чем думаешь?" className="w-full h-32 p-4 rounded-2xl outline-none resize-none border text-[16px] bg-black text-white border-white/10 focus:border-blue-500 transition-colors" />
              <div className="flex gap-3 mt-4">
                <button onClick={() => setShowPostModal(false)} className="flex-1 py-3 rounded-2xl font-semibold bg-white/10 text-white active:scale-95 transition-transform">Отмена</button>
                <button onClick={handleCreatePost} disabled={isPosting || !postText.trim()} className="flex-1 py-3 rounded-2xl font-semibold text-white disabled:opacity-50 bg-blue-500 active:scale-95 transition-transform">
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
