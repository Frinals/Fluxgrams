import { useState, useEffect, useRef, useCallback, FormEvent, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, Profile, Message, Reaction, Group } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { encryptMessage, decryptMessage } from '@/lib/crypto';
import { UserProfileModal } from '@/components/UserProfileModal';
import {
  BackIcon, SendIcon, MicIcon, ImageIcon, VideoUploadIcon, PhoneIcon, VideoIcon,
  TimerIcon, PlayIcon, PauseIcon, TrashIcon, BookmarkIcon, ShieldIcon,
  GroupIcon, ChannelIcon, LockIcon, GiftIcon,
} from '@/components/Icons';
import { GiftsModal, GiftType, GIFTS } from '@/components/GiftsModal';

interface Props {
  chatId: string | null;
  peer: Profile;
  group: Group | null;
  onBack: () => void;
  onCall: (peer: Profile, callType: 'audio' | 'video') => void;
}

const EMOJIS = ['❤️', '👍', '😂', '🔥', '😮', '😢', '🎉', '👏'];

const springTransition = { type: 'spring' as const, stiffness: 300, damping: 30 };

export default function ChatView({ chatId, peer, group, onBack, onCall }: Props) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isSelfChat = user ? peer.id === user.id : false;
  const isGroupChat = group !== null;
  const isChannel = group?.type === 'channel';
  const isChannelOwner = isChannel && user ? group.owner_id === user.id : false;
  const canPostInChannel = !isChannel || isChannelOwner;

  const [messages, setMessages] = useState<Message[]>([]);
  const [reactions, setReactions] = useState<Record<string, Reaction[]>>({});
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [disappearing, setDisappearing] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<{ url: string; type: 'image' | 'video' } | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showGifts, setShowGifts] = useState(false);
  const [senderProfiles, setSenderProfiles] = useState<Record<string, Profile>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Decrypt a batch of messages using the shared E2EE key (only for 1-on-1)
  const decryptMessages = useCallback(async (msgs: Message[]): Promise<Message[]> => {
    if (!user || isSelfChat || isGroupChat) return msgs;
    return Promise.all(
      msgs.map(async (m) => {
        if (m.content && m.content.startsWith('enc:')) {
          try {
            const decrypted = await decryptMessage(m.content, user.id, peer.id);
            return { ...m, content: decrypted };
          } catch {
            return { ...m, content: '[Encrypted]' };
          }
        }
        return m;
      })
    );
  }, [user, peer.id, isSelfChat, isGroupChat]);

  const loadMessages = useCallback(async () => {
    if (isGroupChat && group) {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('group_id', group.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[ChatView] loadMessages group error:', error);
        setLoading(false);
        return;
      }

      if (data) {
        const filtered = data.filter((m) => {
          if (m.disappearing && m.expires_at) return new Date(m.expires_at) > new Date();
          return true;
        });
        setMessages(filtered as Message[]);

        // Fetch sender profiles for group messages
        const senderIds = [...new Set(filtered.map((m) => m.sender_id))];
        if (senderIds.length > 0) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('*')
            .in('id', senderIds);
          if (profilesData) {
            const map: Record<string, Profile> = {};
            for (const p of profilesData) map[p.id] = p as Profile;
            setSenderProfiles(map);
          }
        }

        const msgIds = filtered.map((m) => m.id);
        if (msgIds.length > 0) {
          const { data: reactData } = await supabase
            .from('reactions')
            .select('*')
            .in('message_id', msgIds);
          if (reactData) {
            const rmap: Record<string, Reaction[]> = {};
            for (const r of reactData) {
              if (!rmap[r.message_id]) rmap[r.message_id] = [];
              rmap[r.message_id].push(r as Reaction);
            }
            setReactions(rmap);
          }
        }
      }
    } else if (chatId) {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[ChatView] loadMessages error:', error);
        setLoading(false);
        return;
      }

      if (data) {
        const now = new Date();
        const filtered = data.filter((m) => {
          if (m.disappearing && m.expires_at) return new Date(m.expires_at) > now;
          return true;
        });
        const decrypted = await decryptMessages(filtered as Message[]);
        setMessages(decrypted);

        const msgIds = decrypted.map((m) => m.id);
        if (msgIds.length > 0) {
          const { data: reactData } = await supabase
            .from('reactions')
            .select('*')
            .in('message_id', msgIds);
          if (reactData) {
            const map: Record<string, Reaction[]> = {};
            for (const r of reactData) {
              if (!map[r.message_id]) map[r.message_id] = [];
              map[r.message_id].push(r as Reaction);
            }
            setReactions(map);
          }
        }
      }
    }
    setLoading(false);
  }, [chatId, group, isGroupChat, decryptMessages]);

  // Realtime subscription — stable refs
  const chatIdRef = useRef(chatId);
  chatIdRef.current = chatId;
  const groupIdRef = useRef(group?.id ?? null);
  groupIdRef.current = group?.id ?? null;
  const decryptRef = useRef(decryptMessages);
  decryptRef.current = decryptMessages;

  useEffect(() => {
    loadMessages();

    const currentChatId = chatIdRef.current;
    const currentGroupId = groupIdRef.current;
    const channelName = currentGroupId ? `group:${currentGroupId}` : `chat:${currentChatId}`;
    const filterCol = currentGroupId ? 'group_id' : 'chat_id';
    const filterVal = currentGroupId ?? currentChatId;

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `${filterCol}=eq.${filterVal}` },
        async (payload) => {
          const newMsg = payload.new as Message;
          if (newMsg.content && newMsg.content.startsWith('enc:') && !currentGroupId) {
            const decrypted = await decryptRef.current([newMsg]);
            setMessages((prev) => {
              if (prev.some((m) => m.id === decrypted[0].id)) return prev;
              return [...prev, decrypted[0]];
            });
          } else {
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          }
        }
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages', filter: `${filterCol}=eq.${filterVal}` },
        (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
        }
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reactions' },
        (payload) => {
          const r = payload.new as Reaction;
          setReactions((prev) => ({
            ...prev,
            [r.message_id]: [...(prev[r.message_id] || []), r],
          }));
        }
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'reactions' },
        (payload) => {
          const old = payload.old as Reaction;
          setReactions((prev) => ({
            ...prev,
            [old.message_id]: (prev[old.message_id] || []).filter((r) => r.id !== old.id),
          }));
        }
      )
      .subscribe();

    if (user && currentChatId && !currentGroupId) {
      supabase
        .from('chat_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('chat_id', currentChatId)
        .eq('user_id', user.id)
        .then(({ error }) => {
          if (error) console.error('[ChatView] Failed to update last_read_at:', error);
        });
    }

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, group?.id, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setMessages((prev) => {
        const filtered = prev.filter((m) => !m.disappearing || !m.expires_at || new Date(m.expires_at) > now);
        return filtered.length === prev.length ? prev : filtered;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const sendMessage = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || !user) return;
    if (!canPostInChannel) return;

    const plaintext = input.trim();
    setInput('');
    setSendError(null);

    let contentToSend = plaintext;
    if (!isSelfChat && !isGroupChat) {
      try {
        contentToSend = await encryptMessage(plaintext, user.id, peer.id);
      } catch {
        console.error('[ChatView] Encryption failed, sending plaintext');
      }
    }

    const expiresAt = disappearing
      ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      : null;

    const insertData: Record<string, unknown> = {
      sender_id: user.id,
      content: contentToSend,
      disappearing,
      expires_at: expiresAt,
    };

    if (isGroupChat && group) {
      insertData.group_id = group.id;
    } else if (chatId) {
      insertData.chat_id = chatId;
    }

    const { data, error } = await supabase
      .from('messages')
      .insert(insertData)
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('[ChatView] sendMessage error:', error);
      setSendError(error.message);
      setInput(plaintext);
      return;
    }

    if (data) {
      const localMsg = { ...data as Message, content: plaintext };
      setMessages((prev) => {
        if (prev.some((m) => m.id === localMsg.id)) return prev;
        return [...prev, localMsg];
      });
    }
  };

  const sendMedia = async (file: File, type: 'image' | 'video' | 'audio'): Promise<boolean> => {
    if (!user) return false;
    if (!canPostInChannel) return false;

    const targetId = isGroupChat ? group!.id : chatId;
    if (!targetId) return false;
    const ext = file.name.split('.').pop() || 'bin';
    const fileName = `${targetId}/${user.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('chat-media')
      .upload(fileName, file);

    if (uploadError) {
      console.error('[ChatView] Storage upload error:', uploadError);
      setSendError(uploadError.message);
      return false;
    }

    const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(fileName);
    const mediaUrl = urlData.publicUrl;

    const expiresAt = disappearing
      ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      : null;

    const insertData: Record<string, unknown> = {
      sender_id: user.id,
      media_url: mediaUrl,
      media_type: type,
      disappearing,
      expires_at: expiresAt,
    };

    if (isGroupChat && group) {
      insertData.group_id = group.id;
    } else if (chatId) {
      insertData.chat_id = chatId;
    }

    const { data, error } = await supabase
      .from('messages')
      .insert(insertData)
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('[ChatView] sendMedia insert error:', error);
      setSendError(error.message);
      return false;
    }

    if (data) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.id)) return prev;
        return [...prev, data as Message];
      });
    }
    return true;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const file = e.target.files?.[0];
    if (file) sendMedia(file, type);
    e.target.value = '';
  };

  const startRecording = async () => {
    setSendError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach((track) => track.stop());
        if (blob.size < 100) { setRecording(false); return; }
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
        await sendMedia(file, 'audio');
        setRecording(false);
      };

      recorder.onerror = (event) => {
        console.error('[ChatView] MediaRecorder error:', event);
        setRecording(false);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch (err) {
      console.error('[ChatView] Microphone access denied:', err);
      setSendError('Microphone permission denied.');
      setRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;
    const existing = reactions[messageId]?.find((r) => r.user_id === user.id);
    if (existing) {
      await supabase.from('reactions').delete().eq('id', existing.id);
    } else {
      const { error } = await supabase.from('reactions').insert({
        message_id: messageId,
        user_id: user.id,
        emoji,
      });
      if (error) console.error('[ChatView] Reaction error:', error);
    }
    setShowEmojiPicker(null);
  };

  const handleSendGift = async (gift: GiftType) => {
    if (!user) return;
    setShowGifts(false);

    const giftContent = JSON.stringify({ type: 'gift', giftId: gift.id, name: gift.nameKey, emoji: gift.emoji, gradient: gift.gradient });

    const insertData: Record<string, unknown> = {
      sender_id: user.id,
      content: giftContent,
      media_type: 'gift',
      disappearing: false,
      expires_at: null,
    };

    if (isGroupChat && group) {
      insertData.group_id = group.id;
    } else if (chatId) {
      insertData.chat_id = chatId;
    }

    const { data, error } = await supabase
      .from('messages')
      .insert(insertData)
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('[ChatView] sendGift error:', error);
      setSendError(error.message);
      return;
    }

    if (data) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.id)) return prev;
        return [...prev, data as Message];
      });
    }
  };

  const deleteMessage = async (msg: Message) => {
    if (!user || msg.sender_id !== user.id) return;
    const { error } = await supabase.from('messages').delete().eq('id', msg.id);
    if (error) {
      console.error('[ChatView] deleteMessage error:', error);
      return;
    }
    setMessages((prev) => prev.filter((m) => m.id !== msg.id));
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const initials = isGroupChat
    ? (group!.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2))
    : (peer.display_name || peer.username || '?').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  const headerName = isGroupChat ? group!.name : (isSelfChat ? t('savedMessages') : (peer.display_name || 'User'));
  const headerSub = isGroupChat
    ? (isChannel ? t('channelInfo') : t('groupInfo'))
    : (!isSelfChat ? `@${peer.username || '...'}` : '');

  const handleProfileClick = () => {
    if (!isSelfChat && !isGroupChat) setShowProfile(true);
  };

  const getSenderName = (senderId: string): string => {
    const p = senderProfiles[senderId];
    return p?.display_name || p?.username || 'User';
  };

  return (
    <div className="flex flex-col h-full relative">
      <div className="liquid-orb" style={{ background: 'var(--app-accent)', width: 300, height: 300, top: '0%', right: '-15%' }} />
      <div className="liquid-orb" style={{ background: 'var(--app-glow)', width: 250, height: 250, bottom: '10%', left: '-12%', animationDelay: '2s' }} />

      {/* Header */}
      <div className="flex items-center gap-3 p-3 glass-nav border-b z-10"
           style={{ borderColor: 'var(--app-border-glass)' }}>
        <button onClick={onBack} className="p-2 rounded-lg transition-all hover:bg-white/10"
                style={{ color: 'var(--app-text)' }}>
          <BackIcon size={22} />
        </button>

        {/* Avatar — group icon or profile avatar */}
        {isSelfChat ? (
          <div className="w-10 h-10 rounded-full flex items-center justify-center"
               style={{ background: 'var(--app-accent-gradient)', color: '#fff' }}>
            <BookmarkIcon size={18} />
          </div>
        ) : isGroupChat ? (
          group!.avatar_url ? (
            <img src={group!.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-full flex items-center justify-center"
                 style={{ background: 'var(--app-accent-gradient)', color: '#fff' }}>
              {isChannel ? <ChannelIcon size={18} /> : <GroupIcon size={18} />}
            </div>
          )
        ) : peer.avatar_url ? (
          <img src={peer.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover cursor-pointer"
               onClick={handleProfileClick} />
        ) : (
          <div className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm cursor-pointer"
               style={{ background: 'var(--app-accent-gradient)', color: '#fff' }}
               onClick={handleProfileClick}>
            {initials}
          </div>
        )}

        <div className="flex-1 min-w-0" onClick={handleProfileClick}
             style={{ cursor: (!isSelfChat && !isGroupChat) ? 'pointer' : 'default' }}>
          <p className="font-semibold truncate" style={{ color: 'var(--app-text)' }}>{headerName}</p>
          <p className="text-xs flex items-center gap-1" style={{ color: 'var(--app-text-muted)' }}>
            {headerSub}
            {!isSelfChat && !isGroupChat && <ShieldIcon size={11} style={{ color: 'var(--app-success)' }} />}
            {isChannel && <LockIcon size={11} />}
          </p>
        </div>

        {!isSelfChat && !isGroupChat && (
          <>
            <button onClick={() => setShowGifts(true)}
                    className="p-2 rounded-lg transition-all hover:bg-white/10"
                    style={{ color: 'var(--app-accent)' }}>
              <GiftIcon size={20} />
            </button>
            <button onClick={() => onCall(peer, 'audio')}
                    className="p-2 rounded-lg transition-all hover:bg-white/10"
                    style={{ color: 'var(--app-accent)' }}>
              <PhoneIcon size={20} />
            </button>
            <button onClick={() => onCall(peer, 'video')}
                    className="p-2 rounded-lg transition-all hover:bg-white/10"
                    style={{ color: 'var(--app-accent)' }}>
              <VideoIcon size={20} />
            </button>
          </>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 scroll-smooth-touch">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-2 rounded-full animate-spin"
                 style={{ borderColor: 'var(--app-border)', borderTopColor: 'var(--app-accent)' }} />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-sm" style={{ color: 'var(--app-text-muted)' }}>{t('noChats')}</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg) => {
              const isSent = msg.sender_id === user?.id;
              return (
                <motion.div
                  key={msg.id}
                  layout
                  initial={{ opacity: 0, y: 12, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={springTransition}
                  className={`flex ${isSent ? 'justify-end' : 'justify-start'} group relative`}
                >
                  <div className="relative max-w-[75%]">
                    {/* Sender name in group chats */}
                    {isGroupChat && !isSent && (
                      <p className="text-xs font-semibold ml-3 mb-0.5" style={{ color: 'var(--app-accent)' }}>
                        {getSenderName(msg.sender_id)}
                      </p>
                    )}
                    <div
                      onContextMenu={(e) => { e.preventDefault(); setShowEmojiPicker(showEmojiPicker === msg.id ? null : msg.id); }}
                      onPointerDown={(e) => {
                        const timer = setTimeout(() => setShowEmojiPicker(showEmojiPicker === msg.id ? null : msg.id), 500);
                        const cancel = () => clearTimeout(timer);
                        e.currentTarget.addEventListener('pointerup', cancel, { once: true });
                        e.currentTarget.addEventListener('pointerleave', cancel, { once: true });
                      }}
                      onClick={() => setShowEmojiPicker(showEmojiPicker === msg.id ? null : msg.id)}
                      className="rounded-2xl px-4 py-2.5 cursor-pointer transition-all hover:scale-[1.02] shadow-sm"
                      style={{
                        background: isSent ? 'var(--app-accent-gradient)' : 'var(--app-surface)',
                        color: isSent ? 'var(--app-bubbleSentText)' : 'var(--app-bubbleRecvText)',
                        backdropFilter: 'blur(10px)',
                        border: isSent ? 'none' : '1px solid var(--app-border)',
                      }}
                    >
                      {msg.media_type === 'gift' && msg.content && (() => {
                        try {
                          const gift = JSON.parse(msg.content);
                          return (
                            <div className="flex flex-col items-center py-2 px-4 min-w-[180px]">
                              <motion.div
                                animate={{ y: [0, -6, 0], rotate: [0, 5, -5, 0] }}
                                transition={{ repeat: Infinity, duration: 3 }}
                                className="text-5xl mb-2"
                              >
                                {gift.emoji}
                              </motion.div>
                              <p className="text-xs font-bold" style={{ color: isSent ? 'var(--app-bubbleSentText)' : 'var(--app-accent)' }}>
                                {t(gift.name as 'liquidRose')}
                              </p>
                              <div className="mt-2 h-1 w-full rounded-full" style={{ background: gift.gradient }} />
                              <p className="text-[10px] mt-1 opacity-70">{t('giftSent')}</p>
                            </div>
                          );
                        } catch { return null; }
                      })()}
                      {msg.media_type === 'image' && msg.media_url && (
                        <img src={msg.media_url} alt="" className="rounded-xl max-w-full max-h-64 mb-1"
                             onClick={(e) => { e.stopPropagation(); setMediaPreview({ url: msg.media_url!, type: 'image' }); }} />
                      )}
                      {msg.media_type === 'video' && msg.media_url && (
                        <video src={msg.media_url} controls className="rounded-xl max-w-full max-h-64 mb-1" />
                      )}
                      {msg.media_type === 'audio' && msg.media_url && (
                        <AudioPlayer url={msg.media_url} isSent={isSent} />
                      )}
                      {msg.content && <p className="break-words whitespace-pre-wrap">{msg.content}</p>}
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-[10px] opacity-70">{formatTime(msg.created_at)}</span>
                        {msg.disappearing && <TimerIcon size={12} className="opacity-70" />}
                        {!isSelfChat && !isSent && !isGroupChat && <ShieldIcon size={10} className="opacity-40" />}
                      </div>
                    </div>

                    {/* Reactions */}
                    {reactions[msg.id] && reactions[msg.id].length > 0 && (
                      <div className={`flex gap-1 mt-1 ${isSent ? 'justify-end' : 'justify-start'}`}>
                        {Object.entries(
                          reactions[msg.id].reduce<Record<string, number>>((acc, r) => {
                            acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                            return acc;
                          }, {})
                        ).map(([emoji, count]) => (
                          <span key={emoji} className="text-xs rounded-full px-2 py-0.5 backdrop-blur-sm border"
                                style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
                            {emoji} {count > 1 && count}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Emoji reaction wheel — long-press / right-click / click */}
                    {showEmojiPicker === msg.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.5, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.5, y: -10 }}
                        transition={springTransition}
                        className={`absolute z-20 ${isSent ? 'right-0' : 'left-0'} top-full mt-1 flex gap-1 p-2.5 rounded-2xl backdrop-blur-xl border shadow-xl`}
                        style={{ background: 'var(--app-nav-bg)', borderColor: 'var(--app-border-glass)' }}
                      >
                        {EMOJIS.map((emoji, i) => (
                          <motion.button
                            key={emoji}
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ ...springTransition, delay: i * 0.04 }}
                            whileHover={{ scale: 1.3 }}
                            whileTap={{ scale: 0.85 }}
                            onClick={() => toggleReaction(msg.id, emoji)}
                            className="text-2xl p-1"
                          >
                            {emoji}
                          </motion.button>
                        ))}
                        {isSent && (
                          <motion.button
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ ...springTransition, delay: EMOJIS.length * 0.04 }}
                            whileHover={{ scale: 1.3 }}
                            whileTap={{ scale: 0.85 }}
                            onClick={() => deleteMessage(msg)}
                            className="p-1"
                            style={{ color: 'var(--app-danger)' }}
                          >
                            <TrashIcon size={20} />
                          </motion.button>
                        )}
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
        <div ref={messagesEndRef} />
      </div>

      {mediaPreview && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl"
          style={{ background: 'rgba(0,0,0,0.8)' }}
          onClick={() => setMediaPreview(null)}>
          <img src={mediaPreview.url} alt="" className="max-w-full max-h-full rounded-2xl" />
        </motion.div>
      )}

      {/* User Profile Modal */}
      <AnimatePresence>
        {showProfile && (
          <UserProfileModal profile={peer} onClose={() => setShowProfile(false)} />
        )}
      </AnimatePresence>

      {sendError && (
        <div className="mx-3 mb-1 text-xs rounded-xl p-2 border" style={{
          background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)', color: '#ef4444',
        }}>
          {sendError}
        </div>
      )}

      {recording && (
        <div className="mx-3 mb-1 flex items-center justify-center gap-2 rounded-xl p-2 border" style={{
          background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)',
        }}>
          <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: 'var(--app-danger)' }} />
          <span className="text-xs" style={{ color: 'var(--app-danger)' }}>
            {t('voiceMessage')}... — release to send
          </span>
        </div>
      )}

      {/* Gifts Modal */}
      <AnimatePresence>
        {showGifts && (
          <GiftsModal onClose={() => setShowGifts(false)} onSendGift={handleSendGift} />
        )}
      </AnimatePresence>

      {/* Input bar — disabled for non-owner channel members */}
      <div className="p-3 glass-nav border-t" style={{ borderColor: 'var(--app-border-glass)' }}>
        {canPostInChannel ? (
          <>
            <div className="flex items-center gap-2 mb-2">
              <button onClick={() => setDisappearing(!disappearing)}
                      className="p-2 rounded-lg transition-all border"
                      style={{
                        background: disappearing ? 'var(--app-accent)' : 'var(--app-surface)',
                        color: disappearing ? '#fff' : 'var(--app-text-muted)',
                        borderColor: 'var(--app-border)',
                      }}
                      title={t('disappearingMessages')}>
                <TimerIcon size={18} />
              </button>
              <button onClick={() => fileInputRef.current?.click()}
                      className="p-2 rounded-lg transition-all hover:bg-white/10"
                      style={{ color: 'var(--app-text-muted)' }}>
                <ImageIcon size={20} />
              </button>
              <button onClick={() => videoInputRef.current?.click()}
                      className="p-2 rounded-lg transition-all hover:bg-white/10"
                      style={{ color: 'var(--app-text-muted)' }}>
                <VideoUploadIcon size={20} />
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" hidden
                     onChange={(e) => handleFileSelect(e, 'image')} />
              <input ref={videoInputRef} type="file" accept="video/*" hidden
                     onChange={(e) => handleFileSelect(e, 'video')} />
            </div>

            <form onSubmit={sendMessage} className="flex items-center gap-2">
              <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
                     placeholder={t('typeMessage')}
                     className="flex-1 px-4 py-2.5 rounded-xl outline-none border backdrop-blur-sm"
                     style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }} />
              {input.trim() ? (
                <motion.button type="submit" whileTap={{ scale: 0.9 }}
                               className="p-2.5 rounded-xl transition-all"
                               style={{ background: 'var(--app-accent)', color: '#fff' }}>
                  <SendIcon size={20} />
                </motion.button>
              ) : (
                <button type="button"
                        onMouseDown={startRecording} onMouseUp={stopRecording}
                        onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
                        onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
                        onMouseLeave={() => { if (recording) stopRecording(); }}
                        className="p-2.5 rounded-xl transition-all select-none"
                        style={{ background: recording ? 'var(--app-danger)' : 'var(--app-accent)', color: '#fff' }}>
                  <MicIcon size={20} />
                </button>
              )}
            </form>
          </>
        ) : (
          <div className="flex items-center justify-center py-3 gap-2" style={{ color: 'var(--app-text-muted)' }}>
            <LockIcon size={18} />
            <span className="text-sm">{t('onlyOwnerCanPost')}</span>
          </div>
        )}
      </div>
    </div>
  );
}

const AudioPlayer = memo(function AudioPlayer({ url, isSent }: { url: string; isSent: boolean }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) audioRef.current.pause();
    else audioRef.current.play();
    setPlaying(!playing);
  };

  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      <button onClick={toggle} className="flex-shrink-0">
        {playing ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
      </button>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden"
           style={{ background: isSent ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.15)' }}>
        <div className="h-full rounded-full" style={{ width: '100%', background: isSent ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.3)' }} />
      </div>
      <audio ref={audioRef} src={url} onEnded={() => setPlaying(false)} />
    </div>
  );
});
