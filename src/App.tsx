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

interface OutgoingCallState {
  peer: Profile;
  callType: 'audio' | 'video';
  chatId: string | null;
}

const springTransition = { type: 'spring' as const, stiffness: 400, damping: 30 };

function GlobalNotifications() {
  const { user } = useAuth();
  const [notif, setNotif] = useState<{ title: string; body: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel('global_banners')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` }, (payload) => {
        setNotif({ title: 'Новое сообщение', body: payload.new.content || 'Вложение' });
        setTimeout(() => setNotif(null), 4000); // Скрываем через 4 секунды
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  if (!notif) return null;

  return (
    <motion.div initial={{ y: -100, opacity: 0 }} animate={{ y: 20, opacity: 1 }} exit={{ y: -100, opacity: 0 }} className="fixed top-0 left-4 right-4 z-[999] glass-panel p-4 rounded-2xl flex items-center gap-3 shadow-2xl" style={{ borderColor: 'var(--app-accent)' }}>
      <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">F</div>
      <div className="flex-1">
        <p className="font-bold text-sm" style={{ color: 'var(--app-text)' }}>{notif.title}</p>
        <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>{notif.body}</p>
      </div>
    </motion.div>
  );
}

function MessengerApp() {
  const { user, loading, needsEmailVerification } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('chats');
  const [openChat, setOpenChat] = useState<{ chatId: string; peer: Profile } | null>(null);
  const [openGroup, setOpenGroup] = useState<Group | null>(null);
  const [outgoingCall, setOutgoingCall] = useState<OutgoingCallState | null>(null);
  const [createModalType, setCreateModalType] = useState<GroupType | null>(null);
  const [chatRefreshKey, setChatRefreshKey] = useState(0);

  const triggerChatRefresh = () => setChatRefreshKey(prev => prev + 1);

  useEffect(() => {
    if (!user) return;
    // Обновляем статус "В сети"
    const updateStatus = () => supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', user.id).then();
    updateStatus();
    const interval = setInterval(updateStatus, 60000);
    return () => clearInterval(interval);
  }, [user]);

  const handleCall = async (peer: Profile, callType: 'audio' | 'video') => {
    if (!user) return;
    const { data: chatId, error } = await supabase.rpc('create_chat_with_participants', { peer_id: peer.id });
    if (error || !chatId) return;
    setOutgoingCall({ peer, callType, chatId: chatId as string });
  };

  const handleCreateGroup = (type: GroupType) => setCreateModalType(type);

  const handleGroupCreated = (groupId: string, _groupName: string, _groupType: GroupType) => {
    setCreateModalType(null);
    supabase.from('groups').select('*').eq('id', groupId).maybeSingle().then(({ data }) => {
      if (data) { setOpenGroup(data as Group); triggerChatRefresh(); }
    });
  };

  if (loading) return <div className="min-h-screen" style={{ background: 'var(--app-bg)' }} />;
  if (!user || needsEmailVerification) return <AuthScreen />;

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: 'var(--app-bg)' }}>
      
      <GlobalNotifications /> {/* <--- БАННЕР УВЕДОМЛЕНИЙ */}
      
      <IncomingCallModal /> {/* <--- БАННЕР ВХОДЯЩЕГО ЗВОНКА */}
      
      {outgoingCall && (
        <OutgoingCallModal peer={outgoingCall.peer} callType={outgoingCall.callType} chatId={outgoingCall.chatId} onCancel={() => setOutgoingCall(null)} />
      )}
      
      <div className="max-w-3xl mx-auto h-screen flex flex-col">
        <div className="flex-1 overflow-hidden" style={{ paddingBottom: openChat || openGroup ? 0 : '5.5rem' }}>
          <AnimatePresence mode="wait">
            {openChat ? (
              <motion.div key="chat" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={springTransition} className="h-full">
                <ChatView chatId={openChat.chatId} peer={openChat.peer} group={null} onBack={() => { setOpenChat(null); triggerChatRefresh(); }} onCall={handleCall} />
              </motion.div>
            ) : openGroup ? (
              <motion.div key="group" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={springTransition} className="h-full">
                <ChatView chatId={null} peer={{} as Profile} group={openGroup} onBack={() => { setOpenGroup(null); triggerChatRefresh(); }} onCall={handleCall} />
              </motion.div>
            ) : (
              <motion.div key="tabs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={springTransition} className="h-full">
                {activeTab === 'chats' && <ChatList key={chatRefreshKey} onOpenChat={(chatId, peer) => setOpenChat({ chatId, peer })} onOpenGroup={(g) => setOpenGroup(g)} onCreateGroup={handleCreateGroup} />}
                {activeTab === 'search' && <SearchView onOpenChat={(chatId, peer) => setOpenChat({ chatId, peer })} onOpenGroup={(g) => setOpenGroup(g)} />}
                {activeTab === 'calls' && <CallsView />}
                {activeTab === 'settings' && <SettingsView />}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      {!openChat && !openGroup && <BottomNav active={activeTab} onChange={setActiveTab} />}
      <AnimatePresence>
        {createModalType && <CreateGroupModal type={createModalType} onClose={() => setCreateModalType(null)} onCreated={handleGroupCreated} />}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <MessengerApp />
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
