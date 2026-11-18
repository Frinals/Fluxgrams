import React, { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, Profile, Group, GroupType } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { BookmarkIcon, GroupIcon, ChannelIcon, PlusIcon } from '@/components/Icons';
import StoriesBar from '@/components/StoriesBar';

const AVATAR_RINGS = ['linear-gradient(135deg, #ff6b6b, #ee5a24)','linear-gradient(135deg, #4834d4, #686de0)','linear-gradient(135deg, #00d2d3, #54a0ff)','linear-gradient(135deg, #1abc9c, #2ecc71)','linear-gradient(135deg, #f39c12, #e74c3c)'];
function ringColor(id: string) { const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0); return AVATAR_RINGS[hash % AVATAR_RINGS.length]; }

export default function ChatList({ onOpenChat, onOpenGroup, onCreateGroup }: any) {
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const [chats, setChats] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [savedMessagesChatId, setSavedMessagesChatId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusText, setStatusText] = useState('Соединение...');
  const [showCreateMenu, setShowCreateMenu] = useState(false);

  useEffect(() => {
    if (!loading) return setStatusText('Flux');
    const t1 = setTimeout(() => setStatusText('Проверка чатов...'), 800);
    return () => { clearTimeout(t1); };
  }, [loading]);

  const loadChats = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: myChats } = await supabase.from('chats').select('*').or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);
    
    if (myChats && myChats.length > 0) {
      const peerIds = myChats.map((c) => c.user1_id === user.id ? c.user2_id : c.user1_id);
      const { data: peers } = await supabase.from('profiles').select('*').in('id', peerIds);
      
      const previews = myChats.map(chat => {
        const peer = peers?.find(p => p.id === (chat.user1_id === user.id ? chat.user2_id : chat.user1_id));
        return { ...chat, peer };
      }).filter(c => c.peer);
      setChats(previews);
    } else { setChats([]); }

    const { data: sChat } = await supabase.rpc('get_or_create_self_chat');
    if (sChat) setSavedMessagesChatId(sChat);

    setLoading(false);
  }, [user]);

  useEffect(() => { loadChats(); }, [loadChats]);

  return (
    <div className="flex flex-col h-full relative" style={{ background: 'var(--app-bg)' }}>
      <div className="sticky top-0 z-20 px-5 py-4 glass-nav border-b flex justify-between items-center" style={{ borderColor: 'var(--app-border-glass)' }}>
        <h2 className="text-[26px] font-bold tracking-tight" style={{ color: 'var(--app-text)' }}>{t('chats')}</h2>
        <span className="text-xs font-medium px-3 py-1 rounded-full bg-white/5 border border-white/10" style={{ color: loading ? 'var(--app-accent)' : 'var(--app-text-muted)' }}>{statusText}</span>
      </div>

      <div className="flex-1 overflow-y-auto pb-28">
        <StoriesBar />
        <div className="px-2 pt-2">
          {savedMessagesChatId && (
            <ListItem id="saved" fallbackIcon={<BookmarkIcon size={22} />} name="Избранное" message="..." onClick={() => onOpenChat(savedMessagesChatId, profile)} isSaved />
          )}
          {chats.map((c) => (
             <ListItem key={c.id} id={c.peer.id} avatarUrl={c.peer.avatar_url} fallbackText={(c.peer.display_name || '?').slice(0,2).toUpperCase()} name={c.peer.display_name || c.peer.username} message="Нажмите, чтобы открыть" onClick={() => onOpenChat(c.id, c.peer)} />
          ))}
        </div>
      </div>
      
      <div className="fixed bottom-[100px] right-5 z-30">
        <button onClick={() => setShowCreateMenu(!showCreateMenu)} className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg" style={{ background: 'var(--app-accent)', color: '#fff' }}><PlusIcon size={24} /></button>
      </div>
    </div>
  );
}

const ListItem = memo(function ListItem({ id, avatarUrl, fallbackIcon, fallbackText, name, message, onClick, isSaved }: any) {
  const ring = isSaved ? 'linear-gradient(135deg, var(--app-accent), #9b59b6)' : ringColor(id);
  return (
    <motion.button whileTap={{ scale: 0.98 }} onClick={onClick} className="w-full flex items-center gap-4 px-2 py-3 rounded-2xl hover:bg-white/5">
      <div className="relative flex-shrink-0">
        <div className="w-[50px] h-[50px] rounded-full p-[2px]" style={{ background: ring }}>
          {avatarUrl ? <img src={avatarUrl} className="w-full h-full rounded-full object-cover border-2" style={{ borderColor: 'var(--app-bg)' }} /> : <div className="w-full h-full rounded-full flex items-center justify-center font-semibold border-2" style={{ background: 'var(--app-surface)', color: 'var(--app-text)', borderColor: 'var(--app-bg)' }}>{fallbackIcon || fallbackText}</div>}
        </div>
      </div>
      <div className="flex-1 text-left min-w-0">
        <p className="font-semibold text-[16px] truncate" style={{ color: 'var(--app-text)' }}>{name}</p>
        <p className="text-[14px] truncate" style={{ color: 'var(--app-text-muted)' }}>{message}</p>
      </div>
    </motion.button>
  );
});
