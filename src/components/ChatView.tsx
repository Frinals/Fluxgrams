import { useState, useEffect, useRef, useCallback, FormEvent, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, Profile, Message } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { encryptMessage, decryptMessage } from '@/lib/crypto';
import { BackIcon, SendIcon, MicIcon, ImageIcon, PhoneIcon, TimerIcon, PlayIcon, PauseIcon, BookmarkIcon, ShieldIcon, TrashIcon } from '@/components/Icons';

const EMOJIS = ['❤️', '👍', '😂', '🔥', '😮'];
const springTransition = { type: 'spring' as const, stiffness: 300, damping: 30 };

export default function ChatView({ chatId, peer, group, onBack, onCall }: any) {
  const { user } = useAuth();
  const isSelfChat = user ? peer?.id === user.id : false;
  const isGroupChat = group !== null;
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [reactions, setReactions] = useState<any>({});
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const decryptMessages = useCallback(async (msgs: Message[]): Promise<Message[]> => {
    if (!user || isSelfChat || isGroupChat) return msgs;
    return Promise.all(msgs.map(async (m) => {
      if (m.content && m.content.startsWith('enc:')) {
        try {
          const decrypted = await decryptMessage(m.content, user.id, peer.id);
          return { ...m, content: decrypted };
        } catch {
          return { ...m, content: '🔒 [Ошибка]' };
        }
      }
      return m;
    }));
  }, [user, peer?.id, isSelfChat, isGroupChat]);

  const loadMessages = useCallback(async () => {
    if (isGroupChat && group) {
      const { data } = await supabase.from('messages').select('*').eq('group_id', group.id).order('created_at', { ascending: true });
      if (data) setMessages(data as Message[]);
    } else if (chatId) {
      const { data } = await supabase.from('messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: true });
      if (data) {
        const decrypted = await decryptMessages(data as Message[]);
        setMessages(decrypted);
      }
    }
    setLoading(false);
  }, [chatId, group, isGroupChat, decryptMessages]);

  useEffect(() => {
    loadMessages();
    const channel = supabase.channel(chatId ? `chat:${chatId}` : `group:${group?.id}`)
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
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [chatId, group, isGroupChat, decryptMessages, loadMessages]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendMessage = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || !user) return;
    const plaintext = input.trim();
    setInput('');
    let contentToSend = plaintext;
    if (!isSelfChat && !isGroupChat) {
      try { contentToSend = await encryptMessage(plaintext, user.id, peer.id); } catch {}
    }
    const insertData: any = { sender_id: user.id, content: contentToSend };
    if (isGroupChat && group) insertData.group_id = group.id;
    else if (chatId) insertData.chat_id = chatId;

    const { data } = await supabase.from('messages').insert(insertData).select('*').maybeSingle();
    if (data) {
      const localMsg = { ...data as Message, content: plaintext };
      setMessages((prev) => prev.some(m => m.id === localMsg.id) ? prev : [...prev, localMsg]);
    }
  };

  const deleteMsg = async (id: string) => {
    await supabase.from('messages').delete().eq('id', id);
    setMessages(prev => prev.filter(m => m.id !== id));
    setShowEmojiPicker(null);
  };

  const headerName = isGroupChat ? group.name : (isSelfChat ? 'Избранное' : (peer?.display_name || 'User'));
  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex flex-col h-full relative">
      <div className="flex items-center gap-3 p-3 glass-nav border-b z-20 sticky top-0" style={{ borderColor: 'var(--app-border-glass)' }}>
        <button onClick={onBack} className="p-2"><BackIcon size={22} /></button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold bg-blue-500">{(headerName || 'U').slice(0,2).toUpperCase()}</div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate" style={{ color: 'var(--app-text)' }}>{headerName}</p>
            <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>@{peer?.username || '...'}</p>
          </div>
        </div>
        {!isSelfChat && !isGroupChat && <button onClick={() => onCall(peer, 'audio')} className="p-2" style={{ color: 'var(--app-accent)' }}><PhoneIcon size={20} /></button>}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {loading ? <p>Загрузка...</p> : messages.map((msg) => {
          const isSent = msg.sender_id === user?.id;
          return (
            <motion.div key={msg.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex ${isSent ? 'justify-end' : 'justify-start'} relative group`}>
              <div className="relative max-w-[75%]">
                <div 
                  onContextMenu={(e) => { e.preventDefault(); setShowEmojiPicker(showEmojiPicker === msg.id ? null : msg.id); }}
                  onClick={() => setShowEmojiPicker(showEmojiPicker === msg.id ? null : msg.id)}
                  className="rounded-2xl px-4 py-2.5 cursor-pointer shadow-sm" 
                  style={{ background: isSent ? 'var(--app-accent-gradient)' : 'var(--app-surface)', color: isSent ? '#fff' : 'var(--app-text)' }}
                >
                  {msg.content && <p className="break-words">{msg.content}</p>}
                  <span className="text-[10px] opacity-70 mt-1 block">{formatTime(msg.created_at)}</span>
                </div>
                {showEmojiPicker === msg.id && (
                  <div className={`absolute z-30 ${isSent ? 'right-0' : 'left-0'} top-full mt-1 flex gap-1 p-2 rounded-2xl border bg-[var(--app-surface)]`} style={{ borderColor: 'var(--app-border)' }}>
                    <button onClick={() => setShowEmojiPicker(null)} className="text-xl px-1">❤️</button>
                    <button onClick={() => setShowEmojiPicker(null)} className="text-xl px-1">👍</button>
                    {isSent && <button onClick={() => deleteMsg(msg.id)} className="text-red-500 px-1"><TrashIcon size={18} /></button>}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 glass-nav border-t flex gap-2">
        <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Сообщение..." className="flex-1 p-2 rounded-xl border bg-transparent" style={{ color: 'var(--app-text)' }} />
        <button onClick={sendMessage} className="p-2 rounded-xl text-white" style={{ background: 'var(--app-accent)' }}><SendIcon size={20} /></button>
      </div>
    </div>
  );
}
