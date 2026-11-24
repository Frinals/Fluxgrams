import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
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

class ErrorBoundary extends React.Component<any, any> {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) return <div style={{ padding: 20, background: 'red', color: 'white', minHeight: '100vh' }}><h1>Ошибка!</h1><p>{this.state.error.message}</p></div>;
    return this.props.children;
  }
}

function MessengerApp() {
  const { user, loading, needsEmailVerification } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('chats');
  const [openChat, setOpenChat] = useState<any>(null);
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null);
  const [isMaintenance, setIsMaintenance] = useState(false);
  
  const [showPostModal, setShowPostModal] = useState(false);
  const [postText, setPostText] = useState('');

  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.from('app_settings').select('is_maintenance').eq('id', 1).single();
      if (data?.is_maintenance) setIsMaintenance(true);
    };
    check();
  }, []);

  const handleCreatePost = async () => {
    if (!postText.trim() || !user) return;
    await supabase.from('user_posts').insert({ user_id: user.id, content: postText });
    setPostText(''); setShowPostModal(false); alert('Пост опубликован!');
  };

  if (isMaintenance) return (
    <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-[#0f1115] p-6 text-center">
      <div className="text-6xl mb-6">🛠️</div><h1 className="text-3xl font-bold text-white mb-2">Технические работы</h1>
      <button onClick={() => window.location.href = 'about:blank'} className="mt-8 px-8 py-3 bg-red-500 text-white font-bold rounded-xl">Выйти</button>
    </div>
  );

  if (loading) return <div className="h-screen bg-[#0f1115]" />;
  if (!user || needsEmailVerification) return <AuthScreen />;

  return (
    <div className="h-screen flex flex-col bg-[#0f1115]">
      <div className="flex-1 relative overflow-hidden">
        {openChat ? (
          <ChatView chatId={openChat.chatId} peer={openChat.peer} group={null} onBack={() => setOpenChat(null)} onCall={() => alert('Звонки в разработке')} />
        ) : (
          <>
            {activeTab === 'chats' && <ChatList onOpenChat={(chatId: string, peer: any) => setOpenChat({ chatId, peer })} onOpenGroup={() => {}} />}
            {activeTab === 'settings' && <SettingsView onViewProfile={(id: string) => setViewingProfileId(id)} />}
            {activeTab === 'search' && <div className="p-4 text-white">Поиск в разработке</div>}
            {activeTab === 'calls' && <div className="p-4 text-white">Звонки в разработке</div>}
          </>
        )}
      </div>

      {!openChat && <BottomNav active={activeTab} onChange={setActiveTab} onCreatePost={() => setShowPostModal(true)} />}

      <AnimatePresence>
        {viewingProfileId && <UserProfileModal profileId={viewingProfileId} onClose={() => setViewingProfileId(null)} />}
        {showPostModal && (
          <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4">
            <div className="bg-[#1a1a1a] p-6 rounded-3xl w-full max-w-md border border-white/10">
              <h2 className="text-white font-bold mb-4">Новый пост</h2>
              <textarea value={postText} onChange={e => setPostText(e.target.value)} className="w-full h-32 p-3 bg-[#0f1115] text-white border border-white/10 rounded-xl mb-4 outline-none" />
              <div className="flex gap-2">
                <button onClick={() => setShowPostModal(false)} className="flex-1 py-3 bg-white/10 text-white rounded-xl">Отмена</button>
                <button onClick={handleCreatePost} className="flex-1 py-3 bg-blue-500 text-white rounded-xl">Опубликовать</button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider><LanguageProvider><AuthProvider><MessengerApp /></AuthProvider></LanguageProvider></ThemeProvider>
    </ErrorBoundary>
  );
}
