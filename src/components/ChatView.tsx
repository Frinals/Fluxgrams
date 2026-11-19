import { useState, useEffect, useRef, useCallback, FormEvent, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, Profile, Message } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { UserProfileModal } from '@/components/UserProfileModal';
import { BackIcon, SendIcon, MicIcon, ImageIcon, PhoneIcon, TimerIcon, PlayIcon, PauseIcon, BookmarkIcon, ShieldIcon, TrashIcon } from '@/components/Icons';

const EMOJIS = ['❤️', '👍', '😂', '🔥', '😮'];
const springTransition = { type: 'spring' as const, stiffness: 400, damping: 30 };

export default function ChatView({ chatId, peer, group, onBack, onCall }: any) {
  const { user } = useAuth();
  const isSelfChat = user ? peer?.id === user.id : false;
  const isGroupChat = group !== null;
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async () => {
    if (isGroupChat && group) {
      const { data } = await supabase.from('messages').select('*').eq('group_id', group.id).order('created_at', { ascending: true });
      if (data) setMessages(data as Message[]);
    } else if (chatId) {
      const { data } = await supabase.from('messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: true });
      if (data) setMessages(data as Message[]);
    }
    setLoading(false);
  }, [chatId, group, isGroupChat]);

  useEffect(() => {
    loadMessages();
    
    // МГНОВЕННОЕ ОБНОВЛЕНИЕ СООБЩЕНИЙ
    const channel = supabase.channel(`chat_fast:${chatId || group?.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const newMsg = payload.new as Message;
        if (chatId && newMsg.chat_id !== chatId) return;
        if (group && newMsg.group_id !== group.id) return;
        
        setMessages((prev) => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg]);
      }).subscribe();
      
    return () => { supabase.removeChannel(channel); };
  }, [chatId, group, loadMessages]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendMessage = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || !user) return;
    const plaintext = input.trim();
    setInput('');
    
    const insertData: any = { sender_id: user.id, content: plaintext };
    if (isGroupChat && group) insertData.group_id = group.id;
    else if (chatId) insertData.chat_id = chatId;

    await supabase.from('messages').insert(insertData);
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
      <div className="flex items-center gap-3 p-4 glass-nav border-b z-20 sticky top-0" style={{ borderColor: 'var(--app-border-glass)' }}>
        <button onClick={onBack} className="p-2 rounded-full hover:bg-white/10 transition-colors"><BackIcon size={22} /></button>
        
        {/* КЛИК ПО НИКУ ОТКРЫВАЕТ ПРОФИЛЬ */}
        <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => { if (!isSelfChat && !isGroupChat) setShowProfile(true); }}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold bg-blue-500">{(headerName || 'U').slice(0,2).toUpperCase()}</div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate" style={{ color: 'var(--app-text)' }}>{headerName}</p>
            <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>@{peer?.username || '...'}</p>
          </div>
        </div>
        
        {!isSelfChat && !isGroupChat && <button onClick={() => onCall(peer, 'audio')} className="p-2 rounded-full hover:bg-white/10" style={{ color: 'var(--app-accent)' }}><PhoneIcon size={20} /></button>}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? <div className="flex justify-center p-10"><div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--app-accent)' }} /></div> : messages.map((msg) => {
          const isSent = msg.sender_id === user?.id;
          return (
            <motion.div key={msg.id} layout initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} className={`flex ${isSent ? 'justify-end' : 'justify-start'} relative group`}>
              <div className="relative max-w-[75%]">
                <div 
                  onContextMenu={(e) => { e.preventDefault(); setShowEmojiPicker(showEmojiPicker === msg.id ? null : msg.id); }}
                  onClick={() => setShowEmojiPicker(showEmojiPicker === msg.id ? null : msg.id)}
                  className="rounded-2xl px-4 py-2.5 cursor-pointer shadow-sm" 
                  style={{ background: isSent ? 'var(--app-accent)' : 'var(--app-surface)', color: isSent ? '#fff' : 'var(--app-text)', borderBottomRightRadius: isSent ? '4px' : '16px', borderBottomLeftRadius: !isSent ? '4px' : '16px' }}
                >
                  {msg.content && <p className="break-words text-[15px]">{msg.content}</p>}
                  <span className="text-[10px] opacity-60 mt-1 block text-right">{formatTime(msg.created_at)}</span>
                </div>
                {showEmojiPicker === msg.id && (
                  <div className={`absolute z-30 ${isSent ? 'right-0' : 'left-0'} top-full mt-1 flex gap-2 p-2 rounded-2xl border bg-[var(--app-surface)] shadow-xl`} style={{ borderColor: 'var(--app-border)' }}>
                    <button onClick={() => setShowEmojiPicker(null)} className="text-xl hover:scale-125 transition-transform">❤️</button>
                    <button onClick={() => setShowEmojiPicker(null)} className="text-xl hover:scale-125 transition-transform">👍</button>
                    {isSent && <button onClick={() => deleteMsg(msg.id)} className="text-red-500 px-1 hover:scale-125 transition-transform"><TrashIcon size={20} /></button>}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 glass-nav border-t flex gap-2" style={{ borderColor: 'var(--app-border-glass)' }}>
        <button className="p-2 rounded-full hover:bg-white/10" style={{ color: 'var(--app-text-muted)' }}><ImageIcon size={22} /></button>
        <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Сообщение..." className="flex-1 px-4 py-2.5 rounded-2xl outline-none border bg-transparent" style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }} />
        <motion.button whileTap={{ scale: 0.9 }} onClick={sendMessage} className="p-2.5 rounded-full text-white" style={{ background: 'var(--app-accent)' }}><SendIcon size={20} /></motion.button>
      </div>

      {showProfile && !isSelfChat && !isGroupChat && (
        <UserProfileModal profileId={peer.id} onClose={() => setShowProfile(false)} />
      )}
    </div>
  );
}
