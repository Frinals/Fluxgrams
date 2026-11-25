import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { PlayIcon, PauseIcon, VerifiedIcon, XIcon } from '@/components/Icons'; // Убрал HeartIcon, EyeIcon

export default function UserProfileModal({ profileId, onClose }: any) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'posts' | 'gifts'>('posts');
  const [userPosts, setUserPosts] = useState<any[]>([]);
  
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!profileId) return;
    const fetchData = async () => {
      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', profileId).single();
      if (profileData) setProfile(profileData);
      
      const { data: postsData } = await supabase.from('user_posts').select('*').eq('user_id', profileId).order('created_at', { ascending: false });
      if (postsData) setUserPosts(postsData);
      
      setLoading(false);
    };
    fetchData();
  }, [profileId]);

  const playSong = (index: number, url: string) => {
    if (playingIndex === index) {
      if (isPlaying) audioRef.current?.pause();
      else audioRef.current?.play();
      setIsPlaying(!isPlaying);
    } else {
      setPlayingIndex(index);
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.src = url;
          audioRef.current.play();
          setIsPlaying(true);
        }
      }, 100);
    }
  };

  if (loading || !profile) return null;

  return (
    <div className="fixed inset-0 z-[999] flex flex-col justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div 
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="w-full h-[90vh] rounded-t-[2.5rem] overflow-y-auto relative"
        style={{ background: 'var(--app-bg)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="w-full flex justify-center py-3 sticky top-0 z-20" style={{ background: 'var(--app-bg)' }}>
          <div className="w-12 h-1.5 rounded-full" style={{ background: 'var(--app-border)' }} />
        </div>

        <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full z-20" style={{ background: 'var(--app-surface)', color: 'var(--app-text)' }}>
          <XIcon size={20} />
        </button>

        <div className="relative w-full h-48 bg-gray-800 -mt-10">
          {profile?.banner_url ? <img src={profile.banner_url} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gradient-to-br from-blue-600 to-purple-600" />}
        </div>

        <div className="px-4 pb-24 -mt-16 relative z-10 flex flex-col items-center">
          <div className="w-32 h-32 rounded-full border-4 overflow-hidden flex items-center justify-center text-white text-4xl font-bold shadow-xl" style={{ borderColor: 'var(--app-bg)', background: 'var(--app-accent)' }}>
            {profile?.avatar_url ? <img src={profile.avatar_url} className="w-full h-full object-cover" /> : profile?.display_name?.[0] || 'U'}
          </div>

          <div className="text-center mt-3 w-full max-w-md">
            <div className="flex items-center justify-center gap-1">
              <h2 className="text-2xl font-bold" style={{ color: 'var(--app-text)' }}>{profile?.display_name || 'User'}</h2>
              {profile?.is_verified && <VerifiedIcon size={22} className="text-blue-500" />}
            </div>
            <p className="text-[15px] mb-3" style={{ color: 'var(--app-text-muted)' }}>@{profile?.username || 'user'}</p>
            <p className="text-sm py-3 px-4 rounded-2xl border" style={{ color: 'var(--app-text)', background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>{profile?.bio || 'Пользователь пока ничего не рассказал о себе.'}</p>
          </div>

          <div className="w-full max-w-md mt-6">
            <h3 className="font-bold text-lg mb-3" style={{ color: 'var(--app-text)' }}>Музыка</h3>
            <div className="rounded-2xl overflow-hidden border" style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
              {(!profile?.profile_music || profile.profile_music.length === 0) ? (
                <p className="p-5 text-center text-sm" style={{ color: 'var(--app-text-muted)' }}>Нет добавленных треков</p>
              ) : (
                profile.profile_music.map((song: any, idx: number) => (
                  <div key={idx} onClick={() => playSong(idx, song.url)} className="flex items-center gap-3 p-4 cursor-pointer border-b last:border-0" style={{ borderColor: 'var(--app-border)' }}>
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-white flex-shrink-0 shadow-lg" style={{ background: 'var(--app-accent)' }}>
                      {playingIndex === idx && isPlaying ? <PauseIcon size={22} /> : <PlayIcon size={22} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-medium truncate" style={{ color: 'var(--app-text)' }}>{song.title}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <audio ref={audioRef} onEnded={() => setIsPlaying(false)} className="hidden" />
          </div>

          <div className="w-full max-w-md mt-8">
            <div className="flex border-b" style={{ borderColor: 'var(--app-border)' }}>
              <button onClick={() => setActiveTab('posts')} className="flex-1 py-3 font-semibold text-center transition-colors" style={{ color: activeTab === 'posts' ? 'var(--app-accent)' : 'var(--app-text-muted)', borderBottom: activeTab === 'posts' ? '2px solid var(--app-accent)' : 'none' }}>
                Посты
              </button>
              <button onClick={() => setActiveTab('gifts')} className="flex-1 py-3 font-semibold text-center transition-colors" style={{ color: activeTab === 'gifts' ? 'var(--app-accent)' : 'var(--app-text-muted)', borderBottom: activeTab === 'gifts' ? '2px solid var(--app-accent)' : 'none' }}>
                Подарки
              </button>
            </div>

            <div className="mt-4">
              {activeTab === 'posts' && (
                <div className="space-y-3">
                  {userPosts.length === 0 ? (
                    <p className="text-center py-6 text-sm" style={{ color: 'var(--app-text-muted)' }}>Еще нет постов</p>
                  ) : (
                    userPosts.map(post => (
                      <div key={post.id} className="p-4 rounded-2xl border" style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
                        <p className="text-[15px] mb-3" style={{ color: 'var(--app-text)' }}>{post.content}</p>
                        {/* ИСПОЛЬЗУЕМ ЭМОДЗИ ВМЕСТО ИКОНОК */}
                        <div className="flex items-center gap-4 text-sm" style={{ color: 'var(--app-text-muted)' }}>
                          <span className="flex items-center gap-1">❤️ {post.likes || 0}</span>
                          <span className="flex items-center gap-1">👁️ {post.views || 0}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'gifts' && (
                <div className="text-center py-6">
                  <p className="text-sm" style={{ color: 'var(--app-text-muted)' }}>Пока нет подарков 🎁</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </motion.div>
    </div>
  );
}
