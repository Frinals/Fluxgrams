import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from './lib/supabase-client';

// Импорты твоих компонентов (если робот поругается на какую-то красную строку в импортах, 
// просто проверь, как точно называется этот файл в папке components)
import { ChatList } from './components/AppShell'; 
import { ChatView } from './components/ChatView';
import { SearchView } from './components/SearchView';
import { CallsView } from './components/CallsView';
import { SettingsView } from './components/SettingsView';
import { BottomNav } from './components/BottomNav';
import { CreateGroupModal } from './components/CreateModal';
import { IncomingCallModal } from './components/CallBanner';
import { OutgoingCallModal } from './components/CallScreen';
import { AuthScreen } from './components/AuthScreen'; // Если у тебя AuthScreen лежит в другом месте, поправь путь
import { ThemeProvider, LanguageProvider, AuthProvider, useAuth } from './providers';

const springTransition = { type: "spring", stiffness: 300, damping: 30 };

function MessengerApp() {
  const { user, loading, needsEmailVerification } = useAuth(); 
  
  const [activeTab, setActiveTab] = useState('chats');
  const [openChat, setOpenChat] = useState<{ chatId: string, peer: any } | null>(null);
  const [openGroup, setOpenGroup] = useState<any | null>(null);
  const [createModalType, setCreateModalType] = useState<'group' | 'channel' | null>(null);
  const [outgoingCall, setOutgoingCall] = useState<any>(null);
  
  // ФИКС: Ключ для принудительного обновления списка чатов
  const [refreshKey, setRefreshKey] = useState(0);

  const handleCall = (peer: any, callType: string, chatId: string) => {
    setOutgoingCall({ peer, callType, chatId });
  };

  const handleCreateGroup = (type: 'group' | 'channel') => {
    setCreateModalType(type);
  };

  const handleGroupCreated = (groupId: string, _groupName: string) => {
    setCreateModalType(null);
    supabase
      .from('groups')
      .select('*')
      .eq('id', groupId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (data && !error) {
          setOpenGroup(data);
          setRefreshKey(prev => prev + 1); // ФИКС: Обновляем список при создании группы
        }
      });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--app-bg-gradient)' }}>
        <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--app-border)', borderTopColor: 'transparent' }}></div>
      </div>
    );
  }

  if (!user || needsEmailVerification) {
    return <AuthScreen />;
  }

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: 'var(--app-bg-gradient)' }}>
      {/* Liquid background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="liquid-orb" style={{ background: 'var(--app-primary)', top: '-10%', left: '-10%' }}></div>
        <div className="liquid-orb" style={{ background: 'var(--app-secondary)', bottom: '-10%', right: '-10%' }}></div>
      </div>
      
      <IncomingCallModal />
      
      {outgoingCall && (
        <OutgoingCallModal
          peer={outgoingCall.peer}
          callType={outgoingCall.callType}
          chatId={outgoingCall.chatId}
          onCancel={() => setOutgoingCall(null)}
        />
      )}

      <div className="max-w-3xl mx-auto h-screen flex flex-col relative z-10">
        <div className="flex-1 overflow-hidden" style={{ paddingBottom: '80px' }}>
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
                    setRefreshKey(prev => prev + 1); // ФИКС: Обновляем список при выходе из чата
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
                  peer={{} as any}
                  group={openGroup}
                  onBack={() => {
                    setOpenGroup(null);
                    setRefreshKey(prev => prev + 1); // ФИКС: Обновляем список при выходе из группы
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
                    key={refreshKey} // ФИКС: Принудительный ререндер (обновление)
                    onOpenChat={(chatId: string, peer: any) => setOpenChat({ chatId, peer })}
                    onOpenGroup={(g: any) => setOpenGroup(g)}
                    onCreateGroup={handleCreateGroup}
                  />
                )}
                {activeTab === 'search' && (
                  <SearchView
                    onOpenChat={(chatId: string, peer: any) => setOpenChat({ chatId, peer })}
                    onOpenGroup={(g: any) => setOpenGroup(g)}
                  />
                )}
                {activeTab === 'calls' && <CallsView />}
                {activeTab === 'settings' && <SettingsView />}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Нижняя панель скрывается, когда мы в чате */}
        {!openChat && !openGroup && (
          <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
        )}

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
