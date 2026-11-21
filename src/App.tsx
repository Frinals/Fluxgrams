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

const springTransition = { type: 'spring' as const, stiffness: 400, damping: 30 };

function GlobalManager() {
  const { user } = useAuth();
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [banner, setBanner] = useState<{ type: 'msg' | 'call', text: string } | null>(null);

  useEffect(() => {
    // Проверка режима обслуживания
    const checkMaintenance = async () => {
      const { data } = await supabase.from('app_settings').select('is_maintenance').eq('id', 1).single();
      if (data?.is_maintenance) setIsMaintenance(true);
    };
    checkMaintenance();

    // Слушаем изменения рубильника
    const settingsSub = supabase.channel('settings').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_settings' }, (payload) => {
      setIsMaintenance(payload.new.is_maintenance);
    }).subscribe();

    return () => { supabase.removeChannel(settingsSub); };
  }, []);

  useEffect(() => {
    if (!user) return;

    // Слушаем новые сообщения и звонки для баннеров
    const notifSub = supabase.channel('global_banners')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        if (payload.new && payload.new.sender_id !== user.id) {
          setBanner({ type: 'msg', text: payload.new.content || 'Вложение' });
          setTimeout(() => setBanner(null), 4000);
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'calls', filter: `receiver_id=eq.${user.id}` }, (payload) => {
        if (payload.new && payload.new.status === 'pending') {
          setBanner({ type: 'call', text: 'Входящий звонок...' });
          setTimeout(() => setBanner(null), 4000);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(notifSub); };
  }, [user]);

  if (isMaintenance) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center" style={{ background: 'var(--app-bg)' }}>
        <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mb-6">
           <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
        </div>
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--app-text)' }}>Технические работы</h1>
        <p className="text-base" style={{ color: 'var(--app-text-muted)' }}>Мы обновляем сервера. Пожалуйста, зайдите чуть позже.</p>
      </div>
    );
  }

  return (
    <>
      <AnimatePresence>
        {banner && (
          <motion.div initial={{ y: -100, opacity: 0 }} animate={{ y: 20, opacity: 1 }} exit={{ y: -100, opacity: 0 }} className="fixed top-0 left-4 right-4 z-[9999] glass-panel p-4 rounded-2xl flex items-center gap-3 shadow-2xl" style={{ borderColor: banner.type === 'call' ? '#2ecc71' : 'var(--app-accent)' }}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{ background: banner.type === 'call' ? '#2ecc71' : 'var(--app-accent)' }}>
              {banner.type === 'call' ? '📞' : '✉️'}
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm" style={{ color: 'var(--app-text)' }}>{banner.type === 'call' ? 'Звонок' : 'Новое сообщение'}</p>
              <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>{banner.text}</p>
            </div>
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
  const [openChat, setOpenChat] = useState<{ chatId: string; peer: Profile } | null>(null);
  const [openGroup, setOpenGroup] = useState<Group | null>(null);
  const [outgoingCall, setOutgoingCall] = useState<any | null>(null);
  const [createModalType, setCreateModalType] = useState<GroupType | null>(null);

  const handleCall = async (peer: Profile, callType: 'audio' | 'video') => {
    if (!user) return;
    const { data: chatId, error } = await supabase.rpc('create_chat_with_participants', { peer_id: peer.id });
    if (error || !chatId) return;
    setOutgoingCall({ peer, callType, chatId });
  };

  if (loading) return <div className="min-h-screen" style={{ background: 'var(--app-bg)' }} />;
  if (!user || needsEmailVerification) return <AuthScreen />;

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: 'var(--app-bg)' }}>
      <GlobalManager />
      
      {outgoingCall && <OutgoingCallModal peer={outgoingCall.peer} callType={outgoingCall.callType} chatId={outgoingCall.chatId} onCancel={() => setOutgoingCall(null)} />}
      
      <div className="max-w-3xl mx-auto h-screen flex flex-col">
        <div className="flex-1 overflow-hidden" style={{ paddingBottom: openChat || openGroup ? 0 : '5.5rem' }}>
          <AnimatePresence mode="wait">
            {openChat ? (
              <motion.div key="chat" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={springTransition} className="h-full">
                <ChatView chatId={openChat.chatId} peer={openChat.peer} group={null} onBack={() => setOpenChat(null)} onCall={handleCall} />
              </motion.div>
            ) : openGroup ? (
              <motion.div key="group" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={springTransition} className="h-full">
                <ChatView chatId={null} peer={{} as Profile} group={openGroup} onBack={() => setOpenGroup(null)} onCall={handleCall} />
              </motion.div>
            ) : (
              <motion.div key="tabs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={springTransition} className="h-full">
                {activeTab === 'chats' && <ChatList onOpenChat={(chatId, peer) => setOpenChat({ chatId, peer })} onOpenGroup={(g) => setOpenGroup(g)} onCreateGroup={setCreateModalType} />}
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
        {createModalType && <CreateGroupModal type={createModalType} onClose={() => setCreateModalType(null)} onCreated={() => setCreateModalType(null)} />}
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
