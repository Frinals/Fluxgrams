import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { BackIcon, SendIcon, PhoneIcon, PaperclipIcon, VerifiedIcon } from '@/components/Icons';

export default function ChatView({ chatId, peer, group, onBack, onCall, onViewProfile }: any) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async () => {
    const query = supabase.from('messages').select('*').order('created_at', { ascending: true }).limit(100);
    if (chatId) query.eq('chat_id', chatId);
    if (group) query.eq('group_id', group.id);
    const { data } = await query;
    if (data) setMessages(data);
  }, [chatId, group]);

  useEffect(() => {
    loadMessages();
    const channel = supabase.channel(`chat_${chatId || group?.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setMessages(prev => prev.some(m => m.id === payload.new.id) ? prev : [...prev, payload.new]);
        }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !user) return;
    const text = input;
    setInput('');
    const tempId = `temp-${Date.now()}`;
    setMessages(prev => [...prev, { id: tempId, sender_id: user.id, content: text, created_at: new Date().toISOString() }]);
    
    const { data } = await supabase.from('messages').insert({ sender_id: user.id, content: text, chat_id: chatId, group_id: group?.id }).select().single();
    if (data) {
      setMessages(prev => prev.map(m => m.id === tempId ? data : m));
    }
  };

  return (
    <div className="flex flex-col h-[100dvh]" style={{ background: 'var(--app-bg)' }}>
      
      <div className="flex items-center gap-3 p-3 border-b z-20 liquid-glass">
        <button onClick={onBack} className="p-2" style={{ color: 'var(--app-text)' }}><BackIcon size={22} /></button>
        
        <div onClick={() => onViewProfile && onViewProfile(peer?.id)} className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
          {peer?.avatar_url ? <img src={peer.avatar_url} className="w-10 h-10 rounded-full object-cover" /> : <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">{(peer?.display_name || 'U')[0]}</div>}
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate" style={{ color: 'var(--app-text)' }}>{peer?.display_name}</p>
          </div>
        </div>
        
        <button onClick={() => onCall && onCall(peer)} className="p-2" style={{ color: 'var(--app-accent)' }}><PhoneIcon size={20} /></button>
      </div>

      {/* Контейнер с сообщениями и паутиной */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 relative">
        
        {/* ПАУТИНА (появится только в теме Хэллоуин) */}
        <div className="chat-cobweb-overlay">
          <div className="cobweb-corner cobweb-top-left"></div>
          <div className="cobweb-corner cobweb-top-right"></div>
        </div>

        {/* Сообщения */}
        <div className="relative z-10 flex flex-col gap-2">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-[80%] rounded-2xl px-4 py-2 shadow-sm liquid-glass" style={{ background: msg.sender_id === user?.id ? 'var(--app-accent)' : 'var(--app-surface)', color: msg.sender_id === user?.id ? '#fff' : 'var(--app-text)' }}>
                <p className="break-words text-[15px]">{msg.content}</p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="p-2 border-t flex items-center gap-2 pb-safe liquid-glass">
        <button className="p-2" style={{ color: 'var(--app-text-muted)' }}><PaperclipIcon size={24} /></button>
        <input type="text" value={input} onChange={e => setInput(e.target.value)} placeholder="Сообщение..." className="flex-1 px-4 py-2.5 rounded-2xl outline-none border liquid-glass" style={{ background: 'rgba(0,0,0,0.2)', color: 'var(--app-text)', borderColor: 'var(--app-border)' }} />
        <button onClick={handleSend} className="p-2.5 rounded-full text-white liquid-glass" style={{ background: 'var(--app-accent)' }}><SendIcon size={20} /></button>
      </div>
    </div>
  );
      }
