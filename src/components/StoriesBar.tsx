import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, Profile, Story } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { PlusIcon, XIcon, CameraIcon, TimerIcon, ShieldIcon } from '@/components/Icons';

interface StoryWithProfile extends Story {
  profile: Profile;
}

interface Props {
  onOpenStory?: (stories: StoryWithProfile[], index: number) => void;
}

const springTransition = { type: 'spring' as const, stiffness: 300, damping: 30 };

const AVATAR_RINGS = [
  'linear-gradient(135deg, #ff6b6b, #ee5a24)',
  'linear-gradient(135deg, #4834d4, #686de0)',
  'linear-gradient(135deg, #00d2d3, #54a0ff)',
  'linear-gradient(135deg, #1abc9c, #2ecc71)',
  'linear-gradient(135deg, #f39c12, #e74c3c)',
  'linear-gradient(135deg, #9b59b6, #e056fd)',
];

function ringColor(id: string) {
  const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_RINGS[hash % AVATAR_RINGS.length];
}

export default function StoriesBar({ onOpenStory }: Props) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [stories, setStories] = useState<StoryWithProfile[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [caption, setCaption] = useState('');
  const [privacy, setPrivacy] = useState<'everyone' | 'contacts'>('everyone');
  const [expiry, setExpiry] = useState<6 | 12 | 24>(24);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadStories();
    const channel = supabase
      .channel('stories_updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'stories' }, () => loadStories())
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'stories' }, () => loadStories())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadStories = async () => {
    const { data } = await supabase
      .from('stories')
      .select('*, profile:profiles!stories_user_id_fkey(*)')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (data) {
      const valid = data.filter((s) => s.profile) as unknown as StoryWithProfile[];
      setStories(valid);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const isVideo = file.type.startsWith('video/');
    setMediaType(isVideo ? 'video' : 'image');
    const reader = new FileReader();
    reader.onload = (ev) => setMediaPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    setShowUpload(true);
  };

  const handleUpload = async () => {
    if (!mediaPreview || !user) return;
    setUploading(true);
    const fileInput = fileInputRef.current?.files?.[0];
    if (!fileInput) { setUploading(false); return; }

    const ext = fileInput.name.split('.').pop();
    const fileName = `stories/${user.id}/${Date.now()}.${ext}`;
    try {
      await supabase.storage.from('chat-media').upload(fileName, fileInput);
    } catch {
      try {
        await supabase.storage.createBucket('chat-media', { public: true });
        await supabase.storage.from('chat-media').upload(fileName, fileInput);
      } catch { setUploading(false); return; }
    }
    const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(fileName);
    const expiresAt = new Date(Date.now() + expiry * 60 * 60 * 1000).toISOString();

    await supabase.from('stories').insert({
      media_url: urlData.publicUrl,
      media_type: mediaType,
      caption: caption.trim() || null,
      privacy,
      expires_at: expiresAt,
    });

    setUploading(false);
    setShowUpload(false);
    setMediaPreview(null);
    setCaption('');
    loadStories();
  };

  const groupedByUser = () => {
    const map = new Map<string, StoryWithProfile[]>();
    for (const s of stories) {
      const arr = map.get(s.user_id) ?? [];
      arr.push(s);
      map.set(s.user_id, arr);
    }
    return Array.from(map.entries());
  };

  const groups = groupedByUser();
  const myStories = groups.find(([uid]) => uid === user?.id)?.[1] ?? [];

  return (
    <>
      <div className="px-2 py-3 border-b" style={{ borderColor: 'var(--app-border)' }}>
        <div className="flex items-center gap-3 overflow-x-auto scroll-smooth-touch" style={{ scrollbarWidth: 'none' }}>
          {/* My Story / Add Story */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center gap-1 flex-shrink-0"
          >
            <div className="relative">
              <div className="w-14 h-14 rounded-full flex items-center justify-center"
                   style={{ background: 'var(--app-surface)', border: '2px dashed var(--app-border)' }}>
                {myStories.length > 0 && myStories[0].media_url ? (
                  <img src={myStories[0].media_url} alt="" className="w-full h-full object-cover rounded-full" />
                ) : (
                  <PlusIcon size={22} style={{ color: 'var(--app-text-muted)' }} />
                )}
              </div>
              {myStories.length === 0 && (
                <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center border-2"
                     style={{ background: 'var(--app-accent)', borderColor: 'var(--app-bg)' }}>
                  <PlusIcon size={12} className="text-white" />
                </div>
              )}
            </div>
            <span className="text-[10px] font-medium" style={{ color: 'var(--app-text-muted)' }}>
              {myStories.length > 0 ? t('yourStory') : t('addStory')}
            </span>
          </button>

          {/* Other users' stories */}
          {groups
            .filter(([uid]) => uid !== user?.id)
            .map(([uid, userStories]) => {
              const first = userStories[0];
              const p = first.profile;
              return (
                <button
                  key={uid}
                  onClick={() => onOpenStory?.(userStories, 0)}
                  className="flex flex-col items-center gap-1 flex-shrink-0"
                >
                  <div
                    className="w-14 h-14 rounded-full p-0.5"
                    style={{ background: ringColor(uid) }}
                  >
                    <div className="w-full h-full rounded-full overflow-hidden border-2" style={{ borderColor: 'var(--app-bg)' }}>
                      {p.avatar_url ? (
                        <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-sm font-bold"
                             style={{ background: 'var(--app-accent-gradient)', color: '#fff' }}>
                          {(p.display_name || p.username || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] font-medium max-w-[56px] truncate" style={{ color: 'var(--app-text-muted)' }}>
                    {p.display_name || p.username || 'User'}
                  </span>
                </button>
              );
            })}
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*,video/*" hidden onChange={handleFileSelect} />

      {/* Upload Modal */}
      <AnimatePresence>
        {showUpload && mediaPreview && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.8)' }}
            onClick={() => { setShowUpload(false); setMediaPreview(null); }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={springTransition}
              className="glass-panel rounded-3xl p-5 max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg" style={{ color: 'var(--app-text)' }}>{t('addStory')}</h3>
                <button onClick={() => { setShowUpload(false); setMediaPreview(null); }}
                        className="p-1 rounded-lg" style={{ color: 'var(--app-text-muted)' }}>
                  <XIcon size={20} />
                </button>
              </div>

              {mediaType === 'image' ? (
                <img src={mediaPreview} alt="" className="w-full max-h-64 object-contain rounded-xl mb-4" />
              ) : (
                <video src={mediaPreview} className="w-full max-h-64 object-contain rounded-xl mb-4" controls />
              )}

              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder={t('bio')}
                maxLength={100}
                className="w-full px-4 py-2.5 rounded-xl outline-none border mb-3 text-sm"
                style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
              />

              {/* Privacy */}
              <div className="mb-3">
                <p className="text-xs mb-2 flex items-center gap-1.5" style={{ color: 'var(--app-text-muted)' }}>
                  <ShieldIcon size={14} /> {t('storyPrivacy')}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(['everyone', 'contacts'] as const).map((opt) => (
                    <button key={opt} onClick={() => setPrivacy(opt)}
                            className="py-2 rounded-lg text-xs font-medium transition-all border"
                            style={{
                              background: privacy === opt ? 'var(--app-accent)' : 'var(--app-surface)',
                              color: privacy === opt ? '#fff' : 'var(--app-text)',
                              borderColor: privacy === opt ? 'transparent' : 'var(--app-border)',
                            }}>
                      {opt === 'everyone' ? t('everyone') : t('contactsOnly')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Expiry */}
              <div className="mb-4">
                <p className="text-xs mb-2 flex items-center gap-1.5" style={{ color: 'var(--app-text-muted)' }}>
                  <TimerIcon size={14} /> {t('storyExpires')}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {([6, 12, 24] as const).map((h) => (
                    <button key={h} onClick={() => setExpiry(h)}
                            className="py-2 rounded-lg text-xs font-medium transition-all border"
                            style={{
                              background: expiry === h ? 'var(--app-accent)' : 'var(--app-surface)',
                              color: expiry === h ? '#fff' : 'var(--app-text)',
                              borderColor: expiry === h ? 'transparent' : 'var(--app-border)',
                            }}>
                      {h === 6 ? t('story6h') : h === 12 ? t('story12h') : t('story24h')}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleUpload}
                disabled={uploading}
                className="w-full py-2.5 rounded-xl font-semibold transition-all hover:scale-[1.02] disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: 'var(--app-accent)', color: '#fff' }}
              >
                <CameraIcon size={18} /> {uploading ? '...' : t('addStory')}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
