import React, { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import AuthScreen from '@/components/AuthScreen';
import BottomNav, { Tab } from '@/components/BottomNav';
import ChatList from '@/components/ChatList';
import ChatView from '@/components/ChatView';
import SettingsView from '@/components/SettingsView';
import UserProfileModal from '@/components/UserProfileModal';

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

  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f1115', color: 'white', fontSize: '24px', fontWeight: 'bold' }}>
      Загрузка...
    </div>
  );

  if (!user || needsEmailVerification) return <AuthScreen />;

  return (
    <div className="h-screen flex flex-col bg-[#0f1115]">
      <div className="flex-1 relative overflow-hidden">
        {openChat ? (
          <ChatView chatId={openChat.chatId} peer={openChat.peer} group={null} onBack={() => setOpenChat(null)} onCall={() => alert('Звонки в разработке (скоро добавим!)')} />
        ) : (
          <>
            {activeTab === 'chats' && (
              <ChatList 
                onOpenChat={(chatId: string, peer: any) => setOpenChat({ chatId, peer })} 
                onOpenGroup={() => {}} 
                onViewProfile={(id: string) => setViewingProfileId(id)}
              />
            )}
            {activeTab === 'settings' && <SettingsView onViewProfile={(id: string) => setViewingProfileId(id)} />}
            {activeTab === 'search' && (
              <div className="h-full flex flex-col items-center justify-center text-white" style={{ background: 'var(--app-bg)' }}>
                <div className="text-6xl mb-4">🔍</div>
                <h2 className="text-xl font-bold mb-2">Поиск</h2>
                <p className="text-gray-400 text-sm">Скоро здесь можно будет искать людей</p>
              </div>
            )}
            {activeTab === 'calls' && (
              <div className="h-full flex flex-col items-center justify-center text-white" style={{ background: 'var(--app-bg)' }}>
                <div className="text-6xl mb-4">📞</div>
                <h2 className="text-xl font-bold mb-2">Звонки</h2>
                <p className="text-gray-400 text-sm">Скоро здесь появятся звонки</p>
              </div>
            )}
          </>
        )}
      </div>

      {!openChat && <BottomNav active={activeTab} onChange={setActiveTab} onCreatePost={() => {}} />}

      <AnimatePresence>
        {viewingProfileId && <UserProfileModal profileId={viewingProfileId} onClose={() => setViewingProfileId(null)} />}
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
