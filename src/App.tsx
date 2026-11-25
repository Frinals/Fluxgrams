import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { supabase, Profile, Group } from '@/lib/supabase';
import AuthScreen from '@/components/AuthScreen';
import BottomNav, { Tab } from '@/components/BottomNav';
import ChatList from '@/components/ChatList';
import ChatView from '@/components/ChatView';
import CallsView from '@/components/CallsView';
import SearchView from '@/components/SearchView';
import SettingsView from '@/components/SettingsView';
import IncomingCallModal from '@/components/IncomingCallModal';
import OutgoingCallModal from '@/components/OutgoingCallModal';
import UserProfileModal from '@/components/UserProfileModal';

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: any) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) return <div style={{ padding: 20, background: 'red', color: 'white', minHeight: '100vh' }}><h1>Ошибка!</h1><p>{this.state.error?.message}</p></div>;
    return this.props.children;
  }
}

function GlobalManager() {
  const { user } = useAuth();
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [banner, setBanner] = useState<any>(null);

  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.from('app_settings').select('is_maintenance').eq('id', 1).single();
      if (data?.is_maintenance) setIsMaintenance(true);
    };
    check();

    const sub = supabase.channel('app_settings').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_settings' }, (payload) => {
      setIsMaintenance(payload.new.is_maintenance);
    }).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  useEffect(() => {
    if (!user) return;
    const sub = supabase.channel('banners')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        if (payload.new.sender_id !== user.id) {
          setBanner({ text: payload.new.content });
          setTimeout(() => setBanner(null), 3000);
        }
      }).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [user]);

  if (isMaintenance) return (
    <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-[#0f1115] p-6 text-center">
      <div className="text-6xl mb-6">🛠️</div>
      <h1 className="text-3xl font-bold text-white mb-2">Технические работы</h1>
      <p className="text-gray-400 mb-8">Мы обновляем сервера. Скоро вернемся!</p>
      <button onClick={() => window.location.href = 'about:blank'} className="px-8 py-3 bg-red-500 text-white font-bold rounded-xl">Выйти из приложения</button>
    </div>
  );

  return (
    <AnimatePresence>
      {banner && (
        <motion.div initial={{ y: -100 }} animate={{ y: 20 }} exit={{ y: -100 }} className="fixed top-0 left-4 right-4 z-[9999] bg-[#1a1a1a] border border-white/10 p-4 rounded-2xl flex items-center shadow-2xl">
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white mr-3">✉️</div>
          <p className="text-white text-sm">{banner.text}</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function MessengerApp() {
  const { user, loading, needsEmailVerification } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('chats');
  const [openChat, setOpenChat] = useState<any | null>(null);
  const [openGroup, setOpenGroup] = useState<Group | null>(null);
  const [outgoingCall, setOutgoingCall] = useState<any | null>(null);
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null);
  
  // Стейт для создания поста
  const [showPostModal, setShowPostModal] = useState(false);
  const [postText, setPostText] = useState('');

  const handleCall = async (peer: Profile, callType: 'audio' | 'video') => {
    if (!user) return;
    const { data: chatId, error } = await supabase.rpc('create_chat_with_participants', { peer_id: peer.id });
    if (error) return alert("Ошибка звонка. Проверьте базу данных.");
    if (chatId) setOutgoingCall({ peer, callType, chatId });
  };

  const handleCreatePost = async () => {
    if (!postText.trim() || !user) return;
    await supabase.from('user_posts').insert({ user_id: user.id, content: postText });
    setPostText('');
    setShowPostModal(false);
  };

  if (loading) return <div className="min-h-screen bg-[#0f1115]" />;
  if (!user || needsEmailVerification) return <AuthScreen />;

  return (
    <div className="h-screen flex flex-col relative overflow-hidden bg-[#0f1115]">
      <GlobalManager />
      <IncomingCallModal />
      
      {outgoingCall && <OutgoingCallModal peer={outgoingCall.peer} callType={outgoingCall.callType} chatId={outgoingCall.chatId} onCancel={() => setOutgoingCall(null)} />}

      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {openChat ? (
            <motion.div key="chat" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="h-full absolute inset-0">
              <ChatView chatId={openChat.chatId} peer={openChat.peer} group={null} onBack={() => setOpenChat(null)} onCall={handleCall} />
            </motion.div>
          ) : openGroup ? (
            <motion.div key="group" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="h-full absolute inset-0">
              <ChatView chatId={null} peer={{}} group={openGroup} onBack={() => setOpenGroup(null)} onCall={handleCall} />
            </motion.div>
          ) : (
            <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full absolute inset-0">
              {activeTab === 'chats' && <ChatList onOpenChat={(chatId, peer) => setOpenChat({ chatId, peer })} onOpenGroup={setOpenGroup} />}
              {activeTab === 'search' && <SearchView onOpenChat={(chatId, peer) => setOpenChat({ chatId, peer })} onOpenGroup={setOpenGroup} onViewProfile={(p) => setViewingProfileId(p.id)} />}
              {activeTab === 'calls' && <CallsView />}
              {activeTab === 'settings' && <SettingsView onViewProfile={() => {}} />}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {!openChat && !openGroup && (
        <div className="flex-shrink-0 relative z-50 pb-2">
          <BottomNav active={activeTab} onChange={setActiveTab} onCreatePost={() => setShowPostModal(true)} />
        </div>
      )}

      <AnimatePresence>
        {viewingProfileId && <UserProfileModal profileId={viewingProfileId} onClose={() => setViewingProfileId(null)} />}
        
        {/* МОДАЛКА СОЗДАНИЯ ПОСТА */}
        {showPostModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ y: 50 }} animate={{ y: 0 }} className="w-full max-w-md bg-[#1a1a1a] p-6 rounded-3xl border border-white/10 shadow-2xl">
              <h2 className="text-xl font-bold text-white mb-4">Новый пост</h2>
              <textarea 
                value={postText} onChange={e => setPostText(e.target.value)} 
                placeholder="Что у вас нового?" 
                className="w-full h-32 p-3 bg-black/20 border border-white/10 rounded-xl text-white outline-none mb-4 resize-none"
              />
              <div className="flex gap-2">
                <button onClick={() => setShowPostModal(false)} className="flex-1 py-3 rounded-xl bg-white/10 text-white font-medium">Отмена</button>
                <button onClick={handleCreatePost} className="flex-1 py-3 rounded-xl bg-blue-500 text-white font-bold">Опубликовать</button>
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
      <ThemeProvider><LanguageProvider><AuthProvider><MessengerApp /></AuthProvider></LanguageProvider></ThemeProvider>
    </ErrorBoundary>
  );
}
