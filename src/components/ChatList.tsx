import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
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

    const { data: myParts } = await supabase
      .from('chat_participants')
      .select('chat_id, last_read_at')
      .eq('user_id', user.id);

    if (!myParts || myParts.length === 0) {
      setChats([]);
    } else {
      const chatIds = myParts.map((p) => p.chat_id);
      const lastReadMap = new Map<string, string>();
      for (const p of myParts) lastReadMap.set(p.chat_id, p.last_read_at);

      const { data: allParticipants } = await supabase
        .from('chat_participants')
        .select('chat_id, user_id')
        .in('chat_id', chatIds)
        .neq('user_id', user.id);

      if (allParticipants && allParticipants.length > 0) {
        const peerIds = [...new Set(allParticipants.map((p) => p.user_id))];
        const { data: peerProfiles } = await supabase
          .from('profiles')
          .select('*')
          .in('id', peerIds);

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
            // Count unread: messages from others after last_read_at
            if (m.sender_id !== user.id) {
              const lastRead = lastReadMap.get(m.chat_id);
              if (!lastRead || new Date(m.created_at) > new Date(lastRead)) {
                unreadMap.set(m.chat_id, (unreadMap.get(m.chat_id) ?? 0) + 1);
              }
            }
          }
        }

        const peerMap = new Map<string, Profile>();
        if (peerProfiles) {
          for (const p of peerProfiles) peerMap.set(p.id, p as Profile);
        }

        const previews: ChatPreview[] = [];
        for (const p of allParticipants) {
          const peer = peerMap.get(p.user_id);
          if (!peer) continue;

          const lastMsg = lastMsgMap.get(p.chat_id);
          let lastMessage: string | null = null;
          if (lastMsg) {
            if (lastMsg.content) {
              lastMessage = lastMsg.content.startsWith('enc:') ? '[Encrypted]' : lastMsg.content;
            }
            else if (lastMsg.media_type === 'image') lastMessage = `[${t('photo')}]`;
            else if (lastMsg.media_type === 'video') lastMessage = `[${t('video')}]`;
            else if (lastMsg.media_type === 'audio') lastMessage = `[${t('audio')}]`;
          }

          previews.push({
            chat_id: p.chat_id,
            peer,
            last_message: lastMessage,
            last_time: lastMsg?.created_at ?? null,
            unread_count: unreadMap.get(p.chat_id) ?? 0,
          });
        }

        previews.sort((a, b) => {
          if (!a.last_time) return 1;
          if (!b.last_time) return -1;
          return new Date(b.last_time).getTime() - new Date(a.last_time).getTime();
        });

        setChats(previews);
      } else {
        setChats([]);
      }
    }

    // Load groups/channels
    const { data: myGroups } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', user.id);

    if (myGroups && myGroups.length > 0) {
      const groupIds = myGroups.map((g) => g.group_id);

      const { data: groupData } = await supabase
        .from('groups')
        .select('*')
        .in('id', groupIds);

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
            if (lastMsg.content) lastMessage = lastMsg.content;
            else if (lastMsg.media_type === 'image') lastMessage = `[${t('photo')}]`;
            else if (lastMsg.media_type === 'video') lastMessage = `[${t('video')}]`;
            else if (lastMsg.media_type === 'audio') lastMessage = `[${t('audio')}]`;
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
        const chatIds = new Set(chats.map((chat) => chat.chat_id));
        const groupIds = new Set(groups.map((group) => group.group.id));
        if (record.chat_id && chatIds.has(record.chat_id)) loadChatsRef.current();
        if (record.group_id && groupIds.has(record.group_id)) loadChatsRef.current();
        if (record.chat_id === savedMessagesChatId) loadSavedRef.current();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_participants', filter: `user_id=eq.${user?.id ?? ''}` }, () => {
        loadChatsRef.current();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_members', filter: `user_id=eq.${user?.id ?? ''}` }, () => {
        loadChatsRef.current();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, chats, groups, savedMessagesChatId]);

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

  // Combined sorted list of chats and groups
  const allItems = useMemo<(ChatPreview | GroupPreview)[]>(() => {
    return [...chats, ...groups].sort((a, b) => {
      const aTime = 'last_time' in a ? a.last_time : null;
      const bTime = 'last_time' in b ? b.last_time : null;
      if (!aTime) return 1;
      if (!bTime) return -1;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
  }, [chats, groups]);

  const springTransition = { type: 'spring' as const, stiffness: 300, damping: 30 };

  return (
    <div className="flex flex-col h-full relative">
      <div className="liquid-orb" style={{ background: 'var(--app-accent)', width: 250, height: 250, top: '10%', right: '-10%' }} />
      <div className="liquid-orb" style={{ background: 'var(--app-glow)', width: 200, height: 200, bottom: '30%', left: '-8%', animationDelay: '3s' }} />

      <div className="sticky top-0 z-10 p-4 glass-nav border-b"
           style={{ borderColor: 'var(--app-border-glass)' }}>
        <h2 className="text-xl font-bold" style={{ color: 'var(--app-text)' }}>{t('chats')}</h2>
      </div>

      <div className="flex-1 overflow-y-auto scroll-smooth-touch">
        <StoriesBar />

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-2 rounded-full animate-spin"
                 style={{ borderColor: 'var(--app-border)', borderTopColor: 'var(--app-accent)' }} />
          </div>
        ) : (
          <>
            {savedMessagesChatId && (
              <button onClick={openSavedMessages}
                className="w-full flex items-center gap-3 p-3 transition-all hover:bg-white/5 border-b"
                style={{ borderColor: 'var(--app-border)' }}>
                <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                     style={{ background: 'var(--app-accent-gradient)', color: '#fff' }}>
                  <BookmarkIcon size={22} />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold truncate" style={{ color: 'var(--app-text)' }}>{t('savedMessages')}</p>
                    <span className="text-xs flex-shrink-0 ml-2" style={{ color: 'var(--app-text-muted)' }}>{formatTime(savedLastTime)}</span>
                  </div>
                  <p className="text-sm truncate" style={{ color: 'var(--app-text-muted)' }}>{savedLastMessage || '...'}</p>
                </div>
              </button>
            )}

            {allItems.length === 0 && !savedMessagesChatId ? (
              <div className="flex flex-col items-center justify-center h-64 p-8 text-center">
                <p className="text-sm" style={{ color: 'var(--app-text-muted)' }}>{t('noChats')}</p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {allItems.map((item) => {
                  if ('group' in item) {
                    const g = item.group;
                    return (
                      <motion.button
                        key={`g-${g.id}`}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={springTransition}
                        onClick={() => onOpenGroup(g)}
                        className="w-full flex items-center gap-3 p-3 transition-all hover:bg-white/5 border-b"
                        style={{ borderColor: 'var(--app-border)' }}>
                        <GroupAvatar group={g} />
                        <div className="flex-1 text-left min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="font-semibold truncate flex items-center gap-1.5" style={{ color: 'var(--app-text)' }}>
                              {g.type === 'channel' ? (
                                <ChannelIcon size={15} style={{ color: 'var(--app-accent)', flexShrink: 0 }} />
                              ) : (
                                <GroupIcon size={15} style={{ color: 'var(--app-accent)', flexShrink: 0 }} />
                              )}
                              {g.name}
                            </p>
                            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                              {item.unread_count > 0 && (
                                <span className="min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                                      style={{ background: 'var(--app-danger)' }}>
                                  {item.unread_count > 99 ? '99+' : item.unread_count}
                                </span>
                              )}
                              <span className="text-xs" style={{ color: 'var(--app-text-muted)' }}>{formatTime(item.last_time)}</span>
                            </div>
                          </div>
                          <p className="text-sm truncate" style={{ color: 'var(--app-text-muted)' }}>
                            {item.last_message || (g.description || '...')}
                          </p>
                        </div>
                      </motion.button>
                    );
                  }

                  const chat = item;
                  return (
                    <motion.button
                      key={`c-${chat.chat_id}`}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={springTransition}
                      onClick={() => onOpenChat(chat.chat_id, chat.peer)}
                      className="w-full flex items-center gap-3 p-3 transition-all hover:bg-white/5 border-b"
                      style={{ borderColor: 'var(--app-border)' }}>
                      <Avatar profile={chat.peer} />
                      <div className="flex-1 text-left min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold truncate" style={{ color: 'var(--app-text)' }}>
                            {chat.peer.display_name || chat.peer.username || 'User'}
                          </p>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                            {chat.unread_count > 0 && (
                              <span className="min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                                    style={{ background: 'var(--app-danger)' }}>
                                {chat.unread_count > 99 ? '99+' : chat.unread_count}
                              </span>
                            )}
                            <span className="text-xs" style={{ color: 'var(--app-text-muted)' }}>{formatTime(chat.last_time)}</span>
                          </div>
                        </div>
                        <p className="text-sm truncate" style={{ color: 'var(--app-text-muted)' }}>
                          {chat.last_message || (chat.peer.username ? `@${chat.peer.username}` : '...')}
                        </p>
                      </div>
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            )}
          </>
        )}
      </div>

      {/* Floating Create Button */}
      <div className="fixed bottom-24 right-4 z-30 pointer-events-none">
        <motion.button
          whileTap={{ scale: 0.85 }}
          whileHover={{ scale: 1.05 }}
          transition={springTransition}
          onClick={() => setShowCreateMenu(!showCreateMenu)}
          className="fab w-14 h-14 rounded-full flex items-center justify-center pointer-events-auto"
          style={{ color: '#fff' }}
        >
          <motion.div animate={{ rotate: showCreateMenu ? 45 : 0 }} transition={springTransition}>
            <PlusIcon size={26} />
          </motion.div>
        </motion.button>
      </div>

      {/* Create Menu */}
      <AnimatePresence>
        {showCreateMenu && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-30"
              onClick={() => setShowCreateMenu(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              transition={springTransition}
              className="fixed bottom-40 right-4 z-40 glass-panel rounded-2xl p-2 min-w-[180px]"
            >
              <button onClick={() => { setShowCreateMenu(false); onCreateGroup('group'); }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/10 transition-all">
                <GroupIcon size={22} style={{ color: 'var(--app-accent)' }} />
                <span className="font-medium text-sm" style={{ color: 'var(--app-text)' }}>{t('newGroup')}</span>
              </button>
              <button onClick={() => { setShowCreateMenu(false); onCreateGroup('channel'); }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/10 transition-all">
                <ChannelIcon size={22} style={{ color: 'var(--app-accent)' }} />
                <span className="font-medium text-sm" style={{ color: 'var(--app-text)' }}>{t('newChannel')}</span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

const Avatar = memo(function Avatar({ profile }: { profile: Profile }) {
  const initials = (profile.display_name || profile.username || '?')
    .split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
  const ring = ringColor(profile.id);
  if (profile.avatar_url) {
    return (
      <div className="w-[52px] h-[52px] rounded-full p-[2px] flex-shrink-0" style={{ background: ring }}>
        <img src={profile.avatar_url} alt={profile.display_name ?? ''} className="w-full h-full rounded-full object-cover border-2" style={{ borderColor: 'var(--app-bg)' }} />
      </div>
    );
  }
  return (
    <div className="w-[52px] h-[52px] rounded-full p-[2px] flex-shrink-0" style={{ background: ring }}>
      <div className="w-full h-full rounded-full flex items-center justify-center font-semibold border-2"
           style={{ background: 'var(--app-accent-gradient)', color: '#fff', borderColor: 'var(--app-bg)' }}>{initials}</div>
    </div>
  );
});

const GroupAvatar = memo(function GroupAvatar({ group }: { group: Group }) {
  const initials = group.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
  const ring = ringColor(group.id);
  if (group.avatar_url) {
    return (
      <div className="w-[52px] h-[52px] rounded-full p-[2px] flex-shrink-0" style={{ background: ring }}>
        <img src={group.avatar_url} alt={group.name} className="w-full h-full rounded-full object-cover border-2" style={{ borderColor: 'var(--app-bg)' }} />
      </div>
    );
  }
  return (
    <div className="w-[52px] h-[52px] rounded-full p-[2px] flex-shrink-0" style={{ background: ring }}>
      <div className="w-full h-full rounded-full flex items-center justify-center flex-shrink-0 border-2"
           style={{ background: 'var(--app-accent-gradient)', color: '#fff', borderColor: 'var(--app-bg)' }}>
        {group.type === 'channel' ? <ChannelIcon size={22} /> : <GroupIcon size={22} />}
      </div>
    </div>
  );
});
