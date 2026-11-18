import { useState, useEffect, useRef, useCallback, FormEvent, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, Profile, Message } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { BackIcon, SendIcon, MicIcon, ImageIcon, PhoneIcon, TimerIcon, PlayIcon, PauseIcon, BookmarkIcon, ShieldIcon } from '@/components/Icons';

export default function ChatView({ chatId, peer, group, onBack, onCall }: any) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async () => {
    if (!chatId) return;
    const { data } = await supabase.from('messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: true });
    if (data) setMessages(data as Message[]);
    setLoading(false);
  }, [chatId]);

  useEffect(() => {
    loadMessages();
    const channel = supabase.channel(`chat:${chatId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
      if (payload.new.chat_id === chatId) {
        setMessages((prev) => [...prev, payload.new as Message]);
      }
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [chatId, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || !user || !chatId) return;
    const plaintext = input.trim();
    setInput('');
    await supabase.from('messages').insert({ sender_id: user.id, chat_id: chatId, content: plaintext });
  };

  return (
    <div className="flex flex-col h-full relative">
      <div className="flex items-center gap-3 p-3 glass-nav border-b z-20 sticky top-0 flex-shrink-0">
        <button onClick={onBack} className="p-2"><BackIcon size={22} /></button>
        
        {/* ВРЕМЕННО: При клике просто показывает имя. В будущем тут будет профиль */}
        <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => alert(`Профиль: ${peer?.display_name || 'User'}`)}>
          <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">{(peer?.display_name || 'U').slice(0,2)}</div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate" style={{ color: 'var(--app-text)' }}>{peer?.display_name || 'User'}</p>
            <p className="text-xs flex items-center gap-1" style={{ color: 'var(--app-text-muted)' }}>@{peer?.username} <ShieldIcon size={11} /></p>
          </div>
        </div>

        <button onClick={() => onCall(peer, 'audio')} className="p-2" style={{ color: 'var(--app-accent)' }}><PhoneIcon size={20} /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {loading ? <p>Загрузка...</p> : messages.map((msg) => {
          const isSent = msg.sender_id === user?.id;
          return (
            <div key={msg.id} className={`flex ${isSent ? 'justify-end' : 'justify-start'}`}>
              <div className="rounded-2xl px-4 py-2.5 max-w-[75%]" style={{ background: isSent ? 'var(--app-accent)' : 'var(--app-surface)', color: isSent ? '#fff' : 'var(--app-text)' }}>
                {msg.content && <p className="break-words">{msg.content}</p>}
                <span className="text-[10px] opacity-70 block mt-1">{new Date(msg.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 glass-nav border-t flex gap-2">
        <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Введите сообщение..." className="flex-1 p-2 rounded-xl border bg-transparent" style={{ color: 'var(--app-text)' }} />
        <button onClick={sendMessage} className="p-2 rounded-xl text-white" style={{ background: 'var(--app-accent)' }}><SendIcon size={20} /></button>
      </div>
    </div>
  );
}
