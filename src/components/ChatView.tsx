import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { BackIcon, SendIcon, PhoneIcon, PaperclipIcon, ImageIcon, MusicIcon } from '@/components/Icons'; // Добавь ImageIcon и MusicIcon в свой Icons.tsx

export default function ChatView({ chatId, peer, group, onBack, onCall, onViewProfile }: any) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const imageInputRef = useRef<HTMLInputElement>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);

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
    if (data) setMessages(prev => prev.map(m => m.id === tempId ? data : m));
  };

  // Отправка медиафайлов (Фото/Музыка)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'audio') => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    e.target.value = ''; // Очищаем инпут, чтобы можно было выбрать тот же файл
    const fileName = `chat_media/${Date.now()}.${file.name.split('.').pop()}`;
    
    const { error } = await supabase.storage.from('media').upload(fileName, file);
    if (error) { alert('Ошибка загрузки: ' + error.message); return; }
    
    const { data } = supabase.storage.from('media').getPublicUrl(fileName);
    
    await supabase.from('messages').insert({ 
      sender_id: user.id, 
      content: file.name, 
      media_url: data.publicUrl, 
      media_type: type, // 'image' или 'audio'
      chat_id: chatId, 
      group_id: group?.id 
    });
  };

  return (
    <div className="flex flex-col h-[100dvh]" style={{ background: 'var(--app-bg)' }}>
      
      {/* ШАПКА ЧАТА (КАК НА 1 ФОТО) */}
      <div className="flex items-center justify-between px-2 py-2 border-b z-20 liquid-glass">
        <button onClick={onBack} className="p-2 rounded-full active:scale-90 transition-transform" style={{ color: 'var(--app-text)' }}>
          <BackIcon size={24} />
        </button>
        
        <div onClick={() => onViewProfile && onViewProfile(peer?.id)} className="flex flex-col items-center cursor-pointer">
          <div className="w-10 h-10 rounded-full overflow-hidden mb-1">
            {peer?.avatar_url ? <img src={peer.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-blue-500 flex items-center justify-center text-white font-bold">{(peer?.display_name || 'U')[0]}</div>}
          </div>
          <p className="font-semibold text-[15px] leading-tight" style={{ color: 'var(--app-text)' }}>{peer?.display_name}</p>
          <p className="text-[10px] text-green-500">в сети</p>
        </div>
        
        <button onClick={() => onCall && onCall(peer)} className="p-2 rounded-full active:scale-90 transition-transform" style={{ color: 'var(--app-accent)' }}>
          <PhoneIcon size={22} />
        </button>
      </div>

      {/* ЛЕНТА СООБЩЕНИЙ С ПАУТИНОЙ */}
      <div className="flex-1 overflow-y-auto p-4 relative">
        
        <div className="chat-cobweb-overlay">
          <div className="cobweb cobweb-top-left"></div>
          <div className="cobweb cobweb-top-right"></div>
        </div>

        <div className="flex flex-col gap-2 relative z-10">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
              <div 
                className="max-w-[80%] rounded-2xl px-4 py-2 shadow-sm" 
                style={{ background: msg.sender_id === user?.id ? 'var(--app-accent)' : 'var(--app-surface)', color: msg.sender_id === user?.id ? '#fff' : 'var(--app-text)' }}
              >
                {/* Отображение картинок и музыки */}
                {msg.media_type === 'image' && msg.media_url && (
                  <img src={msg.media_url} className="rounded-xl max-w-full max-h-60 mb-2 object-cover" />
                )}
                {msg.media_type === 'audio' && msg.media_url && (
                  <audio controls src={msg.media_url} className="mb-2 w-48" />
                )}
                <p className="break-words text-[15px]">{msg.content}</p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ПАНЕЛЬ ВВОДА (ЖИДКОЕ СТЕКЛО) */}
      <div className="p-2 pb-safe liquid-glass flex items-center gap-2">
        <button onClick={() => imageInputRef.current?.click()} className="p-2 rounded-full active:scale-90 transition-transform" style={{ color: 'var(--app-text-muted)' }}>
          <ImageIcon size={24} />
        </button>
        <input type="file" ref={imageInputRef} hidden accept="image/*" onChange={(e) => handleFileUpload(e, 'image')} />

        <button onClick={() => musicInputRef.current?.click()} className="p-2 rounded-full active:scale-90 transition-transform" style={{ color: 'var(--app-text-muted)' }}>
          <MusicIcon size={24} />
        </button>
        <input type="file" ref={musicInputRef} hidden accept="audio/*" onChange={(e) => handleFileUpload(e, 'audio')} />

        <input type="text" value={input} onChange={e => setInput(e.target.value)} placeholder="Сообщение..." className="flex-1 px-4 py-2.5 rounded-2xl outline-none" style={{ background: 'rgba(0,0,0,0.2)', color: 'var(--app-text)' }} />
        
        <button onClick={handleSend} className="p-2.5 rounded-full text-white active:scale-90 transition-transform" style={{ background: 'var(--app-accent)' }}>
          <SendIcon size={20} />
        </button>
      </div>
    </div>
  );
}
