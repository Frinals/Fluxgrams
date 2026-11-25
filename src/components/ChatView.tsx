import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, Profile } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { BackIcon, SendIcon, PhoneIcon, PaperclipIcon, ImageIcon, PlayIcon, PauseIcon, XIcon, TrashIcon, MusicIcon } from '@/components/Icons';

export default function ChatView({ chatId, peer, group, onBack, onCall }: any) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [selectedMsg, setSelectedMsg] = useState<any | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  
  const [currentAudio, setCurrentAudio] = useState<any | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showFullPlayer, setShowFullPlayer] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        if (payload.eventType === 'INSERT') setMessages(prev => [...prev, payload.new]);
        if (payload.eventType === 'UPDATE') setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m));
        if (payload.eventType === 'DELETE') setMessages(prev => prev.filter(m => m.id !== payload.old.id));
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadMessages]);

  const handleSend = async () => {
    if (!input.trim() || !user) return;
    if (isEditing && selectedMsg) {
      await supabase.from('messages').update({ content: input }).eq('id', selectedMsg.id);
      setIsEditing(false); setSelectedMsg(null);
    } else {
      await supabase.from('messages').insert({ sender_id: user.id, content: input, chat_id: chatId, group_id: group?.id });
    }
    setInput('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'file') => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const fileName = `chats/${Date.now()}.${file.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('media').upload(fileName, file);
    if (error) return alert(error.message);
    const { data } = await supabase.storage.from('media').getPublicUrl(fileName);
    await supabase.from('messages').insert({ sender_id: user.id, media_url: data.publicUrl, media_type: type === 'image' ? 'image' : 'file', content: file.name, chat_id: chatId, group_id: group?.id });
    setShowAttach(false);
  };

  return (
    <div className="flex flex-col h-full bg-[#0f1115] relative">
      <div className="flex items-center gap-3 p-4 bg-[#1a1a1a] border-b border-white/10 z-20 sticky top-0">
        <button onClick={onBack} className="p-2 text-white"><BackIcon size={22} /></button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {peer?.avatar_url ? <img src={peer.avatar_url} className="w-10 h-10 rounded-full object-cover" /> : <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold bg-blue-500">{(peer?.display_name || 'U')[0]}</div>}
          <div className="flex-1 min-w-0"><p className="font-semibold truncate text-white">{group ? group.name : peer?.display_name}</p></div>
        </div>
        {!group && <button onClick={() => onCall && onCall(peer, 'audio')} className="p-2 text-blue-500"><PhoneIcon size={20} /></button>}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
            <div onClick={() => setSelectedMsg(msg)} className="max-w-[75%] rounded-2xl px-4 py-2 cursor-pointer shadow-sm" style={{ background: msg.sender_id === user?.id ? 'var(--app-accent)' : '#1a1a1a', color: 'white' }}>
              {msg.media_type === 'image' && msg.media_url && <img src={msg.media_url} className="rounded-xl max-w-full max-h-64 mb-1" />}
              {msg.media_type === 'file' && msg.media_url && <a href={msg.media_url} target="_blank" rel="noreferrer" className="underline text-sm block mb-1">📄 {msg.content}</a>}
              {msg.content && msg.media_type !== 'file' && <p className="break-words text-[15px]">{msg.content}</p>}
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {selectedMsg && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedMsg(null)}>
            <div className="bg-[#1a1a1a] p-4 rounded-2xl w-full max-w-sm space-y-4 border border-white/10" onClick={e => e.stopPropagation()}>
              {selectedMsg.sender_id === user?.id && (
                <>
                  <button onClick={() => { setIsEditing(true); setInput(selectedMsg.content); setSelectedMsg(null); }} className="w-full text-left py-2 text-white font-medium">Изменить</button>
                  <button onClick={async () => { await supabase.from('messages').update({ content: 'Сообщение удалено' }).eq('id', selectedMsg.id); setSelectedMsg(null); }} className="w-full text-left py-2 text-red-500 font-medium">Удалить</button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-3 bg-[#1a1a1a] border-t border-white/10 flex items-center gap-2">
        <button onClick={() => setShowAttach(!showAttach)} className="p-2 text-gray-400"><PaperclipIcon size={24} /></button>
        <input type="file" ref={galleryInputRef} hidden accept="image/*" onChange={(e) => handleFileUpload(e, 'image')} />
        <input type="file" ref={fileInputRef} hidden onChange={(e) => handleFileUpload(e, 'file')} />
        
        <input type="text" value={input} onChange={e => setInput(e.target.value)} placeholder="Сообщение..." className="flex-1 px-4 py-2.5 rounded-2xl bg-[#0f1115] text-white border border-white/10 outline-none" />
        <button onClick={handleSend} className="p-2.5 rounded-full bg-blue-500 text-white"><SendIcon size={20} /></button>
      </div>
    </div>
  );
}
<div
  className="flex-1 overflow-y-auto p-4"
  style={{ background: 'var(--app-bg-gradient)' }}
>
