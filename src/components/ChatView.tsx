import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { BackIcon, SendIcon, TrashIcon, PhoneIcon, ImageIcon } from '@/components/Icons';
import { UserProfileModal } from '@/components/UserProfileModal';

export default function ChatView({ chatId, peer, onBack, onCall }: any) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('messages').select('*').eq('chat_id', chatId).order('created_at');
      if (data) setMessages(data);
    };
    fetch();

    const sub = supabase.channel(`chat_${chatId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, payload => {
      setMessages(prev => [...prev, payload.new]);
    }).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [chatId]);

  const send = async () => {
    if (!input.trim()) return;
    await supabase.from('messages').insert({ chat_id: chatId, sender_id: user?.id, content: input });
    setInput('');
  };

  const deleteMsg = async (id: string) => {
    await supabase.from('messages').delete().eq('id', id);
    setMessages(prev => prev.filter(m => m.id !== id));
    setSelectedMsg(null);
  };

  return (
    <div className="flex flex-col h-full relative" style={{ background: 'var(--app-bg)' }}>
      <div className="flex items-center gap-3 p-3 glass-nav border-b z-20 sticky top-0">
        <button onClick={onBack}><BackIcon size={22} /></button>
        <div className="flex-1 cursor-pointer" onClick={() => setShowProfile(true)}>
          <p className="font-bold" style={{ color: 'var(--app-text)' }}>{peer.display_name || peer.username}</p>
          <p className="text-xs text-green-500">@ {peer.username}</p>
        </div>
        <button onClick={() => onCall(peer, 'audio')}><PhoneIcon size={22} /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
            <div 
              onContextMenu={(e) => { e.preventDefault(); setSelectedMsg(m.id); }}
              onDoubleClick={() => setSelectedMsg(m.id)}
              className="p-3 rounded-2xl max-w-[80%] cursor-pointer"
              style={{ background: m.sender_id === user?.id ? 'var(--app-accent)' : 'var(--app-surface)', color: m.sender_id === user?.id ? '#fff' : 'var(--app-text)' }}
            >
              {m.content}
            </div>
          </div>
        ))}
      </div>

      {/* Меню действия с сообщением */}
      <AnimatePresence>
        {selectedMsg && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setSelectedMsg(null)}>
            <div className="glass-panel p-4 rounded-2xl flex gap-4" onClick={e => e.stopPropagation()}>
              <button onClick={() => deleteMsg(selectedMsg)} className="flex flex-col items-center gap-1 text-red-500"><TrashIcon size={20} /> Удалить</button>
              <button onClick={() => setSelectedMsg(null)} className="flex flex-col items-center gap-1 text-blue-500">❤️ Реакция</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-3 glass-nav border-t flex gap-2">
        <button><ImageIcon size={24} /></button>
        <input value={input} onChange={e => setInput(e.target.value)} className="flex-1 p-2 rounded-xl border bg-transparent" style={{ color: 'var(--app-text)' }} placeholder="Текст..." />
        <button onClick={send} className="p-2 rounded-xl bg-blue-500 text-white"><SendIcon size={20} /></button>
      </div>

      <AnimatePresence>
        {showProfile && <UserProfileModal profileId={peer.id} onClose={() => setShowProfile(false)} />}
      </AnimatePresence>
    </div>
  );
}
