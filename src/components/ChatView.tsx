import { useState, useEffect, useRef, useCallback, FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, Profile, Message } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import UserProfileModal from '@/components/UserProfileModal';
import { 
  BackIcon, SendIcon, PhoneIcon, TrashIcon, PaperclipIcon, 
  ImageIcon, PlayIcon, PauseIcon, MusicIcon, XIcon 
} from '@/components/Icons';

export default function ChatView({ chatId, peer, group, onBack, onCall }: any) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isSelfChat = user ? peer?.id === user.id : false;
  const isGroupChat = group !== null;
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Стейты для аудиоплеера
  const [currentAudio, setCurrentAudio] = useState<{ url: string, id: string } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showFullPlayer, setShowFullPlayer] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Скрытые инпуты для файлов
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadMessages = useCallback(async () => {
    if (isGroupChat && group) {
      const { data } = await supabase.from('messages').select('*').eq('group_id', group.id).order('created_at', { ascending: true }).limit(100);
      if (data) setMessages(data as Message[]);
    } else if (chatId) {
      const { data } = await supabase.from('messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: true }).limit(100);
      if (data) setMessages(data as Message[]);
    }
  }, [chatId, group, isGroupChat]);

  useEffect(() => {
    loadMessages();
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'file' | 'audio') => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const fileName = `chats/${Date.now()}.${file.name.split('.').pop()}`;
    
    const { error } = await supabase.storage.from('media').upload(fileName, file);
    if (error) return alert("Ошибка: " + error.message);
    
    const { data } = supabase.storage.from('media').getPublicUrl(fileName);
    
    const insertData: any = {
      sender_id: user.id,
      media_url: data.publicUrl,
      media_type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('audio/') ? 'audio' : 'file',
      content: file.name
    };
    if (isGroupChat && group) insertData.group_id = group.id;
    else if (chatId) insertData.chat_id = chatId;
    
    await supabase.from('messages').insert(insertData);
    setShowAttachMenu(false);
  };

  const handleCallClick = () => {
    try {
      if (onCall) onCall(peer, 'audio');
    } catch (err) {
      alert("Ошибка при звонке: Убедитесь, что база данных Supabase готова (функция create_chat_with_participants).");
    }
  };

  const playAudio = (url: string, id: string) => {
    setCurrentAudio({ url, id });
    setIsPlaying(true);
    setShowFullPlayer(false);
    setTimeout(() => audioRef.current?.play(), 100);
  };

  const togglePlay = () => {
    if (isPlaying) audioRef.current?.pause(); else audioRef.current?.play();
    setIsPlaying(!isPlaying);
  };

  const headerName = isGroupChat ? (group?.name || 'Группа') : (isSelfChat ? 'Избранное' : (peer?.display_name || 'User'));
  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Фоновый паттерн
  const chatBackground = {
    backgroundImage: `radial-gradient(circle at 15% 50%, rgba(255, 107, 107, 0.08), transparent 25%), radial-gradient(circle at 85% 30%, rgba(72, 52, 212, 0.08), transparent 25%)`,
    backgroundSize: '100% 100%'
  };

  return (
    <div className="flex flex-col h-full relative" style={{ background: 'var(--app-bg)', ...chatBackground }}>
      
      {/* СКРЫТЫЕ ИНПУТЫ */}
      <input type="file" accept="image/*,video/*" capture="environment" ref={galleryInputRef} className="hidden" onChange={(e) => handleFileUpload(e, 'image')} />
      <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => handleFileUpload(e, 'file')} />

      {/* ШАПКА */}
      <div className="flex items-center gap-3 p-4 glass-nav border-b z-20 sticky top-0" style={{ borderColor: 'var(--app-border-glass)' }}>
        <button onClick={onBack} className="p-2 rounded-full hover:bg-white/10 transition-colors"><BackIcon size={22} /></button>
        <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => { if (!isSelfChat && !isGroupChat) setShowProfile(true); }}>
          {peer?.avatar_url ? (
            <img src={peer.avatar_url} className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold bg-blue-500">{(headerName || 'U').slice(0,2).toUpperCase()}</div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate" style={{ color: 'var(--app-text)' }}>{headerName}</p>
            <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>@{peer?.username || '...'}</p>
          </div>
        </div>
        {!isSelfChat && !isGroupChat && (
          <button onClick={handleCallClick} className="p-2 rounded-full hover:bg-white/10" style={{ color: 'var(--app-accent)' }}><PhoneIcon size={20} /></button>
        )}
      </div>

      {/* МИНИ-ПЛЕЕР */}
      <AnimatePresence>
        {currentAudio && !showFullPlayer && (
          <motion.div initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -50, opacity: 0 }} className="absolute top-[72px] left-0 right-0 z-10 mx-4 p-3 rounded-2xl glass-panel border shadow-lg flex items-center gap-3 cursor-pointer" style={{ borderColor: 'var(--app-accent)' }} onClick={() => setShowFullPlayer(true)}>
            <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="w-8 h-8 rounded-full flex items-center justify-center text-white bg-blue-500">
              {isPlaying ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
            </button>
            <div className="flex-1"><p className="text-xs font-bold" style={{ color: 'var(--app-text)' }}>Воспроизведение медиа</p></div>
            <button onClick={(e) => { e.stopPropagation(); setCurrentAudio(null); setIsPlaying(false); }} className="text-gray-400"><XIcon size={18} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* СООБЩЕНИЯ */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 relative z-0">
        {messages.map((msg: any) => {
          const isSent = msg.sender_id === user?.id;
          return (
            <div key={msg.id} className={`flex ${isSent ? 'justify-end' : 'justify-start'} relative group`}>
              <div className="relative max-w-[75%]">
                <div className="rounded-2xl px-4 py-2.5 shadow-sm" style={{ background: isSent ? 'var(--app-accent)' : 'var(--app-surface)', color: isSent ? '#fff' : 'var(--app-text)', borderBottomRightRadius: isSent ? '4px' : '16px', borderBottomLeftRadius: !isSent ? '4px' : '16px' }}>
                  
                  {msg.media_type === 'image' && msg.media_url && (
                    <img src={msg.media_url} className="rounded-xl max-w-full max-h-64 mb-1" />
                  )}
                  
                  {msg.media_type === 'file' && msg.media_url && (
                    <a href={msg.media_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-black/20 p-2 rounded-xl mb-1">
                      <span>📄</span> <span className="text-sm underline">{msg.content}</span>
                    </a>
                  )}

                  {msg.media_type === 'audio' && msg.media_url && (
                    <div onClick={() => playAudio(msg.media_url, msg.id)} className="flex items-center gap-2 bg-black/20 p-2 rounded-xl mb-1 cursor-pointer">
                      <PlayIcon size={16} /> <span className="text-sm">Аудиосообщение</span>
                    </div>
                  )}

                  {msg.content && msg.media_type !== 'file' && msg.media_type !== 'audio' && (
                    <p className="break-words text-[15px]">{msg.content}</p>
                  )}
                  
                  <span className="text-[10px] opacity-60 mt-1 block text-right">{formatTime(msg.created_at)}</span>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* ПАНЕЛЬ ВВОДА */}
      <div className="p-3 glass-nav border-t flex flex-col gap-2 relative" style={{ borderColor: 'var(--app-border-glass)' }}>
        
        {/* МЕНЮ СКРЕПКИ */}
        <AnimatePresence>
          {showAttachMenu && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute bottom-[70px] left-3 bg-[var(--app-surface)] border border-[var(--app-border)] p-2 rounded-2xl shadow-xl flex gap-2 z-50">
              <button onClick={() => { setShowAttachMenu(false); galleryInputRef.current?.click(); }} className="flex flex-col items-center p-3 hover:bg-white/5 rounded-xl">
                <ImageIcon size={24} color="var(--app-accent)" /><span className="text-xs mt-1 text-white">Галерея</span>
              </button>
              <button onClick={() => { setShowAttachMenu(false); fileInputRef.current?.click(); }} className="flex flex-col items-center p-3 hover:bg-white/5 rounded-xl">
                <PaperclipIcon size={24} color="var(--app-accent)" /><span className="text-xs mt-1 text-white">Файл</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={sendMessage} className="flex items-center gap-2">
          <button type="button" onClick={() => setShowAttachMenu(!showAttachMenu)} className="p-2 rounded-full hover:bg-white/10 transition-colors" style={{ color: 'var(--app-text-muted)' }}>
            <PaperclipIcon size={24} />
          </button>
          
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Сообщение..." className="flex-1 px-4 py-2.5 rounded-2xl outline-none border bg-transparent" style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }} />
          
          <button type="submit" disabled={!input.trim()} className="p-2.5 rounded-full text-white disabled:opacity-50" style={{ background: 'var(--app-accent)' }}>
            <SendIcon size={20} />
          </button>
        </form>
      </div>

      {/* СКРЫТЫЙ АУДИО-ЭЛЕМЕНТ */}
      {currentAudio && <audio ref={audioRef} src={currentAudio.url} onEnded={() => setIsPlaying(false)} />}

      {/* РАСКРЫТЫЙ ПЛЕЕР */}
      <AnimatePresence>
        {showFullPlayer && currentAudio && (
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="fixed inset-0 z-[200] bg-[var(--app-bg)] flex flex-col p-6">
            <button onClick={() => setShowFullPlayer(false)} className="self-start p-2 mb-8 text-white"><BackIcon size={24} /></button>
            
            <div className="flex-1 flex flex-col items-center justify-center">
               <div className="w-64 h-64 rounded-3xl bg-blue-500/10 flex items-center justify-center mb-8 border border-blue-500/20">
                 <MusicIcon size={80} color="var(--app-accent)" />
               </div>
               <h2 className="text-xl font-bold text-white mb-2">Медиафайл</h2>
               
               <button onClick={togglePlay} className="w-20 h-20 rounded-full mt-6 flex items-center justify-center text-white shadow-xl" style={{ background: 'var(--app-accent)' }}>
                 {isPlaying ? <PauseIcon size={32} /> : <PlayIcon size={32} />}
               </button>

               <button 
                 onClick={async () => {
                   if (!user) return;
                   await supabase.from('profiles').update({ profile_song_url: currentAudio.url }).eq('id', user.id);
                   alert('Трек добавлен в ваш профиль!');
                   setShowFullPlayer(false);
                 }} 
                 className="mt-8 px-6 py-3 bg-white/10 text-white rounded-xl font-medium border border-white/20 hover:bg-white/20 transition-colors"
               >
                 Добавить в профиль
               </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showProfile && !isSelfChat && !isGroupChat && (
          <UserProfileModal profileId={peer.id} onClose={() => setShowProfile(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
