import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, Profile } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { PlusIcon, HeartIcon, BackIcon } from '@/components/Icons';

export default function StoriesBar() {
  const { user, profile } = useAuth();
  const [stories, setStories] = useState<any[]>([]);
  const [viewingStory, setViewingStory] = useState<any | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [duration, setDuration] = useState(24);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchStories();
  }, []);

  const fetchStories = async () => {
    const { data } = await supabase
      .from('stories')
      .select('*, profiles(username, avatar_url, display_name)')
      .gt('expires_at', new Date().toISOString());
    if (data) setStories(data);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const fileName = `stories/${user.id}/${Date.now()}.${file.name.split('.').pop()}`;
    
    const { error } = await supabase.storage.from('media').upload(fileName, file);
    if (error) return alert(error.message);
    
    const { data: urlData } = supabase.storage.from('media').getPublicUrl(fileName);
    const expiresAt = new Date(Date.now() + duration * 60 * 60 * 1000).toISOString();

    await supabase.from('stories').insert({
      user_id: user.id,
      media_url: urlData.publicUrl,
      expires_at: expiresAt
    });
    
    setShowCreate(false);
    fetchStories();
  };

  const likeStory = async (storyId: string, currentLikes: number) => {
    await supabase.from('stories').update({ likes: currentLikes + 1 }).eq('id', storyId);
    setViewingStory((prev: any) => ({ ...prev, likes: currentLikes + 1 }));
  };

  // Группируем истории по пользователям, чтобы было одно кольцо на человека
  const uniqueUsers = Array.from(new Set(stories.map(s => s.user_id)))
    .map(id => stories.find(s => s.user_id === id));

  return (
    <div className="w-full overflow-x-auto flex gap-4 p-4 scrollbar-hide">
      {/* Создать историю */}
      <div className="flex flex-col items-center gap-1 cursor-pointer" onClick={() => setShowCreate(true)}>
        <div className="w-16 h-16 rounded-full border-2 border-dashed border-gray-500 flex items-center justify-center bg-[var(--app-surface)]">
          <PlusIcon size={24} color="var(--app-accent)" />
        </div>
        <span className="text-xs" style={{ color: 'var(--app-text)' }}>Ваша</span>
      </div>

      {/* Чужие истории (с кольцом) */}
      {uniqueUsers.map((story: any) => (
        <div key={story.id} className="flex flex-col items-center gap-1 cursor-pointer" onClick={() => setViewingStory(story)}>
          <div className="w-16 h-16 rounded-full p-[3px]" style={{ background: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)' }}>
            <img src={story.profiles?.avatar_url || ''} className="w-full h-full rounded-full object-cover border-2 border-[var(--app-bg)]" />
          </div>
          <span className="text-xs truncate w-16 text-center" style={{ color: 'var(--app-text)' }}>{story.profiles?.username}</span>
        </div>
      ))}

      {/* Модалка создания */}
      <AnimatePresence>
        {showCreate && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-md">
            <div className="glass-panel p-6 rounded-2xl w-full max-w-sm text-center space-y-4">
              <h3 className="font-bold text-lg" style={{ color: 'var(--app-text)' }}>Новая история</h3>
              <div className="flex justify-center gap-2">
                <button onClick={() => setDuration(12)} className={`px-4 py-2 rounded-xl border ${duration === 12 ? 'bg-blue-500 text-white' : 'text-gray-400'}`}>12 часов</button>
                <button onClick={() => setDuration(24)} className={`px-4 py-2 rounded-xl border ${duration === 24 ? 'bg-blue-500 text-white' : 'text-gray-400'}`}>24 часа</button>
              </div>
              <button onClick={() => fileInputRef.current?.click()} className="w-full py-3 bg-blue-500 text-white rounded-xl font-semibold">Выбрать фото</button>
              <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleUpload} />
              <button onClick={() => setShowCreate(false)} className="w-full py-2 text-gray-400">Отмена</button>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Просмотр истории */}
      <AnimatePresence>
        {viewingStory && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black flex flex-col">
            <div className="p-4 flex justify-between items-center z-10">
              <div className="flex items-center gap-2 text-white">
                <img src={viewingStory.profiles?.avatar_url} className="w-8 h-8 rounded-full" />
                <span className="font-semibold">{viewingStory.profiles?.username}</span>
              </div>
              <button onClick={() => setViewingStory(null)}><XIcon size={24} color="#fff" /></button>
            </div>
            <img src={viewingStory.media_url} className="flex-1 w-full object-contain" />
            <div className="p-6 flex justify-center pb-10 z-10">
              <button onClick={() => likeStory(viewingStory.id, viewingStory.likes || 0)} className="flex items-center gap-2 bg-white/20 px-6 py-3 rounded-full backdrop-blur-md text-white">
                <HeartIcon size={24} fill="#ff4d4d" color="#ff4d4d" /> {viewingStory.likes || 0}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const XIcon = ({ size, color }: { size: number, color: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
);
