import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export default function FeedView({ onViewProfile }: any) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPosts = async () => {
      const { data } = await supabase
        .from('user_posts')
        .select('*, profiles(username, display_name, avatar_url, is_verified)')
        .order('created_at', { ascending: false });
      if (data) setPosts(data);
      setLoading(false);
    };
    fetchPosts();
  }, []);

  const handleLike = async (postId: string, currentLikes: number) => {
    if (!user) return;
    setPosts(posts.map(p => p.id === postId ? { ...p, likes: (p.likes || 0) + 1 } : p));
    await supabase.from('user_posts').update({ likes: currentLikes + 1 }).eq('id', postId);
  };

  if (loading) return <div className="p-10 text-center" style={{ color: 'var(--app-text)' }}>Загрузка ленты...</div>;

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: 'var(--app-bg)' }}>
      <div className="p-4 sticky top-0 z-10 border-b backdrop-blur-md" style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
        <h2 className="text-[26px] font-bold" style={{ color: 'var(--app-text)' }}>Лента</h2>
      </div>

      <div className="p-4 space-y-4 pb-28">
        {posts.map((post) => (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={post.id} className="p-4 rounded-3xl border" style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
            <div className="flex items-center gap-3 mb-3 cursor-pointer" onClick={() => onViewProfile(post.user_id)}>
              <div className="w-10 h-10 rounded-full overflow-hidden bg-blue-500 flex items-center justify-center text-white font-bold">
                {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} className="w-full h-full object-cover" /> : (post.profiles?.display_name || 'U')[0]}
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <p className="font-semibold" style={{ color: 'var(--app-text)' }}>{post.profiles?.display_name || 'Пользователь'}</p>
                  {post.profiles?.is_verified && <span className="text-blue-500 text-sm">✔</span>}
                </div>
                <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>@{post.profiles?.username || 'user'}</p>
              </div>
            </div>
            <p className="mb-4 text-[15px]" style={{ color: 'var(--app-text)' }}>{post.content}</p>
            <div className="flex items-center gap-6 pt-3 border-t" style={{ borderColor: 'var(--app-border)' }}>
              <button onClick={() => handleLike(post.id, post.likes || 0)} className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--app-accent)' }}>
                ❤️ {post.likes || 0}
              </button>
              <span className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--app-text-muted)' }}>👁️ {post.views || 0}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
