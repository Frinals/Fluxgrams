import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from './lib/supabaseClient'; // Проверь путь, если файл лежит в другом месте
import ChatList from './components/ChatList';
import ChatView from './components/ChatView';
import Profile from './components/Profile';
import Settings from './components/Settings';
import BottomNav from './components/BottomNav';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('chats');
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [refreshChats, setRefreshChats] = useState(0); // Триггер для обновления списка

  // 1. Следим за авторизацией
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else setProfile(null);
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  // 2. Загружаем профиль (чтобы ничего не сбрасывалось)
  const fetchProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) setProfile(data);
  };

  // Если нет сессии — показываем заглушку (в идеале тут должен быть экран логина)
  if (!session) {
    return <div className="flex h-screen items-center justify-center text-white">Загрузка или войдите в аккаунт...</div>;
  }

  return (
    <div className="flex flex-col h-screen bg-black text-white overflow-hidden relative">
      <div className="flex-1 overflow-hidden relative">
        {/* ЭКРАН ЧАТОВ ИЛИ КОНКРЕТНОГО ЧАТА */}
        {activeTab === 'chats' && (
          activeChatId ? (
            <ChatView 
              chatId={activeChatId} 
              profile={profile} 
              onBack={() => {
                setActiveChatId(null);
                setRefreshChats(prev => prev + 1); // Обновляем список при выходе из чата
              }} 
            />
          ) : (
            <ChatList 
              profile={profile} 
              refreshTrigger={refreshChats}
              onOpenChat={(id: string) => setActiveChatId(id)} 
            />
          )
        )}

        {/* ОСТАЛЬНЫЕ ВКЛАДКИ */}
        {activeTab === 'profile' && <Profile profile={profile} onUpdate={() => fetchProfile(session.user.id)} />}
        {activeTab === 'settings' && <Settings profile={profile} onUpdate={() => fetchProfile(session.user.id)} />}
      </div>

      {/* НИЖНЯЯ ПАНЕЛЬ (скрывается, когда мы внутри чата) */}
      {!activeChatId && (
        <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
      )}
    </div>
  );
}
