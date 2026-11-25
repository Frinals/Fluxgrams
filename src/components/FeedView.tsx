import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { HeartIcon, EyeIcon } from 'lucide-react'; // Используем иконки из lucide-react

export default function FeedView() {
  const { user, profile } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [newPost, setNewPost] = useState('');

  // Загрузка постов
  useEffect(() => {
    const fetchPosts = async () => {
      const { data } = await supabase
        .from('user_posts')
        .select('*, profiles(username, display_name, avatar_url)')
        .order('created_at', { ascending: false });
      if (data) setPosts(data);
    };
    fetchPosts();
  }, []);

  // Создание поста
  const handleCreatePost = async () => {
    if (!newPost.trim() || !user) return;
    const { data } = await supabase.from('user_posts').insert({
      user_id: user.id,
      content: newPost,
      likes: 0,
      views: 0
    }).select('*, profiles(username, display_name, avatar_url)').single();
    
    if (data) {
      setPosts([data, ...posts]);
      setNewPost('');
    }
  };

  // Лайк
  const handleLike = async (postId: string, currentLikes: number) => {
    const { data } = await supabase
      .from('user_posts')
      .update({ likes: currentLikes + 1 })
      .eq('id', postId)
      .select('likes')
      .single();
    
    if (data) {
      setPosts(posts.map(p => p.id === postId ? { ...p, likes: data.likes } : p));
    }
  };

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--app-bg)' }}>
      {/* Форма создания поста */}
      <div className="p-4 border-b" style={{ borderColor: 'var(--app-border)' }}>
        <textarea
          value={newPost}
          onChange={(e) => setNewPost(e.target.value)}
          placeholder="Что у тебя нового?"
          className="w-full p-3 rounded-xl border outline-none resize-none"
          style={{ background: 'var(--app-surface)', color: 'var(--app-text)', borderColor: 'var(--app-border)' }}
          rows={3}
        />
        <button
          onClick={handleCreatePost}
          className="mt-2 px-4 py-2 rounded-xl text-white font-semibold"
          style={{ background: 'var(--app-accent)' }}
        >
          Опубликовать
        </button>
      </div>

      {/* Лента постов */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {posts.map((post) => (
          <div key={post.id} className="p-4 rounded-2xl border" style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
            {/* Шапка поста */}
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-blue-500 flex items-center justify-center text-white font-bold">
                {post.profiles?.avatar_url ? (
                  <img src={post.profiles.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  (post.profiles?.display_name || 'U')[0]
                )}
              </div>
              <div>
                <p className="font-semibold" style={{ color: 'var(--app-text)' }}>{post.profiles?.display_name || post.profiles?.username}</p>
                <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>@{post.profiles?.username}</p>
              </div>
            </div>

            {/* Контент поста */}
            <p className="mb-4" style={{ color: 'var(--app-text)' }}>{post.content}</p>

            {/* Статистика и лайк */}
            <div className="flex items-center gap-4 pt-2 border-t" style={{ borderColor: 'var(--app-border)' }}>
              <button onClick={() => handleLike(post.id, post.likes)} className="flex items-center gap-1 text-sm font-semibold" style={{ color: 'var(--app-accent)' }}>
                <HeartIcon size={18} /> {post.likes || 0}
              </button>
              <span className="flex items-center gap-1 text-sm" style={{ color: 'var(--app-text-muted)' }}>
                <EyeIcon size={18} /> {post.views || 0}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
