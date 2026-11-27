import React, { useState, useEffect, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { BookmarkIcon, GroupIcon, ChannelIcon, PlusIcon, TrashIcon } from '@/components/Icons';
import StoriesBar from '@/components/StoriesBar';
import SearchView from './SearchView';

export default function ChatList({ onOpenChat, onOpenGroup, onCreateGroup, onViewProfile }: any) {
  const { user, profile } = useAuth();
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [selectedChat, setSelectedChat] = useState<any | null>(null);

  const loadChats = useCallback(async () => {
    if (!user) return;
    try {
      const { data: myChats } = await supabase.from('chats').select('*').or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);
      
      if (myChats) {
        // СКРЫВАЕМ ТЕ, ЧТО УДАЛИЛИ У СЕБЯ
        const visibleChats = myChats.filter(c => !c.deleted_for?.includes(user.id));

        if (visibleChats.length > 0) {
          const peerIds = visibleChats.map((c) => c.user1_id === user.id ? c.user2_id : c.user1_id);
          const { data: peers } = await supabase.from('profiles').select('*').in('id', peerIds);
          const previews = visibleChats.map(chat => {
            const peer = peers?.find(p => p.id === (chat.user1_id === user.id ? chat.user2_id : chat.user1_id));
            return { ...chat, peer };
          }).filter(c => c.peer);
          setChats(previews);
        } else { setChats([]); }
      }
    } catch (error) { console.error(error); } 
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { loadChats(); }, [loadChats]);

  const deleteChatForMe = async () => {
    if (!selectedChat || !user) return;
    const currentDeletedFor = selectedChat.deleted_for || [];
    await supabase.from('chats').update({ deleted_for: [...currentDeletedFor, user.id] }).eq('id', selectedChat.id);
    setChats(prev => prev.filter(c => c.id !== selectedChat.id));
    setSelectedChat(null);
  };

  const deleteChatForEveryone = async () => {
    if (!selectedChat) return;
    // Просто удаляем чат из базы. Сообщения удалятся каскадом (если настроено) или останутся, но чат пропадет.
    await supabase.from('chats').delete().eq('id', selectedChat.id);
    setChats(prev => prev.filter(c => c.id !== selectedChat.id));
    setSelectedChat(null);
  };

  if (showSearch) {
    return (
      <div className="h-full relative" style={{ background: 'var(--app-bg)' }}>
        <button onClick={() => setShowSearch(false)} className="absolute top-4 left-4 z-50 liquid-glass px-4 py-2 rounded-full font-bold" style={{ color: 'var(--app-text)' }}>← Назад</button>
        <SearchView onOpenChat={onOpenChat} onViewProfile={onViewProfile} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full relative chat-bg-cobweb" style={{ background: 'var(--app-bg)' }}>
      <div className="sticky top-0 z-20 px-5 py-4 liquid-glass flex justify-between items-center">
        <h2 className="text-[26px] font-bold tracking-tight" style={{ color: 'var(--app-text)' }}>Чаты</h2>
        <button onClick={() => setShowSearch(true)} className="p-2 rounded-full liquid-glass text-lg" style={{ color: 'var(--app-text)' }}>🔍</button>
      </div>

      <div className="flex-1 overflow-y-auto pb-28 relative z-10">
        <StoriesBar />
        <div className="px-2 pt-2">
          {loading ? (
            <div className="flex justify-center p-10"><div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--app-accent)' }} /></div>
          ) : (
            chats.map((c) => (
              <div key={c.id} onContextMenu={(e) => { e.preventDefault(); setSelectedChat(c); }} onClick={() => onOpenChat(c.id, c.peer)} onTouchStart={(e) => {
                const timeout = setTimeout(() => setSelectedChat(c), 600); // Долгое нажатие
                e.currentTarget.addEventListener('touchend', () => clearTimeout(timeout), { once: true });
              }}>
                <ListItem 
                  id={c.peer.id} avatarUrl={c.peer.avatar_url} fallbackText={(c.peer.display_name || '?').slice(0,2).toUpperCase()} 
                  name={c.peer.display_name || c.peer.username} message="Нажмите, чтобы открыть" 
                />
              </div>
            ))
          )}
        </div>
      </div>

      {/* МЕНЮ УДАЛЕНИЯ ЧАТА */}
      <AnimatePresence>
        {selectedChat && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[999] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedChat(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="rounded-3xl p-2 w-full max-w-xs liquid-glass" onClick={e => e.stopPropagation()}>
              <button onClick={deleteChatForMe} className="w-full flex items-center gap-3 p-4 text-red-500 rounded-2xl hover:bg-white/5">
                <TrashIcon size={20} /> <span className="font-semibold">Удалить у себя</span>
              </button>
              <button onClick={deleteChatForEveryone} className="w-full flex items-center gap-3 p-4 text-red-600 rounded-2xl hover:bg-white/5">
                <TrashIcon size={20} /> <span className="font-semibold">Удалить у всех</span>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const ListItem = memo(function ListItem({ id, avatarUrl, fallbackText, name, message }: any) {
  return (
    <div className="w-full flex items-center gap-4 px-2 py-3 rounded-2xl hover:bg-white/5 transition-colors cursor-pointer">
      <div className="relative flex-shrink-0">
        <div className="w-[50px] h-[50px] rounded-full p-[2px]" style={{ background: 'var(--app-border)' }}>
          {avatarUrl ? <img src={avatarUrl} className="w-full h-full rounded-full object-cover border-2" style={{ borderColor: 'var(--app-bg)' }} /> : <div className="w-full h-full rounded-full flex items-center justify-center font-semibold border-2" style={{ background: 'var(--app-surface)', color: 'var(--app-text)', borderColor: 'var(--app-bg)' }}>{fallbackText || '?'}</div>}
        </div>
      </div>
      <div className="flex-1 text-left min-w-0">
        <p className="font-semibold text-[16px] truncate" style={{ color: 'var(--app-text)' }}>{name || 'Пользователь'}</p>
        <p className="text-[14px] truncate" style={{ color: 'var(--app-text-muted)' }}>{message || '...'}</p>
      </div>
    </div>
  );
});
