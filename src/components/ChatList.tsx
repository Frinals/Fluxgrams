import React, { useState, useEffect, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { BookmarkIcon, GroupIcon, ChannelIcon, PlusIcon } from '@/components/Icons';
import StoriesBar from '@/components/StoriesBar';
import SearchView from './SearchView';

export default function ChatList({ onOpenChat, onOpenGroup, onCreateGroup, onViewProfile }: any) {
  const { user, profile } = useAuth();
  const [chats, setChats] = useState<any[]>([]);
  const [savedMessagesChatId, setSavedMessagesChatId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const loadChats = useCallback(async () => {
    if (!user) return;
    try {
      const { data: myChats } = await supabase.from('chats').select('*').or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);
      
      if (myChats && myChats.length > 0) {
        const peerIds = myChats.map((c) => c.user1_id === user.id ? c.user2_id : c.user1_id);
        const { data: peers } = await supabase.from('profiles').select('*').in('id', peerIds);
        
        const previews = myChats.map(chat => {
          const peer = peers?.find(p => p.id === (chat.user1_id === user.id ? chat.user2_id : chat.user1_id));
          return { ...chat, peer };
        }).filter(c => c.peer);
        setChats(previews);
      } else { 
        setChats([]); 
      }

      const { data: sChat } = await supabase.rpc('get_or_create_self_chat');
      if (sChat) setSavedMessagesChatId(sChat);
    } catch (error) {
      console.error("Ошибка загрузки:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadChats(); }, [loadChats]);

  // Если открыт поиск, показываем его вместо списка чатов
  if (showSearch) {
    return (
      <div className="h-full relative" style={{ background: 'var(--app-bg)' }}>
        <button 
          onClick={() => setShowSearch(false)} 
          className="absolute top-4 left-4 z-50 liquid-glass px-4 py-2 rounded-full font-bold"
          style={{ color: 'var(--app-text)' }}
        >
          ← Назад
        </button>
        <SearchView onOpenChat={onOpenChat} onViewProfile={onViewProfile} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full relative chat-bg-cobweb" style={{ background: 'var(--app-bg)' }}>
      {/* Шапка с поиском и жидким стеклом */}
      <div className="sticky top-0 z-20 px-5 py-4 liquid-glass flex justify-between items-center">
        <h2 className="text-[26px] font-bold tracking-tight" style={{ color: 'var(--app-text)' }}>Чаты</h2>
        <button onClick={() => setShowSearch(true)} className="p-2 rounded-full liquid-glass text-lg" style={{ color: 'var(--app-text)' }}>
          🔍
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-28 relative z-10">
        <StoriesBar />
        <div className="px-2 pt-2">
          {loading ? (
            <div className="flex justify-center p-10"><div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--app-accent)' }} /></div>
          ) : (
            <>
              {savedMessagesChatId && (
                <ListItem id="saved" fallbackIcon={<BookmarkIcon size={22} />} name="Избранное" message="Личные заметки" onClick={() => onOpenChat(savedMessagesChatId, profile)} isSaved />
              )}
              {chats.map((c) => (
                 <ListItem 
                   key={c.id} 
                   id={c.peer.id} 
                   avatarUrl={c.peer.avatar_url} 
                   fallbackText={(c.peer.display_name || '?').slice(0,2).toUpperCase()} 
                   name={c.peer.display_name || c.peer.username} 
                   message="Нажмите, чтобы открыть" 
                   onClick={() => onOpenChat(c.id, c.peer)} 
                 />
              ))}
            </>
          )}
        </div>
      </div>
      
      <div className="fixed bottom-[100px] right-5 z-30">
        <motion.button whileTap={{ scale: 0.85 }} onClick={() => setShowCreateMenu(!showCreateMenu)} className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg liquid-glass" style={{ background: 'var(--app-accent)', color: '#fff' }}>
          <motion.div animate={{ rotate: showCreateMenu ? 45 : 0 }}><PlusIcon size={26} /></motion.div>
        </motion.button>
      </div>

      <AnimatePresence>
        {showCreateMenu && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-30" onClick={() => setShowCreateMenu(false)} />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="fixed bottom-40 right-5 z-40 rounded-3xl p-2 shadow-2xl liquid-glass">
              <button onClick={() => { setShowCreateMenu(false); onCreateGroup && onCreateGroup('group'); }} className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 transition-colors">
                <GroupIcon size={18} /><span className="font-medium text-sm" style={{ color: 'var(--app-text)' }}>Новая группа</span>
              </button>
              <button onClick={() => { setShowCreateMenu(false); onCreateGroup && onCreateGroup('channel'); }} className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 transition-colors">
                <ChannelIcon size={18} /><span className="font-medium text-sm" style={{ color: 'var(--app-text)' }}>Новый канал</span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

const ListItem = memo(function ListItem({ id, avatarUrl, fallbackIcon, fallbackText, name, message, onClick, isSaved }: any) {
  return (
    <motion.button whileTap={{ scale: 0.98 }} onClick={onClick} className="w-full flex items-center gap-4 px-2 py-3 rounded-2xl hover:bg-white/5 transition-colors">
      <div className="relative flex-shrink-0">
        <div className="w-[50px] h-[50px] rounded-full p-[2px]" style={{ background: isSaved ? 'var(--app-accent)' : 'var(--app-border)' }}>
          {avatarUrl ? <img src={avatarUrl} className="w-full h-full rounded-full object-cover border-2" style={{ borderColor: 'var(--app-bg)' }} /> : <div className="w-full h-full rounded-full flex items-center justify-center font-semibold border-2" style={{ background: 'var(--app-surface)', color: 'var(--app-text)', borderColor: 'var(--app-bg)' }}>{fallbackIcon || fallbackText || '?'}</div>}
        </div>
      </div>
      <div className="flex-1 text-left min-w-0">
        <p className="font-semibold text-[16px] truncate" style={{ color: 'var(--app-text)' }}>{name || 'Пользователь'}</p>
        <p className="text-[14px] truncate" style={{ color: 'var(--app-text-muted)' }}>{message || '...'}</p>
      </div>
    </motion.button>
  );
});
