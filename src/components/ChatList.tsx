import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, Profile, Group, GroupType } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { BookmarkIcon, GroupIcon, ChannelIcon, PlusIcon } from '@/components/Icons';
import StoriesBar from '@/components/StoriesBar';

export default function ChatList({ onOpenChat, onOpenGroup, onCreateGroup }: any) {
  const { user, profile } = useAuth();
  const [chats, setChats] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [savedChatId, setSavedChatId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusText, setStatusText] = useState('Соединение...');
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (!loading) return setStatusText('Flux');
    const t1 = setTimeout(() => setStatusText('Проверка чатов...'), 800);
    const t2 = setTimeout(() => setStatusText('Обновление...'), 1600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [loading]);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    
    // Чаты
    const { data: myChats } = await supabase.from('chats').select('*').or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);
    if (myChats) {
      const peerIds = myChats.map(c => c.user1_id === user.id ? c.user2_id : c.user1_id);
      const { data: peers } = await supabase.from('profiles').select('*').in('id', peerIds);
      setChats(myChats.map(c => ({ ...c, peer: peers?.find(p => p.id === (c.user1_id === user.id ? c.user2_id : c.user1_id)) })));
    }

    // Группы
    const { data: myGroups } = await supabase.from('group_members').select('group_id').eq('user_id', user.id);
    if (myGroups) {
      const { data: gData } = await supabase.from('groups').select('*').in('id', myGroups.map(g => g.group_id));
      setGroups(gData || []);
    }

    // Избранное
    const { data: sChat } = await supabase.rpc('get_or_create_self_chat');
    if (sChat) setSavedChatId(sChat);

    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--app-bg)' }}>
      <div className="sticky top-0 z-20 px-5 py-4 glass-nav border-b flex justify-between items-center" style={{ borderColor: 'var(--app-border-glass)' }}>
        <h2 className="text-[26px] font-bold" style={{ color: 'var(--app-text)' }}>Чаты</h2>
        <span className="text-xs px-3 py-1 rounded-full bg-white/5 border border-white/10" style={{ color: 'var(--app-accent)' }}>{statusText}</span>
      </div>

      <div className="flex-1 overflow-y-auto pb-28">
        <StoriesBar />
        <div className="px-2">
          {chats.map((c) => (
             <div key={c.id} onClick={() => onOpenChat(c.id, c.peer)} className="flex items-center gap-4 p-3 hover:bg-white/5 rounded-2xl cursor-pointer">
               <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">{c.peer?.username?.slice(0,2).toUpperCase()}</div>
               <div><p className="font-bold" style={{ color: 'var(--app-text)' }}>{c.peer?.display_name || c.peer?.username}</p><p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>Нажмите, чтобы открыть</p></div>
             </div>
          ))}
        </div>
      </div>
      
      <div className="fixed bottom-[100px] right-5 z-30">
        <button onClick={() => setShowCreate(!showCreate)} className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg" style={{ background: 'var(--app-accent)', color: '#fff' }}><PlusIcon size={24} /></button>
      </div>
    </div>
  );
}
