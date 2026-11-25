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
import SearchView from '@/components/SearchView'; // <-- Наш новый поиск

function MessengerApp() {
  const { user, loading, needsEmailVerification } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('chats');
  const [openChat, setOpenChat] = useState<any>(null);
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null);

  if (loading) return <div className="h-[100dvh] flex items-center justify-center font-bold" style={{ background: 'var(--app-bg)', color: 'var(--app-text)' }}>Загрузка...</div>;
  if (!user || needsEmailVerification) return <AuthScreen />;

  return (
    <div className="h-[100dvh] flex flex-col" style={{ background: 'var(--app-bg)' }}>
      <div className="flex-1 relative overflow-hidden">
        {openChat ? (
          <ChatView 
            chatId={openChat.chatId} 
            peer={openChat.peer} 
            group={null} 
            onBack={() => setOpenChat(null)} 
            onCall={() => alert('Звонки в разработке')} 
            onViewProfile={(id: string) => setViewingProfileId(id)} // <-- Передаем открытие профиля
          />
        ) : (
          <>
            {activeTab === 'chats' && (
              <ChatList 
                onOpenChat={(chatId: string, peer: any) => setOpenChat({ chatId, peer })} 
                onViewProfile={(id: string) => setViewingProfileId(id)}
              />
            )}
            {activeTab === 'settings' && <SettingsView onViewProfile={(id: string) => setViewingProfileId(id)} />}
            
            {/* Наш рабочий поиск */}
            {activeTab === 'search' && (
              <SearchView 
                onOpenChat={(chatId: string, peer: any) => setOpenChat({ chatId, peer })} 
                onViewProfile={(id: string) => setViewingProfileId(id)}
              />
            )}
            
            {activeTab === 'calls' && (
              <div className="h-full flex flex-col items-center justify-center" style={{ color: 'var(--app-text)' }}>
                <div className="text-6xl mb-4">📞</div>
                <h2 className="text-xl font-bold">Звонки в разработке</h2>
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
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <MessengerApp />
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
