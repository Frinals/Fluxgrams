import { useState, useRef, memo, useEffect, FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Profile } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  XIcon, SendIcon, PlayIcon, PauseIcon, MusicIcon, GiftIcon, CheckIcon,
  CameraIcon,
} from '@/components/Icons';
import { GiftType, GIFTS } from '@/components/GiftsModal';

const springTransition = { type: 'spring' as const, stiffness: 300, damping: 30 };

interface Props {
  profile: Profile;
  onClose: () => void;
  onSendMessage?: (profile: Profile) => void;
}

type Tab = 'gifts' | 'settings';

function UserProfileModalInner({ profile, onClose, onSendMessage }: Props) {
  const { t } = useLanguage();
  const { user, refreshProfile } = useAuth();
  const isSelf = user?.id === profile.id;
  const [activeTab, setActiveTab] = useState<Tab>('gifts');
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const songInputRef = useRef<HTMLInputElement>(null);

  // Editable state (only used in Settings tab for self)
  const [editName, setEditName] = useState(profile.display_name ?? '');
  const [editBio, setEditBio] = useState(profile.bio ?? '');
  const [editUsername, setEditUsername] = useState(profile.username ?? '');
  const [editAvatar, setEditAvatar] = useState(profile.avatar_url ?? '');
  const [editBanner, setEditBanner] = useState<string>('');
  const [editSong, setEditSong] = useState(profile.profile_song_url ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    setEditName(profile.display_name ?? '');
    setEditBio(profile.bio ?? '');
    setEditUsername(profile.username ?? '');
    setEditAvatar(profile.avatar_url ?? '');
    setEditSong(profile.profile_song_url ?? '');
  }, [profile]);

  // Check online status — if ghost mode is on, always show offline
  useEffect(() => {
    if (isSelf || !profile.id) return;
    // Ghost mode users always show offline
    if (profile.ghost_mode) {
      setIsOnline(false);
      return;
    }
    // Check if the user has been active in the last 60 seconds
    const checkOnline = async () => {
      const oneMinAgo = new Date(Date.now() - 60_000).toISOString();
      const { data } = await supabase
        .from('messages')
        .select('created_at')
        .eq('sender_id', profile.id)
        .gte('created_at', oneMinAgo)
        .limit(1)
        .maybeSingle();
      setIsOnline(!!data);
    };
    checkOnline();
    const interval = setInterval(checkOnline, 15_000);
    return () => clearInterval(interval);
  }, [profile.id, profile.ghost_mode, isSelf]);

  const initials = (profile.display_name || profile.username || '?')
    .split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  const togglePlay = () => {
    if (!audioRef.current || !profile.profile_song_url) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play().then(() => setPlaying(true)).catch(() => {}); }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const ext = file.name.split('.').pop();
    const fileName = `avatars/${user.id}.${ext}`;
    try {
      await supabase.storage.from('chat-media').upload(fileName, file, { upsert: true });
    } catch {
      try {
        await supabase.storage.createBucket('chat-media', { public: true });
        await supabase.storage.from('chat-media').upload(fileName, file, { upsert: true });
      } catch { return; }
    }
    const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(fileName);
    setEditAvatar(urlData.publicUrl);
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const ext = file.name.split('.').pop();
    const fileName = `banners/${user.id}.${ext}`;
    try {
      await supabase.storage.from('chat-media').upload(fileName, file, { upsert: true });
    } catch {
      await supabase.storage.from('chat-media').upload(fileName, file, { upsert: true });
    }
    const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(fileName);
    setEditBanner(urlData.publicUrl);
  };

  const handleSongUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const ext = file.name.split('.').pop() || 'mp3';
    const fileName = `songs/${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('chat-media').upload(fileName, file);
    if (error) return;
    const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(fileName);
    setEditSong(urlData.publicUrl);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const updates: Partial<Profile> = {
      display_name: editName.trim() || null,
      bio: editBio.trim() || null,
      avatar_url: editAvatar || null,
      profile_song_url: editSong || null,
    };
    if (editUsername.trim()) updates.username = editUsername.trim();
    await supabase.from('profiles').update(updates).eq('id', user.id);
    await refreshProfile();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const avatarSrc = activeTab === 'settings' && isSelf ? editAvatar : profile.avatar_url;
  const displayName = activeTab === 'settings' && isSelf ? editName : (profile.display_name || 'User');
  const bannerGradient = editBanner || 'var(--app-accent-gradient)';

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={springTransition}
        className="glass-panel rounded-3xl max-w-md w-full relative overflow-hidden flex flex-col"
        style={{ maxHeight: '92vh' }}
        onClick={(e) => e.stopPropagation()}>

        {/* Close button */}
        <button onClick={onClose}
                className="absolute top-3 right-3 z-30 p-2 rounded-full transition-all hover:bg-black/20"
                style={{ color: '#fff', background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)' }}>
          <XIcon size={20} />
        </button>

        {/* ─── Full-width Banner ─── */}
        <div className="relative h-32 flex-shrink-0 overflow-hidden"
             style={{ background: bannerGradient }}>
          {editBanner && (
            <img src={editBanner} alt="" className="w-full h-full object-cover" />
          )}
          {/* Subtle gradient overlay for text readability */}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.3) 100%)' }} />
        </div>

        {/* ─── Overlapping Avatar ─── */}
        <div className="relative -mt-12 flex flex-col items-center px-6">
          <div className="relative">
            {avatarSrc ? (
              <img src={avatarSrc} alt="" className="w-24 h-24 rounded-full object-cover border-4"
                   style={{ borderColor: 'var(--app-bg)' }} />
            ) : (
              <div className="w-24 h-24 rounded-full flex items-center justify-center font-bold text-3xl border-4"
                   style={{ background: 'var(--app-accent-gradient)', color: '#fff', borderColor: 'var(--app-bg)' }}>
                {initials}
              </div>
            )}
            {/* Online status dot */}
            <div className="absolute bottom-1 right-1 w-5 h-5 rounded-full border-2 flex items-center justify-center"
                 style={{ borderColor: 'var(--app-bg)', background: isOnline ? 'var(--app-success)' : 'var(--app-text-muted)' }} />
          </div>

          {/* Name, username, online status */}
          <h2 className="text-xl font-bold mt-3" style={{ color: 'var(--app-text)' }}>
            {displayName}
          </h2>
          {profile.username && (
            <p className="text-sm mt-0.5" style={{ color: 'var(--app-text-muted)' }}>
              @{profile.username}
            </p>
          )}
          <p className="text-xs mt-1 font-medium" style={{ color: isOnline ? 'var(--app-success)' : 'var(--app-text-muted)' }}>
            {isOnline ? t('online') : t('offline')}
          </p>
        </div>

        {/* ─── Music Player ─── */}
        {profile.profile_song_url && (
          <div className="px-6 mt-4">
            <div className="p-4 rounded-2xl flex items-center gap-3"
                 style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border-glass)' }}>
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={togglePlay}
                className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--app-accent-gradient)', color: '#fff' }}
              >
                {playing ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
              </motion.button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <MusicIcon size={14} style={{ color: 'var(--app-accent)' }} />
                  <p className="text-xs font-semibold" style={{ color: 'var(--app-text-muted)' }}>{t('profileSong')}</p>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--app-border)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'var(--app-accent-gradient)' }}
                    animate={{ width: playing ? '100%' : '0%' }}
                    transition={{ duration: playing ? 30 : 0.3, ease: 'linear' }}
                  />
                </div>
              </div>
              <audio
                ref={audioRef}
                src={profile.profile_song_url}
                onEnded={() => setPlaying(false)}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
              />
            </div>
          </div>
        )}

        {/* ─── Action Buttons Row ─── */}
        {isSelf && (
          <div className="px-6 mt-4 flex gap-2">
            <ActionButton icon={<CameraIcon size={16} />} label={t('changePhoto')} onClick={() => fileInputRef.current?.click()} />
            <ActionButton icon={<CameraIcon size={16} />} label={t('banner')} onClick={() => bannerInputRef.current?.click()} />
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleAvatarUpload} />
        <input ref={bannerInputRef} type="file" accept="image/*" hidden onChange={handleBannerUpload} />

        {/* ─── Tab Buttons ─── */}
        <div className="px-6 mt-4 flex gap-2">
          <TabButton active={activeTab === 'gifts'} onClick={() => setActiveTab('gifts')} icon={<GiftIcon size={16} />} label={t('gifts')} />
          <TabButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<MusicIcon size={16} />} label={t('settings')} />
        </div>

        {/* ─── Tab Content — scrollable ─── */}
        <div className="px-6 pb-6 pt-3 overflow-y-auto scroll-smooth-touch flex-1">
          <AnimatePresence mode="wait">
            {activeTab === 'gifts' && (
              <motion.div
                key="gifts"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={springTransition}
                className="space-y-3"
              >
                {/* Bio section above gifts */}
                {profile.bio && (
                  <div className="p-4 rounded-2xl" style={{ background: 'var(--app-surface)' }}>
                    <p className="text-xs font-semibold mb-1" style={{ color: 'var(--app-text-muted)' }}>{t('bio')}</p>
                    <p className="text-sm" style={{ color: 'var(--app-text)' }}>{profile.bio}</p>
                  </div>
                )}

                {/* Coming Soon tag */}
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: 'var(--app-accent)', color: '#fff' }}>{t('comingSoon')}</span>
                  <span className="text-xs" style={{ color: 'var(--app-text-muted)' }}>{t('sendAGift')}</span>
                </div>

                {GIFTS.map((gift: GiftType, idx: number) => (
                  <motion.div
                    key={gift.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ ...springTransition, delay: idx * 0.08 }}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl transition-all relative overflow-hidden"
                    style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border-glass)' }}
                  >
                    <div className="absolute inset-0 opacity-30"
                         style={{ background: gift.gradient, filter: 'blur(20px)' }} />
                    <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
                         style={{ background: gift.gradient, boxShadow: `0 0 20px ${gift.glow}, inset 0 1px 1px rgba(255,255,255,0.3)` }}>
                      {gift.emoji}
                    </div>
                    <div className="relative flex-1">
                      <p className="font-bold" style={{ color: 'var(--app-text)' }}>{t(gift.nameKey)}</p>
                      <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>{t('sendGift')}</p>
                    </div>
                    <motion.div
                      animate={{ y: [0, -4, 0] }}
                      transition={{ repeat: Infinity, duration: 2, delay: idx * 0.3 }}
                      className="relative text-2xl"
                    >
                      →
                    </motion.div>
                  </motion.div>
                ))}

                {/* Send Message button for other users */}
                {!isSelf && onSendMessage && (
                  <button onClick={() => onSendMessage(profile)}
                          className="w-full py-3 rounded-xl font-semibold transition-all hover:scale-[1.02] flex items-center justify-center gap-2 mt-2"
                          style={{ background: 'var(--app-accent)', color: '#fff' }}>
                    <SendIcon size={18} />
                    {t('sendMessageBtn')}
                  </button>
                )}
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={springTransition}
                className="space-y-4"
              >
                {isSelf ? (
                  <form onSubmit={handleSave} className="space-y-4">
                    <div>
                      <label className="block text-xs mb-1.5" style={{ color: 'var(--app-text-muted)' }}>{t('displayName')}</label>
                      <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                             className="w-full px-3 py-2 rounded-xl outline-none border text-sm"
                             style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }} />
                    </div>
                    <div>
                      <label className="block text-xs mb-1.5" style={{ color: 'var(--app-text-muted)' }}>{t('username')}</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--app-text-muted)' }}>@</span>
                        <input type="text" value={editUsername}
                               onChange={(e) => setEditUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                               className="w-full pl-7 pr-3 py-2 rounded-xl outline-none border text-sm"
                               style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs mb-1.5" style={{ color: 'var(--app-text-muted)' }}>{t('bio')}</label>
                      <textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} rows={2}
                                className="w-full px-3 py-2 rounded-xl outline-none border text-sm resize-none"
                                style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }} />
                    </div>
                    <div>
                      <label className="block text-xs mb-1.5" style={{ color: 'var(--app-text-muted)' }}>{t('profileSong')}</label>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => songInputRef.current?.click()}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5"
                                style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}>
                          <MusicIcon size={14} /> {t('uploadSong')}
                        </button>
                        <input ref={songInputRef} type="file" accept="audio/*" hidden onChange={handleSongUpload} />
                        {editSong && (
                          <button type="button" onClick={() => setEditSong('')}
                                  className="text-xs px-2 py-1 rounded-lg" style={{ color: 'var(--app-danger)' }}>
                            {t('delete')}
                          </button>
                        )}
                      </div>
                      {editSong && (
                        <audio controls src={editSong} className="w-full mt-2 h-9" style={{ borderRadius: '8px' }} />
                      )}
                    </div>

                    <button type="submit" disabled={saving}
                            className="w-full py-2.5 rounded-xl font-semibold transition-all hover:scale-[1.02] disabled:opacity-50 text-sm"
                            style={{ background: 'var(--app-accent)', color: '#fff' }}>
                      {saved ? <span className="flex items-center justify-center gap-2"><CheckIcon size={16} /> {t('save')}</span> : t('save')}
                    </button>
                  </form>
                ) : (
                  /* Read-only mode for other users — same layout as own profile */
                  <div className="space-y-3">
                    <div className="p-4 rounded-2xl" style={{ background: 'var(--app-surface)' }}>
                      <p className="text-xs font-semibold mb-1" style={{ color: 'var(--app-text-muted)' }}>{t('bio')}</p>
                      <p className="text-sm" style={{ color: 'var(--app-text)' }}>{profile.bio || '—'}</p>
                    </div>
                    <div className="p-4 rounded-2xl" style={{ background: 'var(--app-surface)' }}>
                      <p className="text-xs font-semibold mb-1" style={{ color: 'var(--app-text-muted)' }}>{t('username')}</p>
                      <p className="text-sm" style={{ color: 'var(--app-text)' }}>@{profile.username || '—'}</p>
                    </div>
                    {!isSelf && onSendMessage && (
                      <button onClick={() => onSendMessage(profile)}
                              className="w-full py-3 rounded-xl font-semibold transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
                              style={{ background: 'var(--app-accent)', color: '#fff' }}>
                        <SendIcon size={18} />
                        {t('sendMessageBtn')}
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ActionButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="flex-1 py-2 rounded-xl text-xs font-medium border flex items-center justify-center gap-1.5 transition-all"
      style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
    >
      {icon}
      {label}
    </motion.button>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className="relative flex-1 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 border"
      style={{
        background: active ? 'var(--app-accent)' : 'transparent',
        color: active ? '#fff' : 'var(--app-text)',
        borderColor: active ? 'transparent' : 'var(--app-border)',
      }}
    >
      {icon}
      {label}
    </button>
  );
}

export const UserProfileModal = memo(UserProfileModalInner);
