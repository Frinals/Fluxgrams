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

function MessengerApp() {
  const { user, loading, needsEmailVerification } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('chats');
  const [openChat, setOpenChat] = useState<{ chatId: string; peer: Profile } | null>(null);
  const [openGroup, setOpenGroup] = useState<Group | null>(null);
  const [outgoingCall, setOutgoingCall] = useState<OutgoingCallState | null>(null);
  const [createModalType, setCreateModalType] = useState<GroupType | null>(null);

  // Ключ для принудительного обновления списка чатов
  const [chatRefreshKey, setChatRefreshKey] = useState(0);
  const triggerChatRefresh = () => setChatRefreshKey(prev => prev + 1);

  // ФИКС: Уведомления и запрос доступа к ним
  useEffect(() => {
    // Запрашиваем разрешение на уведомления при входе
    if ("Notification" in window && Notification.permission !== "granted") {
      Notification.requestPermission();
    }

    if (!user) return;

    // Слушаем новые сообщения для уведомлений
    const notifChannel = supabase.channel('global_notifications')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages', 
        filter: `receiver_id=eq.${user.id}` // Только те, что прислали ТЕБЕ
      }, (payload) => {
        // Если вкладка неактивна (свернута), показываем уведомление
        if (document.hidden && Notification.permission === "granted") {
          new Notification("Новое сообщение в Fluxgram!", {
            body: payload.new.content || "Отправил файл",
            icon: "/vite.svg" 
          });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(notifChannel); };
  }, [user]);

  const handleCall = async (peer: Profile, callType: 'audio' | 'video') => {
    if (!user) return;
    const { data: chatId, error } = await supabase.rpc('create_chat_with_participants', { peer_id: peer.id });
    if (error || !chatId) { console.error('[handleCall] Failed to create chat:', error); return; }
    setOutgoingCall({ peer, callType, chatId: chatId as string });
  };

  const handleCreateGroup = (type: GroupType) => {
    setCreateModalType(type);
  };

  const handleGroupCreated = (groupId: string, _groupName: string, _groupType: GroupType) => {
    setCreateModalType(null);
    supabase
      .from('groups')
      .select('*')
      .eq('id', groupId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (data && !error) {
          setOpenGroup(data as Group);
          triggerChatRefresh(); 
        }
      });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--app-bg)' }}>
        <div className="w-10 h-10 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--app-accent)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!user || needsEmailVerification) {
    return <AuthScreen />;
  }

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: 'var(--app-bg)' }}>
      
      {/* Глобальный обработчик входящих звонков */}
      <IncomingCallModal />

      {/* Модалка исходящего звонка */}
      {outgoingCall && (
        <OutgoingCallModal
          peer={outgoingCall.peer}
          callType={outgoingCall.callType}
          chatId={outgoingCall.chatId}
          onCancel={() => setOutgoingCall(null)}
        />
      )}

      <div className="max-w-3xl mx-auto h-screen flex flex-col">
        <div className="flex-1 overflow-hidden" style={{ paddingBottom: openChat || openGroup ? 0 : '5.5rem' }}>
          <AnimatePresence mode="wait">
            {openChat ? (
              <motion.div
                key="chat"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={springTransition}
                className="h-full"
              >
                <ChatView
                  chatId={openChat.chatId}
                  peer={openChat.peer}
                  group={null}
                  onBack={() => {
                    setOpenChat(null);
                    triggerChatRefresh();
                  }}
                  onCall={handleCall}
                />
              </motion.div>
            ) : openGroup ? (
              <motion.div
                key="group"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={springTransition}
                className="h-full"
              >
                <ChatView
                  chatId={null}
                  peer={{} as Profile}
                  group={openGroup}
                  onBack={() => {
                    setOpenGroup(null);
                    triggerChatRefresh();
                  }}
                  onCall={handleCall}
                />
              </motion.div>
            ) : (
              <motion.div
                key="tabs"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={springTransition}
                className="h-full"
              >
                {activeTab === 'chats' && (
                  <ChatList
                    key={chatRefreshKey} 
                    onOpenChat={(chatId, peer) => setOpenChat({ chatId, peer })}
                    onOpenGroup={(g) => setOpenGroup(g)}
                    onCreateGroup={handleCreateGroup}
                  />
                )}
                {activeTab === 'search' && (
                  <SearchView
                    onOpenChat={(chatId, peer) => setOpenChat({ chatId, peer })}
                    onOpenGroup={(g) => setOpenGroup(g)}
                  />
                )}
                {activeTab === 'calls' && <CallsView />}
                {activeTab === 'settings' && <SettingsView />}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {!openChat && !openGroup && <BottomNav active={activeTab} onChange={setActiveTab} />}

      <AnimatePresence>
        {createModalType && (
          <CreateGroupModal
            type={createModalType}
            onClose={() => setCreateModalType(null)}
            onCreated={handleGroupCreated}
          />
        )}
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
