import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export default function FeedView({ onViewProfile }: any) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [userLikes, setUserLikes] = useState<string[]>([]);

  useEffect(() => {
    const fetchPosts = async () => {
      const { data: postsData } = await supabase.from('user_posts').select('*, profiles(display_name, username, avatar_url)').order('created_at', { ascending: false });
      const { data: likesData } = await supabase.from('post_likes').select('post_id').eq('user_id', user?.id);
      
      if (postsData) setPosts(postsData);
      if (likesData) setUserLikes(likesData.map(l => l.post_id));
    };
    fetchPosts();
  }, [user]);

  // Радар просмотров
  const observePost = (element: HTMLDivElement | null, postId: string) => {
    if (!element || !user) return;
    const observer = new IntersectionObserver(async ([entry]) => {
      if (entry.isIntersecting) {
        // Пытаемся записать просмотр (база не даст записать 2 раза из-за UNIQUE)
        await supabase.from('post_views').insert({ post_id: postId, user_id: user.id }).select();
        observer.disconnect();
      }
    }, { threshold: 0.5 });
    observer.observe(element);
  };

  const handleLike = async (postId: string) => {
    if (!user) return;
    const isLiked = userLikes.includes(postId);
    
    if (isLiked) {
      await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', user.id);
      setUserLikes(prev => prev.filter(id => id !== postId));
    } else {
      await supabase.from('post_likes').insert({ post_id: postId, user_id: user.id });
      setUserLikes(prev => [...prev, postId]);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: 'var(--app-bg)' }}>
      <div className="p-4 sticky top-0 z-10 liquid-glass">
        <h2 className="text-2xl font-bold" style={{ color: 'var(--app-text)' }}>Лента</h2>
      </div>

      <div className="p-4 space-y-4 pb-28">
        {posts.map((post) => (
          <div 
            key={post.id} 
            ref={(el) => observePost(el, post.id)} 
            className="p-4 rounded-3xl liquid-glass"
          >
            <div className="flex items-center gap-3 mb-3 cursor-pointer" onClick={() => onViewProfile(post.user_id)}>
              <div className="w-10 h-10 rounded-full overflow-hidden bg-blue-500 flex items-center justify-center text-white font-bold">
                {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} className="w-full h-full object-cover" /> : (post.profiles?.display_name || 'U')[0]}
              </div>
              <div>
                <p className="font-semibold" style={{ color: 'var(--app-text)' }}>{post.profiles?.display_name || 'Пользователь'}</p>
                <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>@{post.profiles?.username}</p>
              </div>
            </div>

            <p className="mb-4 text-[15px]" style={{ color: 'var(--app-text)' }}>{post.content}</p>

            <div className="flex items-center gap-6 pt-3 border-t" style={{ borderColor: 'var(--app-border)' }}>
              <button onClick={() => handleLike(post.id)} className="flex items-center gap-1.5 text-sm font-semibold transition-transform active:scale-95" style={{ color: userLikes.includes(post.id) ? '#ef4444' : 'var(--app-text-muted)' }}>
                {userLikes.includes(post.id) ? '❤️' : '🤍'} {post.likes || 0}
              </button>
              <span className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--app-text-muted)' }}>👁️ {post.views || 0}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
