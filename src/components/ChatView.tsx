import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { BackIcon, SendIcon, PhoneIcon, PaperclipIcon, VerifiedIcon } from '@/components/Icons';

export default function ChatView({ chatId, peer, group, onBack, onCall, onViewProfile }: any) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [selectedMsg, setSelectedMsg] = useState<any | null>(null);
  const [isEditing, setIsEditing] = useState(false);
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
          setMessages(prev => {
            // ЗАЩИТА ОТ ДУБЛИКАТОВ
            if (prev.some(m => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
        }
        if (payload.eventType === 'UPDATE') setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m));
        if (payload.eventType === 'DELETE') setMessages(prev => prev.filter(m => m.id !== payload.old.id));
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadMessages]);

  // Автоскролл вниз при новом сообщении
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !user) return;
    const textToSend = input;
    setInput(''); 

    if (isEditing && selectedMsg) {
      await supabase.from('messages').update({ content: textToSend }).eq('id', selectedMsg.id);
      setIsEditing(false); setSelectedMsg(null);
    } else {
      // Временно показываем сообщение (оптимистичный UI)
      const tempId = `temp-${Date.now()}`;
      const newMsg = { id: tempId, sender_id: user.id, content: textToSend, created_at: new Date().toISOString(), chat_id: chatId };
      setMessages(prev => [...prev, newMsg]);

      // Отправляем в базу
      const { data, error } = await supabase.from('messages').insert({ sender_id: user.id, content: textToSend, chat_id: chatId, group_id: group?.id }).select().single();
      
      // Заменяем временное сообщение на настоящее, если сервер ответил успешно
      if (data && !error) {
        setMessages(prev => {
          const filtered = prev.filter(m => m.id !== tempId); 
          if (filtered.some(m => m.id === data.id)) return filtered; 
          return [...filtered, data];
        });
      }
    }
  };

  return (
    // ДОБАВЛЕН КЛАСС chat-bg-cobweb ДЛЯ ПАУТИНЫ
    <div className="flex flex-col h-[100dvh] chat-bg-cobweb" style={{ background: 'var(--app-bg)' }}>
      
      {/* Шапка чата */}
      <div className="flex items-center gap-3 p-3 border-b z-20" style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
        <button onClick={onBack} className="p-2" style={{ color: 'var(--app-text)' }}><BackIcon size={22} /></button>
        
        <div onClick={() => onViewProfile && onViewProfile(peer?.id)} className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
          {peer?.avatar_url ? <img src={peer.avatar_url} className="w-10 h-10 rounded-full object-cover" /> : <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{ background: 'var(--app-accent)' }}>{(peer?.display_name || 'U')[0]}</div>}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <p className="font-semibold truncate" style={{ color: 'var(--app-text)' }}>{group ? group.name : peer?.display_name}</p>
              {peer?.is_verified && <VerifiedIcon size={16} className="text-blue-500" />}
            </div>
          </div>
        </div>
        
        {!group && <button onClick={() => onCall && onCall(peer, 'audio')} className="p-2" style={{ color: 'var(--app-accent)' }}><PhoneIcon size={20} /></button>}
      </div>

      {/* Лента сообщений */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
            <div onClick={() => setSelectedMsg(msg)} className="max-w-[80%] rounded-2xl px-4 py-2 cursor-pointer shadow-sm" style={{ background: msg.sender_id === user?.id ? 'var(--app-accent)' : 'var(--app-surface)', color: msg.sender_id === user?.id ? '#fff' : 'var(--app-text)' }}>
              <p className="break-words text-[15px]">{msg.content}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Поле ввода */}
      <div className="p-2 border-t flex items-center gap-2 pb-safe" style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
        <button className="p-2" style={{ color: 'var(--app-text-muted)' }}><PaperclipIcon size={24} /></button>
        <input type="text" value={input} onChange={e => setInput(e.target.value)} placeholder="Сообщение..." className="flex-1 px-4 py-2.5 rounded-2xl outline-none border" style={{ background: 'var(--app-bg)', color: 'var(--app-text)', borderColor: 'var(--app-border)' }} />
        <button onClick={handleSend} className="p-2.5 rounded-full text-white" style={{ background: 'var(--app-accent)' }}><SendIcon size={20} /></button>
      </div>
    </div>
  );
        }
