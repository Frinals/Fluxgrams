import { useState, useEffect, useRef, useCallback, FormEvent, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, Profile, Message, Reaction, Group } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { encryptMessage, decryptMessage } from '@/lib/crypto';
import { UserProfileModal } from '@/components/UserProfileModal'; // ИМПОРТ ПРОФИЛЯ
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
  const [showGifts, setShowGifts] = useState(false);
  const [senderProfiles, setSenderProfiles] = useState<Record<string, Profile>>({});
  
  // СТЕЙТ ДЛЯ ПРОСМОТРА ПРОФИЛЯ
  const [showProfile, setShowProfile] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const decryptMessages = useCallback(async (msgs: Message[]): Promise<Message[]> => {
    if (!user || isSelfChat || isGroupChat) return msgs;
    return Promise.all(
      msgs.map(async (m) => {
        if (m.content && m.content.startsWith('enc:')) {
          try {
            const decrypted = await decryptMessage(m.content, user.id, peer.id);
            return { ...m, content: decrypted };
          } catch {
            return { ...m, content: '🔒 [Ошибка дешифрования]' };
          }
        }
        return m;
      })
    );
  }, [user, peer.id, isSelfChat, isGroupChat]);

  const loadMessages = useCallback(async () => {
    if (isGroupChat && group) {
      const { data, error } = await supabase.from('messages').select('*').eq('group_id', group.id).order('created_at', { ascending: true });
      if (error) { setLoading(false); return; }
      if (data) {
        setMessages(data as Message[]);
        const senderIds = [...new Set(data.map((m) => m.sender_id))];
        if (senderIds.length > 0) {
          const { data: profilesData } = await supabase.from('profiles').select('*').in('id', senderIds);
          if (profilesData) {
            const map: Record<string, Profile> = {};
            for (const p of profilesData) map[p.id] = p as Profile;
            setSenderProfiles(map);
          }
        }
      }
    } else if (chatId) {
      const { data, error } = await supabase.from('messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: true });
      if (error) { setLoading(false); return; }
      if (data) {
        const decrypted = await decryptMessages(data as Message[]);
        setMessages(decrypted);
      }
    }
    setLoading(false);
  }, [chatId, group, isGroupChat, decryptMessages]);

  useEffect(() => {
    loadMessages();
    const channel = supabase
      .channel(chatId ? `chat:${chatId}` : `group:${group?.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        const newMsg = payload.new as Message;
        if (chatId && newMsg.chat_id !== chatId) return;
        if (group && newMsg.group_id !== group.id) return;

        if (newMsg.content && newMsg.content.startsWith('enc:') && !isGroupChat) {
          const decrypted = await decryptMessages([newMsg]);
          setMessages((prev) => prev.some(m => m.id === decrypted[0].id) ? prev : [...prev, decrypted[0]]);
        } else {
          setMessages((prev) => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg]);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [chatId, group, isGroupChat, decryptMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || !user || !canPostInChannel) return;

    const plaintext = input.trim();
    setInput('');
    setSendError(null);

    let contentToSend = plaintext;
    if (!isSelfChat && !isGroupChat) {
      try { contentToSend = await encryptMessage(plaintext, user.id, peer.id); } catch {}
    }

    const expiresAt = disappearing ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null;
    const insertData: Record<string, unknown> = { sender_id: user.id, content: contentToSend, disappearing, expires_at: expiresAt };

    if (isGroupChat && group) insertData.group_id = group.id;
    else if (chatId) insertData.chat_id = chatId;

    const { data, error } = await supabase.from('messages').insert(insertData).select('*').maybeSingle();

    if (error) { setSendError(error.message); setInput(plaintext); return; }
    if (data) {
      const localMsg = { ...data as Message, content: plaintext };
      setMessages((prev) => prev.some(m => m.id === localMsg.id) ? prev : [...prev, localMsg]);
    }
  };

  const sendMedia = async (file: File, type: 'image' | 'video' | 'audio'): Promise<boolean> => {
    if (!user || !canPostInChannel) return false;
    const targetId = isGroupChat ? group!.id : chatId;
    if (!targetId) return false;
    
    const ext = file.name.split('.').pop() || 'bin';
    const fileName = `${targetId}/${user.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage.from('media').upload(fileName, file);
    if (uploadError) { setSendError(uploadError.message); return false; }

    const { data: urlData } = supabase.storage.from('media').getPublicUrl(fileName);
    
    const expiresAt = disappearing ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null;
    const insertData: Record<string, unknown> = {
      sender_id: user.id, media_url: urlData.publicUrl, media_type: type, disappearing, expires_at: expiresAt,
    };

    if (isGroupChat && group) insertData.group_id = group.id;
    else if (chatId) insertData.chat_id = chatId;

    const { data, error } = await supabase.from('messages').insert(insertData).select('*').maybeSingle();

    if (error) { setSendError(error.message); return false; }
    if (data) { setMessages((prev) => prev.some(m => m.id === data.id) ? prev : [...prev, data as Message]); }
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
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach((track) => track.stop());
        if (blob.size < 100) { setRecording(false); return; }
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
        await sendMedia(file, 'audio');
        setRecording(false);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch (err) { setSendError('Нет доступа к микрофону.'); setRecording(false); }
  };

  const stopRecording = () => { if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') mediaRecorderRef.current.stop(); };
  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const headerName = isGroupChat ? group!.name : (isSelfChat ? 'Избранное' : (peer.display_name || 'User'));
  const headerSub = isGroupChat ? (isChannel ? 'канал' : 'группа') : (!isSelfChat ? `@${peer.username || '...'}` : '');
  const getSenderName = (senderId: string) => senderProfiles[senderId]?.display_name || senderProfiles[senderId]?.username || 'User';

  return (
    <div className="flex flex-col h-full relative">
      
      {/* ФИКС: Шапка с открытием профиля */}
      <div className="flex items-center gap-3 p-3 glass-nav border-b z-20 sticky top-0 flex-shrink-0" style={{ borderColor: 'var(--app-border-glass)', background: 'var(--app-nav-bg)' }}>
        <button onClick={onBack} className="p-2 rounded-lg transition-all hover:bg-white/10" style={{ color: 'var(--app-text)' }}><BackIcon size={22} /></button>
        
        {/* Клик по аватарке или имени открывает профиль */}
        <div className="flex items-center gap-3 cursor-pointer flex-1 min-w-0" onClick={() => { if (!isSelfChat && !isGroupChat) setShowProfile(true); }}>
          {isSelfChat ? (
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-500 text-white"><BookmarkIcon size={18} /></div>
          ) : isGroupChat ? (
            group!.avatar_url ? <img src={group!.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" /> : <div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-500 text-white">{isChannel ? <ChannelIcon size={18} /> : <GroupIcon size={18} />}</div>
          ) : peer.avatar_url ? (
            <img src={peer.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm bg-blue-500 text-white">
              {(peer.display_name || peer.username || '?').slice(0, 2).toUpperCase()}
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate" style={{ color: 'var(--app-text)' }}>{headerName}</p>
            <p className="text-xs flex items-center gap-1" style={{ color: 'var(--app-text-muted)' }}>{headerSub} {!isSelfChat && !isGroupChat && <ShieldIcon size={11} style={{ color: 'var(--app-success)' }} />}</p>
          </div>
        </div>

        {!isSelfChat && !isGroupChat && (
          <>
            <button onClick={() => setShowGifts(true)} className="p-2 rounded-lg transition-all hover:bg-white/10" style={{ color: 'var(--app-accent)' }}><GiftIcon size={20} /></button>
            <button onClick={() => onCall(peer, 'audio')} className="p-2 rounded-lg transition-all hover:bg-white/10" style={{ color: 'var(--app-accent)' }}><PhoneIcon size={20} /></button>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2 scroll-smooth-touch">
        {loading ? (<div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--app-border)', borderTopColor: 'var(--app-accent)' }} /></div>) : messages.length === 0 ? (<div className="flex items-center justify-center h-64"><p className="text-sm" style={{ color: 'var(--app-text-muted)' }}>Нет сообщений</p></div>) : (
          <AnimatePresence initial={false}>
            {messages.map((msg) => {
              const isSent = msg.sender_id === user?.id;
              return (
                <motion.div key={msg.id} layout initial={{ opacity: 0, y: 12, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={springTransition} className={`flex ${isSent ? 'justify-end' : 'justify-start'} group relative`}>
                  <div className="relative max-w-[75%]">
                    {isGroupChat && !isSent && <p className="text-xs font-semibold ml-3 mb-0.5" style={{ color: 'var(--app-accent)' }}>{getSenderName(msg.sender_id)}</p>}
                    
                    {/* Долгое нажатие (или клик правой кнопкой) вызывает меню удаления/реакций */}
                    <div 
                      onContextMenu={(e) => { e.preventDefault(); setShowEmojiPicker(showEmojiPicker === msg.id ? null : msg.id); }}
                      className="rounded-2xl px-4 py-2.5 cursor-pointer transition-all hover:scale-[1.02] shadow-sm" 
                      style={{ background: isSent ? 'var(--app-accent-gradient)' : 'var(--app-surface)', color: isSent ? '#fff' : 'var(--app-text)', border: isSent ? 'none' : '1px solid var(--app-border)' }}
                    >
                      {msg.media_type === 'image' && msg.media_url && (<img src={msg.media_url} alt="" className="rounded-xl max-w-full max-h-64 mb-1" onClick={(e) => { e.stopPropagation(); setMediaPreview({ url: msg.media_url!, type: 'image' }); }} />)}
                      {msg.media_type === 'video' && msg.media_url && <video src={msg.media_url} controls className="rounded-xl max-w-full max-h-64 mb-1" />}
                      {msg.media_type === 'audio' && msg.media_url && <AudioPlayer url={msg.media_url} isSent={isSent} />}
                      {msg.content && <p className="break-words whitespace-pre-wrap">{msg.content}</p>}
                      <div className="flex items-center gap-1 mt-1"><span className="text-[10px] opacity-70">{formatTime(msg.created_at)}</span>{msg.disappearing && <TimerIcon size={12} className="opacity-70" />}</div>
                    </div>

                    {/* Меню действий с сообщением (появляется при клике) */}
                    {showEmojiPicker === msg.id && (
                      <div className={`absolute z-30 ${isSent ? 'right-0' : 'left-0'} top-full mt-1 flex gap-1 p-2 rounded-2xl border bg-[var(--app-surface)]`} style={{ borderColor: 'var(--app-border)' }}>
                        <button onClick={() => { setShowEmojiPicker(null); }} className="text-xl px-1">❤️</button>
                        <button onClick={() => { setShowEmojiPicker(null); }} className="text-xl px-1">👍</button>
                        {isSent && (
                          <button onClick={async () => { 
                            await supabase.from('messages').delete().eq('id', msg.id); 
                            setMessages(prev => prev.filter(m => m.id !== msg.id)); 
                            setShowEmojiPicker(null); 
                          }} className="text-red-500 px-1"><TrashIcon size={18} /></button>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
        <div ref={messagesEndRef} />
      </div>

      {sendError && <div className="mx-3 mb-1 text-xs rounded-xl p-2 border" style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)', color: '#ef4444' }}>{sendError}</div>}

      <div className="p-3 glass-nav border-t flex-shrink-0" style={{ borderColor: 'var(--app-border-glass)' }}>
        <form onSubmit={sendMessage} className="flex items-center gap-2">
          <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 rounded-lg transition-all hover:bg-white/10" style={{ color: 'var(--app-text-muted)' }}><ImageIcon size={20} /></button>
          <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={(e) => handleFileSelect(e, 'image')} />
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Введите сообщение..." className="flex-1 px-4 py-2.5 rounded-xl outline-none border" style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }} />
          {input.trim() ? (<motion.button type="submit" whileTap={{ scale: 0.9 }} className="p-2.5 rounded-xl text-white" style={{ background: 'var(--app-accent)' }}><SendIcon size={20} /></motion.button>) : (<button type="button" onMouseDown={startRecording} onMouseUp={stopRecording} className="p-2.5 rounded-xl text-white" style={{ background: recording ? 'var(--app-danger)' : 'var(--app-accent)' }}><MicIcon size={20} /></button>)}
        </form>
      </div>

      {/* МОДАЛЬНОЕ ОКНО ПРОФИЛЯ */}
      {showProfile && !isSelfChat && !isGroupChat && (
        <UserProfileModal profileId={peer.id} onClose={() => setShowProfile(false)} />
      )}

      {/* Модалка подарков (если нужна) */}
      {showGifts && <GiftsModal onClose={() => setShowGifts(false)} onSendGift={() => setShowGifts(false)} />}
    </div>
  );
}

// Плеер для голосовых в чате
const AudioPlayer = memo(function AudioPlayer({ url, isSent }: { url: string; isSent: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) audioRef.current.pause(); else audioRef.current.play();
    setPlaying(!playing);
  };

  const onTimeUpdate = () => {
    if (audioRef.current) { const p = (audioRef.current.currentTime / audioRef.current.duration) * 100; setProgress(p || 0); }
  };

  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      <button onClick={toggle} className="flex-shrink-0">{playing ? <PauseIcon size={20} /> : <PlayIcon size={20} />}</button>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: isSent ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.15)' }}><div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: isSent ? 'rgba(255,255,255,0.8)' : 'var(--app-accent)' }} /></div>
      <audio ref={audioRef} src={url} onEnded={() => { setPlaying(false); setProgress(0); }} onTimeUpdate={onTimeUpdate} />
    </div>
  );
});
