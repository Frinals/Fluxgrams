import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { PlusIcon, XIcon, TrashIcon } from '@/components/Icons';

export default function StoriesBar() {
  const { user } = useAuth();
  const [stories, setStories] = useState<any[]>([]);
  const [viewingStory, setViewingStory] = useState<any | null>(null);
  
  // Состояния для создания истории
  const [createStep, setCreateStep] = useState<'none' | 'trim' | 'time'>('none');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(24); // по умолчанию 24 часа

  // Состояния для просмотра
  const [likedByMe, setLikedByMe] = useState<boolean>(false);
  const [likers, setLikers] = useState<any[]>([]);
  const [showOptions, setShowOptions] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchStories();
  }, [user]);

  const fetchStories = async () => {
    if (!user) return;

    // ПРАВИЛО: Берем только тех, с кем есть чат
    const { data: myChats } = await supabase.from('chats').select('user1_id, user2_id').or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);
    
    let allowedUserIds = [user.id]; // Себя тоже видим
    if (myChats) {
      myChats.forEach(c => {
        allowedUserIds.push(c.user1_id === user.id ? c.user2_id : c.user1_id);
      });
    }

    const { data } = await supabase
      .from('stories')
      .select('*, profiles(username, avatar_url, display_name)')
      .in('user_id', allowedUserIds) // ТОЛЬКО ДРУЗЬЯ
      .gt('expires_at', new Date().toISOString()); // ТОЛЬКО НЕИСТЕКШИЕ

    if (data) setStories(data);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setCreateStep('trim');
  };

  const handleUpload = async () => {
    if (!selectedFile || !user) return;
    
    const isVideo = selectedFile.type.startsWith('video');
    const fileName = `stories/${user.id}/${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`;
    
    const { error } = await supabase.storage.from('media').upload(fileName, selectedFile);
    if (error) return alert(error.message);
    
    const { data: urlData } = supabase.storage.from('media').getPublicUrl(fileName);
    const expiresAt = new Date(Date.now() + duration * 60 * 60 * 1000).toISOString();

    await supabase.from('stories').insert({
      user_id: user.id,
      media_url: urlData.publicUrl,
      media_type: isVideo ? 'video' : 'image',
      expires_at: expiresAt
    });
    
    setCreateStep('none');
    setSelectedFile(null);
    setPreviewUrl(null);
    fetchStories();
  };

  const openStory = async (story: any) => {
    setViewingStory(story);
    setShowOptions(false);
    
    // Проверяем, лайкнул ли я
    const { data: myLike } = await supabase.from('story_likes').select('*').eq('story_id', story.id).eq('user_id', user?.id).maybeSingle();
    setLikedByMe(!!myLike);

    // Если я хозяин, грузим список лайкнувших
    if (story.user_id === user?.id) {
      const { data: likes } = await supabase.from('story_likes').select('user_id, profiles(username, avatar_url)').eq('story_id', story.id);
      if (likes) setLikers(likes);
    }
  };

  const toggleLike = async () => {
    if (!viewingStory || !user) return;
    
    if (likedByMe) {
      await supabase.from('story_likes').delete().eq('story_id', viewingStory.id).eq('user_id', user.id);
      setLikedByMe(false);
    } else {
      await supabase.from('story_likes').insert({ story_id: viewingStory.id, user_id: user.id });
      setLikedByMe(true);
    }
  };

  const deleteStory = async () => {
    if (!viewingStory) return;
    await supabase.from('stories').delete().eq('id', viewingStory.id);
    setViewingStory(null);
    fetchStories();
  };

  // Группируем истории (по одному кольцу на человека)
  const uniqueUsers = Array.from(new Set(stories.map(s => s.user_id))).map(id => stories.find(s => s.user_id === id));

  return (
    <div className="w-full overflow-x-auto flex gap-4 p-4 scrollbar-hide">
      
      {/* Кнопка создания */}
      <div className="flex flex-col items-center gap-1 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
        <div className="w-16 h-16 rounded-full border-2 border-dashed border-gray-500 flex items-center justify-center bg-[var(--app-surface)]">
          <PlusIcon size={24} color="var(--app-accent)" />
        </div>
        <span className="text-xs" style={{ color: 'var(--app-text)' }}>Ваша</span>
        <input ref={fileInputRef} type="file" accept="image/*,video/*" hidden onChange={handleFileSelect} />
      </div>

      {/* Список историй */}
      {uniqueUsers.map((story: any) => (
        <div key={story.id} className="flex flex-col items-center gap-1 cursor-pointer" onClick={() => openStory(story)}>
          <div className="w-16 h-16 rounded-full p-[3px]" style={{ background: 'linear-gradient(45deg, #00ff87, #60efff)' }}>
            <img src={story.profiles?.avatar_url || ''} className="w-full h-full rounded-full object-cover border-2 border-[var(--app-bg)]" />
          </div>
          <span className="text-xs truncate w-16 text-center" style={{ color: 'var(--app-text)' }}>{story.profiles?.username}</span>
        </div>
      ))}

      {/* === МОДАЛКИ === */}
      <AnimatePresence>
        
        {/* 1. ОБРЕЗКА (Визуальная) */}
        {createStep === 'trim' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black flex flex-col">
            <div className="p-4 flex justify-between items-center text-white">
              <button onClick={() => setCreateStep('none')}><XIcon size={24} /></button>
              <span className="font-semibold">Обрезка</span>
              <button onClick={() => setCreateStep('time')} className="text-blue-500 font-semibold">Далее</button>
            </div>
            <div className="flex-1 relative flex items-center justify-center">
              {previewUrl && selectedFile?.type.startsWith('video') ? (
                <video src={previewUrl} autoPlay loop muted className="max-w-full max-h-full" />
              ) : previewUrl ? (
                <img src={previewUrl} className="max-w-full max-h-full" />
              ) : null}
              
              {/* Визуальный ползунок обрезки */}
              <div className="absolute bottom-10 left-4 right-4 h-12 bg-white/20 rounded border-2 border-white flex items-center justify-between px-2">
                 <div className="w-1 h-full bg-white"></div>
                 <span className="text-xs text-white">Обрезка (визуально)</span>
                 <div className="w-1 h-full bg-white"></div>
              </div>
            </div>
          </motion.div>
        )}

        {/* 2. ВЫБОР ВРЕМЕНИ */}
        {createStep === 'time' && (
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="fixed inset-0 z-[100] bg-[var(--app-bg)] flex flex-col p-6">
            <h2 className="text-2xl font-bold text-center mb-6" style={{ color: 'var(--app-text)' }}>Сколько времени будет видна история?</h2>
            <div className="grid grid-cols-3 gap-3 mb-8">
              {[1, 3, 5, 12, 24].map((h) => (
                <button key={h} onClick={() => setDuration(h)} className={`py-3 rounded-2xl border-2 font-semibold transition-all ${duration === h ? 'border-blue-500 bg-blue-500/10 text-blue-500' : 'border-[var(--app-border)] text-gray-400'}`}>
                  {h} ч
                </button>
              ))}
            </div>
            <div className="mt-auto flex gap-3">
              <button onClick={() => setCreateStep('trim')} className="flex-1 py-3 rounded-2xl border border-[var(--app-border)] text-gray-400">Назад</button>
              <button onClick={handleUpload} className="flex-1 py-3 rounded-2xl bg-blue-500 text-white font-bold">Опубликовать</button>
            </div>
          </motion.div>
        )}

        {/* 3. ПРОСМОТР ИСТОРИИ */}
        {viewingStory && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black flex flex-col">
            
            {/* Шапка */}
            <div className="p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/80 to-transparent">
              <div className="flex items-center gap-2 text-white">
                <img src={viewingStory.profiles?.avatar_url} className="w-9 h-9 rounded-full" />
                <span className="font-semibold">{viewingStory.profiles?.username}</span>
              </div>
              <div className="flex items-center gap-4">
                {viewingStory.user_id === user?.id && (
                  <button onClick={() => setShowOptions(!showOptions)} className="text-white text-xl font-bold">⋮</button>
                )}
                <button onClick={() => setViewingStory(null)} className="text-white"><XIcon size={24} /></button>
              </div>
            </div>

            {/* Медиа */}
            {viewingStory.media_type === 'video' ? (
              <video src={viewingStory.media_url} autoPlay loop className="flex-1 w-full object-contain" />
            ) : (
              <img src={viewingStory.media_url} className="flex-1 w-full object-contain" />
            )}

            {/* Низ (Лайк) */}
            <div className="p-6 flex justify-center pb-10 z-10 bg-gradient-to-t from-black/80 to-transparent">
              <button onClick={toggleLike} className="flex items-center gap-2 px-6 py-3 rounded-full backdrop-blur-md transition-all bg-white/10 text-white">
                {/* Сердечко: пустое или закрашенное */}
                <svg width="24" height="24" viewBox="0 0 24 24" fill={likedByMe ? "#ff4d4d" : "none"} stroke={likedByMe ? "#ff4d4d" : "white"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
              </button>
            </div>

            {/* Меню хозяина */}
            <AnimatePresence>
              {showOptions && (
                <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 50 }} className="absolute top-16 right-4 w-64 bg-[var(--app-surface)] rounded-2xl border border-[var(--app-border)] p-4 shadow-2xl z-50">
                  <button onClick={deleteStory} className="w-full flex items-center gap-2 text-red-500 font-semibold mb-4 border-b border-[var(--app-border)] pb-2">
                    <TrashIcon size={18} /> Удалить историю
                  </button>
                  <p className="text-sm font-semibold mb-2" style={{ color: 'var(--app-text)' }}>Лайкнули:</p>
                  <div className="max-h-40 overflow-y-auto space-y-2">
                    {likers.length === 0 ? <p className="text-xs text-gray-500">Нет лайков</p> : likers.map((l: any) => (
                      <div key={l.user_id} className="flex items-center gap-2">
                         <img src={l.profiles?.avatar_url || ''} className="w-6 h-6 rounded-full bg-gray-600" />
                         <span className="text-xs" style={{ color: 'var(--app-text)' }}>@{l.profiles?.username}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
