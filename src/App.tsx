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

const springTransition = { type: 'spring' as const, stiffness: 300, damping: 30 };

function MessengerApp() {
  const { user, loading, needsEmailVerification } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('chats');
  const [openChat, setOpenChat] = useState<{ chatId: string; peer: Profile } | null>(null);
  const [openGroup, setOpenGroup] = useState<Group | null>(null);
  const [outgoingCall, setOutgoingCall] = useState<OutgoingCallState | null>(null);
  const [createModalType, setCreateModalType] = useState<GroupType | null>(null);

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
    // Fetch the full group and open it
    supabase
      .from('groups')
      .select('*')
      .eq('id', groupId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (data && !error) {
          setOpenGroup(data as Group);
        }
      });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center"
           style={{ background: 'var(--app-bg-gradient)' }}>
        <div className="w-10 h-10 border-2 rounded-full animate-spin"
             style={{ borderColor: 'var(--app-border)', borderTopColor: 'var(--app-accent)' }} />
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
        <div className="liquid-orb" style={{ background: 'var(--app-accent)', width: 500, height: 500, top: '-10%', left: '-10%', opacity: 0.15 }} />
        <div className="liquid-orb" style={{ background: 'var(--app-glow)', width: 400, height: 400, top: '30%', right: '-15%', opacity: 0.12, animationDelay: '2s' }} />
        <div className="liquid-orb" style={{ background: 'var(--app-accent)', width: 350, height: 350, bottom: '-10%', left: '20%', opacity: 0.1, animationDelay: '4s' }} />
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
                  onBack={() => setOpenChat(null)}
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
                  onBack={() => setOpenGroup(null)}
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

      {/* Create Group/Channel Modal */}
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
