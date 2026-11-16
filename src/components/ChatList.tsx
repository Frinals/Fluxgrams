import React, { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, Profile, Group, GroupType } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { BookmarkIcon, GroupIcon, ChannelIcon, PlusIcon } from '@/components/Icons';
import StoriesBar from '@/components/StoriesBar';

interface ChatPreview {
  chat_id: string;
  peer: Profile;
  last_message: string | null;
  last_time: string | null;
  unread_count: number;
}

interface GroupPreview {
  group: Group;
  last_message: string | null;
  last_time: string | null;
  unread_count: number;
}

interface Props {
  onOpenChat: (chatId: string, peer: Profile) => void;
  onOpenGroup: (group: Group) => void;
  onCreateGroup: (type: GroupType) => void;
}

const AVATAR_RINGS = [
  'linear-gradient(135deg, #ff6b6b, #ee5a24)',
  'linear-gradient(135deg, #4834d4, #686de0)',
  'linear-gradient(135deg, #00d2d3, #54a0ff)',
  'linear-gradient(135deg, #1abc9c, #2ecc71)',
  'linear-gradient(135deg, #f39c12, #e74c3c)',
  'linear-gradient(135deg, #9b59b6, #e056fd)',
];

function ringColor(id: string) {
  const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_RINGS[hash % AVATAR_RINGS.length];
}

