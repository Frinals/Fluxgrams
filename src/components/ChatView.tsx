// ... импорты те же, что и в прошлом сообщении (с PaperclipIcon, PlayIcon и т.д.)
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, Profile, Message } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { BackIcon, SendIcon, PhoneIcon, PaperclipIcon, ImageIcon, PlayIcon, PauseIcon, MusicIcon, XIcon, TrashIcon } from '@/components/Icons';

export default function ChatView({ chatId, peer, group, onBack, onCall }: any) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [selectedMsg, setSelectedMsg] = useState<any | null>(null); // Для меню действий
  const [isEditing, setIsEditing] = useState(false); // Режим редактирования
  
  const [currentAudio, setCurrentAudio] = useState<any | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showFullPlayer, setShowFullPlayer] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Загрузка сообщений и realtime (стандартный код)
  const loadMessages = useCallback(async () => {
    if (!chatId && !group) return;
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
        if (payload.eventType === 'INSERT') setMessages(prev => [...prev, payload.new]);
        if (payload.eventType === 'UPDATE') setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m));
        if (payload.eventType === 'DELETE') setMessages(prev => prev.filter(m => m.id !== payload.old.id));
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadMessages]);

  const sendMessage = async () => {
    if (!input.trim() || !user) return;
    if (isEditing && selectedMsg) {
      await supabase.from('messages').update({ content: input }).eq('id', selectedMsg.id);
      setIsEditing(false);
      setSelectedMsg(null);
    } else {
      await supabase.from('messages').insert({ sender_id: user.id, content: input, chat_id: chatId, group_id: group?.id });
    }
    setInput('');
  };

  // Меню действий (долгое нажатие)
  const handleLongPress = (msg: any) => {
    setSelectedMsg(msg);
  };

  const deleteMsg = async (forEveryone: boolean) => {
    if (forEveryone) {
      await supabase.from('messages').update({ content: 'Сообщение удалено' }).eq('id', selectedMsg.id);
    } else {
      // В реальном приложении тут нужна таблица скрытых сообщений, но для простоты просто убираем у себя
      setMessages(prev => prev.filter(m => m.id !== selectedMsg.id));
    }
    setSelectedMsg(null);
  };

  return (
    <div className="flex flex-col h-full bg-[#0f1115] relative">
      {/* Шапка и Мини-плеер (как в прошлом коде) ... */}
      
      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
            <div 
              onContextMenu={(e) => { e.preventDefault(); handleLongPress(msg); }}
              onClick={() => handleLongPress(msg)}
              className="max-w-[75%] rounded-2xl px-4 py-2 cursor-pointer shadow-sm"
              style={{ background: msg.sender_id === user?.id ? 'var(--app-accent)' : 'var(--app-surface)', color: msg.sender_id === user?.id ? '#fff' : 'var(--app-text)' }}
            >
              <p className="break-words text-[15px]">{msg.content}</p>
            </div>
          </div>
        ))}
      </div>

      {/* МЕНЮ ДЕЙСТВИЙ С СООБЩЕНИЕМ */}
      <AnimatePresence>
        {selectedMsg && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedMsg(null)}>
            <div className="bg-[#1a1a1a] p-4 rounded-2xl w-full max-w-sm space-y-4 border border-white/10" onClick={e => e.stopPropagation()}>
              <div className="flex justify-center gap-4 text-2xl pb-4 border-b border-white/10">
                <button onClick={() => { /* логика реакций */ }}>❤️</button>
                <button onClick={() => { /* логика реакций */ }}>👍</button>
                <button onClick={() => { /* логика реакций */ }}>🔥</button>
              </div>
              
              {selectedMsg.sender_id === user?.id && (
                <>
                  <button onClick={() => { setIsEditing(true); setInput(selectedMsg.content); setSelectedMsg(null); }} className="w-full text-left py-2 text-white">Изменить</button>
                  <button onClick={() => deleteMsg(true)} className="w-full text-left py-2 text-red-500">Удалить у всех</button>
                </>
              )}
              <button onClick={() => deleteMsg(false)} className="w-full text-left py-2 text-gray-400">Удалить у себя</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Панель ввода (со скрепкой и редактированием) */}
      <div className="p-3 bg-[#1a1a1a] border-t border-white/10 flex items-center gap-2">
        {isEditing && <button onClick={() => { setIsEditing(false); setInput(''); }} className="text-red-500"><XIcon size={20} /></button>}
        
        <button onClick={() => galleryInputRef.current?.click()} className="p-2 text-gray-400"><PaperclipIcon size={24} /></button>
        <input type="file" ref={galleryInputRef} hidden accept="image/*" />
        
        <input 
          type="text" value={input} onChange={e => setInput(e.target.value)} 
          placeholder={isEditing ? "Редактировать..." : "Сообщение..."} 
          className="flex-1 px-4 py-2.5 rounded-2xl bg-[#0f1115] text-white border border-white/10 outline-none" 
        />
        
        <button onClick={sendMessage} className="p-2.5 rounded-full bg-blue-500 text-white"><SendIcon size={20} /></button>
      </div>
    </div>
  );
}
