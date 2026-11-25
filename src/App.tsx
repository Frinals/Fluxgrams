import React, { useState } from 'react';
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

  const handleCreatePost = async () => {
    if (!postText.trim() || !user) return;
    setIsPosting(true);
    await supabase.from('user_posts').insert({ user_id: user.id, content: postText });
    setPostText(''); 
    setShowPostModal(false);
    setIsPosting(false);
    setViewingProfileId(user.id);
  };

  if (loading) return <div className="h-[100dvh] flex items-center justify-center font-bold" style={{ background: 'var(--app-bg)', color: 'var(--app-text)' }}>Загрузка...</div>;
  if (!user || needsEmailVerification) return <AuthScreen />;

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden" style={{ background: 'var(--app-bg)' }}>
      <div className="flex-1 relative overflow-hidden">
        {openChat ? (
          <ChatView 
            chatId={openChat.chatId} 
            peer={openChat.peer} 
            group={null} 
            onBack={() => setOpenChat(null)} 
            onCall={() => alert('Звонки в разработке')} 
            onViewProfile={(id: string) => setViewingProfileId(id)} 
          />
        ) : (
          <>
            {activeTab === 'chats' && (
              <ChatList 
                onOpenChat={(chatId: string, peer: any) => setOpenChat({ chatId, peer })} 
                onViewProfile={(id: string) => setViewingProfileId(id)}
              />
            )}
            {activeTab === 'feed' && <FeedView onViewProfile={(id: string) => setViewingProfileId(id)} />}
            {activeTab === 'search' && (
              <SearchView 
                onOpenChat={(chatId: string, peer: any) => setOpenChat({ chatId, peer })} 
                onViewProfile={(id: string) => setViewingProfileId(id)} 
              />
            )}
            {activeTab === 'settings' && <SettingsView onViewProfile={(id: string) => setViewingProfileId(id)} />}
            {activeTab === 'calls' && (
              <div className="h-full flex flex-col items-center justify-center" style={{ color: 'var(--app-text)' }}>
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
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="rounded-3xl p-5 w-full max-w-md border shadow-2xl" style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }} onClick={e => e.stopPropagation()}>
              <h2 className="font-bold text-xl mb-4" style={{ color: 'var(--app-text)' }}>Новый пост</h2>
              <textarea value={postText} onChange={e => setPostText(e.target.value)} placeholder="О чем думаешь?" className="w-full h-32 p-4 rounded-2xl outline-none resize-none border text-[16px]" style={{ background: 'var(--app-bg)', color: 'var(--app-text)', borderColor: 'var(--app-border)' }} />
              <div className="flex gap-3 mt-4">
                <button onClick={() => setShowPostModal(false)} className="flex-1 py-3 rounded-2xl font-semibold" style={{ background: 'var(--app-bg)', color: 'var(--app-text)' }}>Отмена</button>
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
