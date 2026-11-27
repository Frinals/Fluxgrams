import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { BackIcon, SendIcon, PhoneIcon, ImageIcon, MusicIcon, TrashIcon, EditIcon } from '@/components/Icons';

export default function ChatView({ chatId, peer, group, onBack, onCall, onViewProfile }: any) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [selectedMsg, setSelectedMsg] = useState<any | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const imageInputRef = useRef<HTMLInputElement>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);

  const loadMessages = useCallback(async () => {
    const query = supabase.from('messages').select('*').order('created_at', { ascending: true }).limit(100);
    if (chatId) query.eq('chat_id', chatId);
    if (group) query.eq('group_id', group.id);
    const { data } = await query;
    
    if (data) {
      // Фильтруем те, что мы удалили у себя
      const visibleMsgs = data.filter(m => !m.deleted_for?.includes(user?.id));
      setMessages(visibleMsgs);
    }
  }, [chatId, group, user]);

  useEffect(() => {
    loadMessages();
    const channel = supabase.channel(`chat_${chatId || group?.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setMessages(prev => prev.some(m => m.id === payload.new.id) ? prev : [...prev, payload.new]);
        }
        if (payload.eventType === 'UPDATE') {
          if (payload.new.is_deleted) {
            setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, is_deleted: true, content: 'Сообщение удалено', media_url: null } : m));
          } else {
            setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m));
          }
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
    
    if (isEditing && selectedMsg) {
      await supabase.from('messages').update({ content: text }).eq('id', selectedMsg.id);
      setIsEditing(false); setSelectedMsg(null);
      return;
    }

    const tempId = `temp-${Date.now()}`;
    setMessages(prev => [...prev, { id: tempId, sender_id: user.id, content: text, created_at: new Date().toISOString() }]);
    
    const { data } = await supabase.from('messages').insert({ sender_id: user.id, content: text, chat_id: chatId, group_id: group?.id }).select().single();
    if (data) setMessages(prev => prev.map(m => m.id === tempId ? data : m));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'audio') => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    e.target.value = ''; 
    const fileName = `chat_media/${Date.now()}.${file.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('media').upload(fileName, file);
    if (error) { alert('Ошибка загрузки: ' + error.message); return; }
    const { data } = supabase.storage.from('media').getPublicUrl(fileName);
    
    await supabase.from('messages').insert({ sender_id: user.id, content: file.name, media_url: data.publicUrl, media_type: type, chat_id: chatId, group_id: group?.id });
  };

  // УДАЛЕНИЕ У СЕБЯ
  const deleteForMe = async () => {
    if (!selectedMsg || !user) return;
    const currentDeletedFor = selectedMsg.deleted_for || [];
    await supabase.from('messages').update({ deleted_for: [...currentDeletedFor, user.id] }).eq('id', selectedMsg.id);
    setMessages(prev => prev.filter(m => m.id !== selectedMsg.id)); // Мгновенно скрываем
    setSelectedMsg(null);
  };

  // УДАЛЕНИЕ У ВСЕХ
  const deleteForEveryone = async () => {
    if (!selectedMsg) return;
    await supabase.from('messages').update({ is_deleted: true, content: 'Сообщение удалено', media_url: null }).eq('id', selectedMsg.id);
    setSelectedMsg(null);
  };

  return (
    <div className="flex flex-col h-[100dvh]" style={{ background: 'var(--app-bg)' }}>
      
      <div className="flex items-center justify-between px-2 py-2 border-b z-20 liquid-glass">
        <button onClick={onBack} className="p-2 rounded-full active:scale-90 transition-transform" style={{ color: 'var(--app-text)' }}><BackIcon size={24} /></button>
        <div onClick={() => onViewProfile && onViewProfile(peer?.id)} className="flex flex-col items-center cursor-pointer">
          <div className="w-10 h-10 rounded-full overflow-hidden mb-1">
            {peer?.avatar_url ? <img src={peer.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-blue-500 flex items-center justify-center text-white font-bold">{(peer?.display_name || 'U')[0]}</div>}
          </div>
          <p className="font-semibold text-[15px] leading-tight" style={{ color: 'var(--app-text)' }}>{peer?.display_name}</p>
        </div>
        <button onClick={() => onCall && onCall(peer)} className="p-2 rounded-full active:scale-90 transition-transform" style={{ color: 'var(--app-accent)' }}><PhoneIcon size={22} /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 relative">
        <div className="flex flex-col gap-2 relative z-10">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
              <div 
                onClick={() => { if (!msg.is_deleted) setSelectedMsg(msg); }}
                className={`max-w-[80%] rounded-2xl px-4 py-2 shadow-sm ${msg.is_deleted ? 'italic opacity-50' : ''}`}
                style={{ background: msg.sender_id === user?.id ? 'var(--app-accent)' : 'var(--app-surface)', color: msg.sender_id === user?.id ? '#fff' : 'var(--app-text)' }}
              >
                {msg.media_type === 'image' && msg.media_url && <img src={msg.media_url} className="rounded-xl max-w-full max-h-60 mb-2 object-cover" />}
                {msg.media_type === 'audio' && msg.media_url && <audio controls src={msg.media_url} className="mb-2 w-48" />}
                <p className="break-words text-[15px]">{msg.content}</p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* МЕНЮ ДЕЙСТВИЙ С СООБЩЕНИЕМ */}
      <AnimatePresence>
        {selectedMsg && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedMsg(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="rounded-3xl p-2 w-full max-w-xs liquid-glass overflow-hidden" onClick={e => e.stopPropagation()}>
              
              {selectedMsg.sender_id === user?.id && (
                <button onClick={() => { setIsEditing(true); setInput(selectedMsg.content); setSelectedMsg(null); }} className="w-full flex items-center gap-3 p-4 text-white hover:bg-white/10 rounded-2xl">
                  <EditIcon size={20} /> <span className="font-semibold">Изменить</span>
                </button>
              )}

              <button onClick={deleteForMe} className="w-full flex items-center gap-3 p-4 text-red-500 hover:bg-white/10 rounded-2xl">
                <TrashIcon size={20} /> <span className="font-semibold">Удалить у себя</span>
              </button>

              {selectedMsg.sender_id === user?.id && (
                <button onClick={deleteForEveryone} className="w-full flex items-center gap-3 p-4 text-red-600 hover:bg-white/10 rounded-2xl">
                  <TrashIcon size={20} /> <span className="font-semibold">Удалить у всех</span>
                </button>
              )}

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-2 pb-safe liquid-glass flex items-center gap-2">
        <button onClick={() => imageInputRef.current?.click()} className="p-2 rounded-full active:scale-90" style={{ color: 'var(--app-text-muted)' }}><ImageIcon size={24} /></button>
        <input type="file" ref={imageInputRef} hidden accept="image/*" onChange={(e) => handleFileUpload(e, 'image')} />

        <button onClick={() => musicInputRef.current?.click()} className="p-2 rounded-full active:scale-90" style={{ color: 'var(--app-text-muted)' }}><MusicIcon size={24} /></button>
        <input type="file" ref={musicInputRef} hidden accept="audio/*" onChange={(e) => handleFileUpload(e, 'audio')} />

        <input type="text" value={input} onChange={e => setInput(e.target.value)} placeholder="Сообщение..." className="flex-1 px-4 py-2.5 rounded-2xl outline-none" style={{ background: 'rgba(0,0,0,0.2)', color: 'var(--app-text)' }} />
        
        <button onClick={handleSend} className="p-2.5 rounded-full text-white active:scale-90" style={{ background: 'var(--app-accent)' }}><SendIcon size={20} /></button>
      </div>
    </div>
  );
}
