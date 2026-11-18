import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { PlusIcon } from '@/components/Icons';

export default function StoriesBar() {
  const { user } = useAuth();
  const [stories, setStories] = useState<any[]>([]);
  const [viewingStory, setViewingStory] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchStories = async () => {
      const { data } = await supabase
        .from('stories')
        .select('*, profiles(username, avatar_url, display_name)')
        .gt('expires_at', new Date().toISOString());
      if (data) setStories(data);
    };
    fetchStories();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const fileName = `stories/${user.id}/${Date.now()}.${file.name.split('.').pop()}`;
    
    const { error } = await supabase.storage.from('media').upload(fileName, file);
    if (error) return alert(error.message);
    
    const { data: urlData } = supabase.storage.from('media').getPublicUrl(fileName);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await supabase.from('stories').insert({
      user_id: user.id,
      media_url: urlData.publicUrl,
      expires_at: expiresAt
    });
    
    const { data } = await supabase.from('stories').select('*, profiles(username, avatar_url, display_name)').gt('expires_at', new Date().toISOString());
    if (data) setStories(data);
  };

  const uniqueUsers = Array.from(new Set(stories.map(s => s.user_id))).map(id => stories.find(s => s.user_id === id));

  return (
    <div className="w-full overflow-x-auto flex gap-4 p-4 scrollbar-hide">
      <div className="flex flex-col items-center gap-1 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
        <div className="w-16 h-16 rounded-full border-2 border-dashed border-gray-500 flex items-center justify-center bg-[var(--app-surface)]">
          <PlusIcon size={24} color="var(--app-accent)" />
        </div>
        <span className="text-xs" style={{ color: 'var(--app-text)' }}>Ваша</span>
        <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleUpload} />
      </div>

      {uniqueUsers.map((story: any) => (
        <div key={story.id} className="flex flex-col items-center gap-1 cursor-pointer" onClick={() => setViewingStory(story)}>
          <div className="w-16 h-16 rounded-full p-[3px]" style={{ background: 'linear-gradient(45deg, #00ff87, #60efff)' }}>
            <img src={story.profiles?.avatar_url || ''} className="w-full h-full rounded-full object-cover border-2 border-[var(--app-bg)]" />
          </div>
          <span className="text-xs truncate w-16 text-center" style={{ color: 'var(--app-text)' }}>{story.profiles?.username}</span>
        </div>
      ))}

      <AnimatePresence>
        {viewingStory && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black flex flex-col">
            <div className="p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/80 to-transparent">
              <div className="flex items-center gap-2 text-white">
                <img src={viewingStory.profiles?.avatar_url} className="w-8 h-8 rounded-full" />
                <span className="font-semibold">{viewingStory.profiles?.username}</span>
              </div>
              <button onClick={() => setViewingStory(null)} className="text-white text-xl">✕</button>
            </div>
            <img src={viewingStory.media_url} className="flex-1 w-full object-contain" />
            <div className="p-6 flex justify-center pb-10 z-10">
              <button className="flex items-center gap-2 bg-white/20 px-6 py-3 rounded-full backdrop-blur-md text-white">
                {/* ИКОНКА СЕРДЦА (ВСТРОЕННАЯ SVG, ЧТОБЫ НЕ БЫЛО ОШИБОК) */}
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ff4d4d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                <span>{viewingStory.likes || 0}</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