export default function ChatList({ onOpenChat, onOpenGroup, onCreateGroup }: Props) {
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [groups, setGroups] = useState<GroupPreview[]>([]);
  const [savedMessagesChatId, setSavedMessagesChatId] = useState<string | null>(null);
  const [savedLastMessage, setSavedLastMessage] = useState<string | null>(null);
  const [savedLastTime, setSavedLastTime] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateMenu, setShowCreateMenu] = useState(false);

  const ensureSavedMessagesChat = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase.rpc('get_or_create_self_chat');
    if (error) { console.error('[SavedMessages] Failed:', error); return; }
    if (data) setSavedMessagesChatId(data as string);
  }, [user]);

  const loadSavedMessagesPreview = useCallback(async () => {
    if (!savedMessagesChatId) return;
    const { data: lastMsg } = await supabase
      .from('messages')
      .select('content, media_type, created_at')
      .eq('chat_id', savedMessagesChatId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastMsg) {
      let msg: string | null = lastMsg.content;
      if (!msg) {
        if (lastMsg.media_type === 'image') msg = `[${t('photo')}]`;
        else if (lastMsg.media_type === 'video') msg = `[${t('video')}]`;
        else if (lastMsg.media_type === 'audio') msg = `[${t('audio')}]`;
      }
      setSavedLastMessage(msg);
      setSavedLastTime(lastMsg.created_at);
    } else {
      setSavedLastMessage(null);
      setSavedLastTime(null);
    }
  }, [savedMessagesChatId, t]);

  const loadChats = useCallback(async () => {
    if (!user) return;

    const { data: myChats, error: chatsError } = await supabase
      .from('chats')
      .select('*')
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

    if (chatsError || !myChats || myChats.length === 0) {
      setChats([]);
    } else {
      const chatIds = myChats.map((c) => c.id);
      const peerIds = myChats.map((c) => c.user1_id === user.id ? c.user2_id : c.user1_id);

      const { data: peerProfiles } = await supabase.from('profiles').select('*').in('id', peerIds);
      const peerMap = new Map<string, Profile>();
      if (peerProfiles) {
        for (const p of peerProfiles) peerMap.set(p.id, p as Profile);
      }

      const { data: allMessages } = await supabase
        .from('messages')
        .select('chat_id, content, media_type, sender_id, created_at')
        .in('chat_id', chatIds)
        .order('created_at', { ascending: false });

      const lastMsgMap = new Map<string, { content: string | null; media_type: string | null; created_at: string }>();
      const unreadMap = new Map<string, number>();
      
      if (allMessages) {
        for (const m of allMessages) {
          if (!lastMsgMap.has(m.chat_id)) {
            lastMsgMap.set(m.chat_id, { content: m.content, media_type: m.media_type, created_at: m.created_at });
          }
          if (m.sender_id !== user.id) {
            unreadMap.set(m.chat_id, (unreadMap.get(m.chat_id) ?? 0) + 1);
          }
        }
      }

      const previews: ChatPreview[] = [];
      for (const chat of myChats) {
        const peerId = chat.user1_id === user.id ? chat.user2_id : chat.user1_id;
        const peer = peerMap.get(peerId);
        if (!peer) continue;

        const lastMsg = lastMsgMap.get(chat.id);
        let lastMessage: string | null = null;
        
        if (lastMsg) {
          if (lastMsg.content) {
            lastMessage = lastMsg.content.startsWith('enc:') ? '🔒 Зашифровано' : lastMsg.content;
          } else if (lastMsg.media_type === 'image') lastMessage = `[Фото]`;
          else if (lastMsg.media_type === 'video') lastMessage = `[Видео]`;
          else if (lastMsg.media_type === 'audio') lastMessage = `[Аудио]`;
        }

        previews.push({
          chat_id: chat.id,
          peer,
          last_message: lastMessage,
          last_time: lastMsg?.created_at ?? null,
          unread_count: unreadMap.get(chat.id) ?? 0,
        });
      }

      previews.sort((a, b) => {
        if (!a.last_time) return 1;
        if (!b.last_time) return -1;
        return new Date(b.last_time).getTime() - new Date(a.last_time).getTime();
      });

      setChats(previews);
    }

    // --- Загрузка групп ---
    const { data: myGroups } = await supabase.from('group_members').select('group_id').eq('user_id', user.id);

    if (myGroups && myGroups.length > 0) {
      const groupIds = myGroups.map((g) => g.group_id);
      const { data: groupData } = await supabase.from('groups').select('*').in('id', groupIds);

      if (groupData && groupData.length > 0) {
        const { data: groupMessages } = await supabase
          .from('messages')
          .select('group_id, content, media_type, sender_id, created_at')
          .in('group_id', groupIds)
          .order('created_at', { ascending: false });

        const groupLastMsg = new Map<string, { content: string | null; media_type: string | null; created_at: string }>();
        const groupUnread = new Map<string, number>();
        
        if (groupMessages) {
          for (const m of groupMessages) {
            if (!groupLastMsg.has(m.group_id)) {
              groupLastMsg.set(m.group_id, { content: m.content, media_type: m.media_type, created_at: m.created_at });
            }
            if (m.sender_id !== user.id) {
              groupUnread.set(m.group_id, (groupUnread.get(m.group_id) ?? 0) + 1);
            }
          }
        }

        const groupPreviews: GroupPreview[] = groupData.map((g) => {
          const lastMsg = groupLastMsg.get(g.id);
          let lastMessage: string | null = null;
          if (lastMsg) {
            if (lastMsg.content) lastMessage = lastMsg.content.startsWith('enc:') ? '🔒 Зашифровано' : lastMsg.content;
            else if (lastMsg.media_type === 'image') lastMessage = `[Фото]`;
            else if (lastMsg.media_type === 'video') lastMessage = `[Видео]`;
            else if (lastMsg.media_type === 'audio') lastMessage = `[Аудио]`;
          }
          return {
            group: g as Group,
            last_message: lastMessage,
            last_time: lastMsg?.created_at ?? null,
            unread_count: groupUnread.get(g.id) ?? 0,
          };
        });

        groupPreviews.sort((a, b) => {
          if (!a.last_time) return 1;
          if (!b.last_time) return -1;
          return new Date(b.last_time).getTime() - new Date(a.last_time).getTime();
        });

        setGroups(groupPreviews);
      } else {
        setGroups([]);
      }
    } else {
      setGroups([]);
    }

    setLoading(false);
  }, [user, t]);

  useEffect(() => {
    ensureSavedMessagesChat().then(() => { loadChats(); });
  }, [ensureSavedMessagesChat, loadChats]);

  useEffect(() => { loadSavedMessagesPreview(); }, [loadSavedMessagesPreview]);

  // Realtime
  const loadChatsRef = useRef(loadChats);
  const loadSavedRef = useRef(loadSavedMessagesPreview);
  loadChatsRef.current = loadChats;
  loadSavedRef.current = loadSavedMessagesPreview;

  useEffect(() => {
    const channel = supabase
      .channel(`chat_list_updates:${user?.id ?? 'guest'}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const record = payload.new as { chat_id?: string | null; group_id?: string | null };
        loadChatsRef.current();
        if (record.chat_id === savedMessagesChatId) loadSavedRef.current();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chats' }, () => {
        loadChatsRef.current();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_members', filter: `user_id=eq.${user?.id ?? ''}` }, () => {
        loadChatsRef.current();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, savedMessagesChatId]);

  const openSavedMessages = () => {
    if (!savedMessagesChatId || !profile) return;
    onOpenChat(savedMessagesChatId, profile);
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const allItems = useMemo<(ChatPreview | GroupPreview)[]>(() => {
    return [...chats, ...groups].sort((a, b) => {
      const aTime = 'last_time' in a ? a.last_time : null;
      const bTime = 'last_time' in b ? b.last_time : null;
      if (!aTime) return 1;
      if (!bTime) return -1;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
  }, [chats, groups]);

  return (
    <div className="flex flex-col h-full relative" style={{ background: 'var(--app-bg)' }}>
      
      <div className="sticky top-0 z-20 px-5 py-4 glass-nav border-b" style={{ borderColor: 'var(--app-border-glass)' }}>
        <h2 className="text-[26px] font-bold tracking-tight" style={{ color: 'var(--app-text)' }}>{t('chats')}</h2>
      </div>

      <div className="flex-1 overflow-y-auto scroll-smooth-touch pb-28 will-change-scroll">
        <StoriesBar />

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-2 rounded-full animate-spin border-t-transparent" style={{ borderColor: 'var(--app-accent)' }} />
          </div>
        ) : (
          <div className="px-2 pt-2">
            {savedMessagesChatId && (
              <ListItem
                id="saved"
                avatarUrl={profile?.avatar_url || undefined}
                fallbackIcon={<BookmarkIcon size={22} />}
                name={t('savedMessages')}
                message={savedLastMessage || '...'}
                time={formatTime(savedLastTime)}
                unread={0}
                onClick={openSavedMessages}
                isSavedMessages
              />
            )}

            {allItems.length === 0 && !savedMessagesChatId ? (
              <div className="flex flex-col items-center justify-center h-64 p-8 text-center opacity-50">
                <p className="text-base font-medium" style={{ color: 'var(--app-text)' }}>{t('noChats')}</p>
              </div>
            ) : (
              allItems.map((item) => {
                if ('group' in item) {
                  const g = item.group;
                  return (
                    <ListItem
                      key={`g-${g.id}`}
                      id={g.id}
                      avatarUrl={g.avatar_url || undefined}
                      fallbackIcon={g.type === 'channel' ? <ChannelIcon size={22} /> : <GroupIcon size={22} />}
                      name={g.name}
                      message={item.last_message || g.description || '...'}
                      time={formatTime(item.last_time)}
                      unread={item.unread_count}
                      onClick={() => onOpenGroup(g)}
                    />
                  );
                }
                const chat = item;
                return (
                  <ListItem
                    key={`c-${chat.chat_id}`}
                    id={chat.peer.id}
                    avatarUrl={chat.peer.avatar_url || undefined}
                    fallbackText={(chat.peer.display_name || chat.peer.username || '?').slice(0, 2).toUpperCase()}
                    name={chat.peer.display_name || chat.peer.username || 'User'}
                    message={chat.last_message || (chat.peer.username ? `@${chat.peer.username}` : '...')}
                    time={formatTime(chat.last_time)}
                    unread={chat.unread_count}
                    onClick={() => onOpenChat(chat.chat_id, chat.peer)}
                  />
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Кнопка создания */}
      <div className="fixed bottom-[100px] right-5 z-30 pointer-events-none">
        <motion.button 
          whileTap={{ scale: 0.85 }} 
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          onClick={() => setShowCreateMenu(!showCreateMenu)} 
          className="w-[56px] h-[56px] rounded-full flex items-center justify-center pointer-events-auto shadow-lg" 
          style={{ background: 'var(--app-accent-gradient)', color: '#fff' }}
        >
          <motion.div animate={{ rotate: showCreateMenu ? 45 : 0 }}><PlusIcon size={28} /></motion.div>
        </motion.button>
      </div>

      <AnimatePresence>
        {showCreateMenu && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm" onClick={() => setShowCreateMenu(false)} />
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.9 }} 
              animate={{ opacity: 1, y: 0, scale: 1 }} 
              exit={{ opacity: 0, y: 20, scale: 0.9 }} 
              className="fixed bottom-[170px] right-5 z-40 rounded-3xl p-2 min-w-[200px] shadow-2xl border glass-panel" 
              style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}
            >
              <button onClick={() => { setShowCreateMenu(false); onCreateGroup('group'); }} className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-all">
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-blue-500/10"><GroupIcon size={18} style={{ color: '#54a0ff' }} /></div>
                <span className="font-medium text-[15px]" style={{ color: 'var(--app-text)' }}>{t('newGroup')}</span>
              </button>
              <button onClick={() => { setShowCreateMenu(false); onCreateGroup('channel'); }} className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-all">
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-purple-500/10"><ChannelIcon size={18} style={{ color: '#9b59b6' }} /></div>
                <span className="font-medium text-[15px]" style={{ color: 'var(--app-text)' }}>{t('newChannel')}</span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ВЫНЕСЕННЫЙ КОМПОНЕНТ (чтобы список не лагал при обновлении)
const ListItem = memo(function ListItem({ 
  id, avatarUrl, fallbackIcon, fallbackText, name, message, time, unread, onClick, isSavedMessages 
}: { 
  id: string; avatarUrl?: string; fallbackIcon?: React.ReactNode; fallbackText?: string; name: string; message: string; time: string; unread: number; onClick: () => void; isSavedMessages?: boolean;
}) {
  const ring = isSavedMessages ? 'linear-gradient(135deg, var(--app-accent), #9b59b6)' : ringColor(id);

  return (
    <motion.button 
      whileTap={{ scale: 0.98 }}
      onClick={onClick} 
      className="w-full flex items-center gap-4 px-2 py-3 rounded-2xl transition-colors hover:bg-black/5 dark:hover:bg-white/5"
    >
      <div className="relative flex-shrink-0">
        <div className="w-[50px] h-[50px] rounded-full p-[2px]" style={{ background: ring }}>
          {avatarUrl ? (
            <img src={avatarUrl} alt={name} className="w-full h-full rounded-full object-cover border-2" style={{ borderColor: 'var(--app-bg)' }} />
          ) : (
            <div className="w-full h-full rounded-full flex items-center justify-center font-semibold text-[17px] border-2" style={{ background: 'var(--app-surface)', color: 'var(--app-text)', borderColor: 'var(--app-bg)' }}>
              {fallbackIcon || fallbackText}
            </div>
          )}
        </div>
        {/* Точка онлайн */}
        <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-[2.5px]" style={{ background: '#2ecc71', borderColor: 'var(--app-bg)' }}></div>
      </div>

      <div className="flex-1 text-left min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <p className="font-semibold text-[16px] truncate" style={{ color: 'var(--app-text)' }}>{name}</p>
          <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-2">
            <span className="text-[12px] font-medium" style={{ color: 'var(--app-text-muted)' }}>{time}</span>
            {unread > 0 && (
              <span className="min-w-[20px] h-[20px] px-1.5 rounded-full flex items-center justify-center text-[11px] font-bold text-white shadow-sm" style={{ background: 'var(--app-accent)' }}>
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </div>
        </div>
        <p className="text-[14px] truncate" style={{ color: 'var(--app-text-muted)' }}>{message}</p>
      </div>
    </motion.button>
  );
});
