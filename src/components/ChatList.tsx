import React, { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, Profile, Group, GroupType } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { BookmarkIcon, GroupIcon, ChannelIcon, PlusIcon } from '@/components/Icons';
import StoriesBar from '@/components/StoriesBar';

interface ChatPreview { chat_id: string; peer: Profile; last_message: string | null; last_time: string | null; unread_count: number; }
interface GroupPreview { group: Group; last_message: string | null; last_time: string | null; unread_count: number; }
interface Props { onOpenChat: (chatId: string, peer: Profile) => void; onOpenGroup: (group: Group) => void; onCreateGroup: (type: GroupType) => void; }

const AVATAR_RINGS = ['linear-gradient(135deg, #ff6b6b, #ee5a24)','linear-gradient(135deg, #4834d4, #686de0)','linear-gradient(135deg, #00d2d3, #54a0ff)','linear-gradient(135deg, #1abc9c, #2ecc71)','linear-gradient(135deg, #f39c12, #e74c3c)','linear-gradient(135deg, #9b59b6, #e056fd)'];
function ringColor(id: string) { const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0); return AVATAR_RINGS[hash % AVATAR_RINGS.length]; }

export default function ChatList({ onOpenChat, onOpenGroup, onCreateGroup }: Props) {
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [groups, setGroups] = useState<GroupPreview[]>([]);
  const [savedMessagesChatId, setSavedMessagesChatId] = useState<string | null>(null);
  const [savedLastMessage, setSavedLastMessage] = useState<string | null>(null);
  const [savedLastTime, setSavedLastTime] = useState<string | null>(null);
  
  // Статус загрузки
  const [loading, setLoading] = useState(true);
  const [statusText, setStatusText] = useState('Устанавливаем соединение...');
  const [showCreateMenu, setShowCreateMenu] = useState(false);

  // Логика смены текста при загрузке
  useEffect(() => {
    if (!loading) {
      setStatusText('Flux');
      return;
    }
    setStatusText('Устанавливаем соединение...');
    const t1 = setTimeout(() => setStatusText('Проверяем чаты...'), 800);
    const t2 = setTimeout(() => setStatusText('Обновление...'), 1600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [loading]);

  const ensureSavedMessagesChat = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.rpc('get_or_create_self_chat');
    if (data) setSavedMessagesChatId(data as string);
  }, [user]);

  const loadSavedMessagesPreview = useCallback(async () => {
    if (!savedMessagesChatId) return;
    const { data: lastMsg } = await supabase.from('messages').select('content, created_at').eq('chat_id', savedMessagesChatId).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (lastMsg) { setSavedLastMessage(lastMsg.content); setSavedLastTime(lastMsg.created_at); }
  }, [savedMessagesChatId]);

  const loadChats = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data: myChats } = await supabase.from('chats').select('*').or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);
    if (myChats && myChats.length > 0) {
      const chatIds = myChats.map((c) => c.id);
      const peerIds = myChats.map((c) => c.user1_id === user.id ? c.user2_id : c.user1_id);
      const { data: peerProfiles } = await supabase.from('profiles').select('*').in('id', peerIds);
      const peerMap = new Map<string, Profile>();
      if (peerProfiles) peerProfiles.forEach(p => peerMap.set(p.id, p as Profile));

      const { data: allMessages } = await supabase.from('messages').select('chat_id, content, sender_id, created_at').in('chat_id', chatIds).order('created_at', { ascending: false });
      const lastMsgMap = new Map<string, any>();
      if (allMessages) allMessages.forEach(m => { if (!lastMsgMap.has(m.chat_id)) lastMsgMap.set(m.chat_id, m); });

      const previews: ChatPreview[] = [];
      myChats.forEach(chat => {
        const peerId = chat.user1_id === user.id ? chat.user2_id : chat.user1_id;
        const peer = peerMap.get(peerId);
        if (!peer) return;
        const lastMsg = lastMsgMap.get(chat.id);
        let lastMessage = lastMsg?.content ? (lastMsg.content.startsWith('enc:') ? '🔒 Зашифровано' : lastMsg.content) : null;
        previews.push({ chat_id: chat.id, peer, last_message: lastMessage, last_time: lastMsg?.created_at ?? null, unread_count: 0 });
      });
      previews.sort((a, b) => (!a.last_time ? 1 : !b.last_time ? -1 : new Date(b.last_time).getTime() - new Date(a.last_time).getTime()));
      setChats(previews);
    } else { setChats([]); }

    const { data: myGroups } = await supabase.from('group_members').select('group_id').eq('user_id', user.id);
    if (myGroups && myGroups.length > 0) {
      const { data: groupData } = await supabase.from('groups').select('*').in('id', myGroups.map(g => g.group_id));
      if (groupData) setGroups(groupData.map(g => ({ group: g as Group, last_message: 'Группа', last_time: g.created_at, unread_count: 0 })));
    } else { setGroups([]); }
    
    setLoading(false);
  }, [user]);

  useEffect(() => { ensureSavedMessagesChat().then(loadChats); }, [ensureSavedMessagesChat, loadChats]);
  useEffect(() => { loadSavedMessagesPreview(); }, [loadSavedMessagesPreview]);

  const allItems = useMemo(() => [...chats, ...groups].sort((a, b) => {
    const aT = 'last_time' in a ? a.last_time : null; const bT = 'last_time' in b ? b.last_time : null;
    return (!aT ? 1 : !bT ? -1 : new Date(bT).getTime() - new Date(aT).getTime());
  }), [chats, groups]);

  return (
    <div className="flex flex-col h-full relative" style={{ background: 'var(--app-bg)' }}>
      <div className="sticky top-0 z-20 px-5 py-4 glass-nav border-b flex items-center justify-between" style={{ borderColor: 'var(--app-border-glass)' }}>
        <h2 className="text-[26px] font-bold tracking-tight" style={{ color: 'var(--app-text)' }}>{t('chats')}</h2>
        {/* ТЕКСТ СТАТУСА СВЕРХУ */}
        <span className="text-xs font-medium px-3 py-1 rounded-full bg-white/5 border border-white/10" style={{ color: loading ? 'var(--app-accent)' : 'var(--app-text-muted)' }}>
          {statusText}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto scroll-smooth-touch pb-28">
        <StoriesBar />
        <div className="px-2 pt-2">
          {savedMessagesChatId && (
            <ListItem id="saved" fallbackIcon={<BookmarkIcon size={22} />} name={t('savedMessages')} message={savedLastMessage || '...'} time="" unread={0} onClick={() => profile && onOpenChat(savedMessagesChatId, profile)} isSaved />
          )}
          {allItems.map((item) => {
            if ('group' in item) {
              return <ListItem key={`g-${item.group.id}`} id={item.group.id} fallbackIcon={<GroupIcon size={22} />} name={item.group.name} message={item.last_message || '...'} time="" unread={item.unread_count} onClick={() => onOpenGroup(item.group)} />;
            }
            return <ListItem key={`c-${item.chat_id}`} id={item.peer.id} avatarUrl={item.peer.avatar_url || undefined} fallbackText={(item.peer.display_name || '?').slice(0, 2).toUpperCase()} name={item.peer.display_name || 'User'} message={item.last_message || '...'} time="" unread={item.unread_count} onClick={() => onOpenChat(item.chat_id, item.peer)} />;
          })}
        </div>
      </div>

      <div className="fixed bottom-[100px] right-5 z-30 pointer-events-none">
        <motion.button whileTap={{ scale: 0.85 }} onClick={() => setShowCreateMenu(!showCreateMenu)} className="w-[56px] h-[56px] rounded-full flex items-center justify-center pointer-events-auto shadow-lg" style={{ background: 'var(--app-accent-gradient)', color: '#fff' }}>
          <motion.div animate={{ rotate: showCreateMenu ? 45 : 0 }}><PlusIcon size={28} /></motion.div>
        </motion.button>
      </div>
      <AnimatePresence>
        {showCreateMenu && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-30" onClick={() => setShowCreateMenu(false)} />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="fixed bottom-[170px] right-5 z-40 rounded-3xl p-2 shadow-2xl border glass-panel" style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
              <button onClick={() => { setShowCreateMenu(false); onCreateGroup('group'); }} className="w-full flex items-center gap-3 p-3 rounded-2xl"><GroupIcon size={18} /><span className="font-medium text-sm">Группа</span></button>
              <button onClick={() => { setShowCreateMenu(false); onCreateGroup('channel'); }} className="w-full flex items-center gap-3 p-3 rounded-2xl"><ChannelIcon size={18} /><span className="font-medium text-sm">Канал</span></button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

const ListItem = memo(function ListItem({ id, avatarUrl, fallbackIcon, fallbackText, name, message, time, unread, onClick, isSaved }: any) {
  const ring = isSaved ? 'linear-gradient(135deg, var(--app-accent), #9b59b6)' : ringColor(id);
  return (
    <motion.button whileTap={{ scale: 0.98 }} onClick={onClick} className="w-full flex items-center gap-4 px-2 py-3 rounded-2xl hover:bg-white/5 transition-colors">
      <div className="relative flex-shrink-0">
        <div className="w-[50px] h-[50px] rounded-full p-[2px]" style={{ background: ring }}>
          {avatarUrl ? <img src={avatarUrl} className="w-full h-full rounded-full object-cover border-2" style={{ borderColor: 'var(--app-bg)' }} /> : <div className="w-full h-full rounded-full flex items-center justify-center font-semibold border-2" style={{ background: 'var(--app-surface)', color: 'var(--app-text)', borderColor: 'var(--app-bg)' }}>{fallbackIcon || fallbackText}</div>}
        </div>
      </div>
      <div className="flex-1 text-left min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <p className="font-semibold text-[16px] truncate" style={{ color: 'var(--app-text)' }}>{name}</p>
        </div>
        <p className="text-[14px] truncate" style={{ color: 'var(--app-text-muted)' }}>{message}</p>
      </div>
    </motion.button>
  );
});
