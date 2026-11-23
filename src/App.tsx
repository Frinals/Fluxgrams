import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { supabase, Profile, Group, GroupType } from '@/lib/supabase';
import AuthScreen from '@/components/AuthScreen';
import BottomNav, { Tab } from '@/components/BottomNav';
import ChatList from '@/components/ChatList';
import ChatView from '@/components/ChatView';
import CallsView from '@/components/CallsView';
import SearchView from '@/components/SearchView';
import SettingsView from '@/components/SettingsView';
import IncomingCallModal from '@/components/IncomingCallModal';
import OutgoingCallModal from '@/components/OutgoingCallModal';
import { CreateGroupModal } from '@/components/CreateGroupModal';
import UserProfileModal from '@/components/UserProfileModal';

interface OutgoingCallState { peer: Profile; callType: 'audio' | 'video'; chatId: string | null; }
const springTransition = { type: 'spring' as const, stiffness: 400, damping: 30 };

function GlobalManager() {
  const { user } = useAuth();
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [localBanner, setLocalBanner] = useState<{title: string, text: string} | null>(null);

  useEffect(() => {
    // 1. РЕГИСТРАЦИЯ SERVICE WORKER ДЛЯ УВЕДОМЛЕНИЙ
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error);
    }
    
    // 2. ЗАПРОС РАЗРЕШЕНИЯ
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    // 3. ПРОВЕРКА РУБИЛЬНИКА
    const checkMaintenance = async () => {
      const { data } = await supabase.from('app_settings').select('is_maintenance').eq('id', 1).single();
      if (data?.is_maintenance) setIsMaintenance(true);
    };
    checkMaintenance();
  }, []);

  useEffect(() => {
    if (!user) return;
    // Слушаем сообщения
    const notifSub = supabase.channel('global_banners')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        if (payload.new && payload.new.sender_id !== user.id) {
          const text = payload.new.content || 'Вложение';
          
          // Показываем баннер внутри приложения
          setLocalBanner({ title: 'Новое сообщение', text });
          setTimeout(() => setLocalBanner(null), 4000);

          // Показываем уведомление на телефоне (если вкладка не активна)
          if (document.hidden && Notification.permission === 'granted') {
             new Notification('Новое сообщение в Fluxgram!', { body: text, icon: '/vite.svg' });
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(notifSub); };
  }, [user]);

  if (isMaintenance) return <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-[#0f1115] text-white">Технические работы</div>;

  return (
    <>
      <AnimatePresence>
        {localBanner && (
          <motion.div initial={{ y: -100 }} animate={{ y: 20 }} exit={{ y: -100 }} className="fixed top-0 left-4 right-4 z-[9999] bg-[#1a1a1a] border border-white/10 p-4 rounded-2xl flex items-center gap-3 shadow-2xl">
            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white">✉️</div>
            <div><p className="text-white font-bold text-sm">{localBanner.title}</p><p className="text-gray-400 text-xs">{localBanner.text}</p></div>
          </motion.div>
        )}
      </AnimatePresence>
      <IncomingCallModal />
    </>
  );
}

function MessengerApp() {
  const { user, loading, needsEmailVerification } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('chats');
  const [openChat, setOpenChat] = useState<any | null>(null);
  const [openGroup, setOpenGroup] = useState<Group | null>(null);
  const [outgoingCall, setOutgoingCall] = useState<OutgoingCallState | null>(null);
  const [createModalType, setCreateModalType] = useState<GroupType | null>(null);
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null);

  const handleCall = async (peer: Profile, callType: 'audio' | 'video') => {
    if (!user) return;
    const { data: chatId } = await supabase.rpc('create_chat_with_participants', { peer_id: peer.id });
    if (chatId) setOutgoingCall({ peer, callType, chatId });
  };

  if (loading) return <div className="min-h-screen bg-[#0f1115]" />;
  if (!user || needsEmailVerification) return <AuthScreen />;

  return (
    <div className="h-screen flex flex-col relative overflow-hidden bg-[#0f1115]">
      <GlobalManager />
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
              {activeTab === 'chats' && <ChatList onOpenChat={(chatId, peer) => setOpenChat({ chatId, peer })} onOpenGroup={setOpenGroup} onCreateGroup={setCreateModalType} />}
              {activeTab === 'search' && <SearchView onOpenChat={(chatId, peer) => setOpenChat({ chatId, peer })} onOpenGroup={setOpenGroup} onViewProfile={(p) => setViewingProfileId(p.id)} />}
              {activeTab === 'calls' && <CallsView />}
              {activeTab === 'settings' && <SettingsView />}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {!openChat && !openGroup && <div className="flex-shrink-0 relative z-50"><BottomNav active={activeTab} onChange={setActiveTab} /></div>}
      
      <AnimatePresence>
        {createModalType && <CreateGroupModal type={createModalType} onClose={() => setCreateModalType(null)} onCreated={() => setCreateModalType(null)} />}
        {viewingProfileId && <UserProfileModal profileId={viewingProfileId} onClose={() => setViewingProfileId(null)} onStartChat={(p) => { setViewingProfileId(null); handleCall(p, 'audio'); }} onCall={(p, t) => { setViewingProfileId(null); handleCall(p, t); }} />}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider><LanguageProvider><AuthProvider><MessengerApp /></AuthProvider></LanguageProvider></ThemeProvider>
  );
}
