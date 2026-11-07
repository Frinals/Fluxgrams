import { useState, useEffect, useRef, FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, Profile } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeName, Language, TranslationKey, themes, themeList } from '@/lib/types';
import {
  UserIcon, LockIcon, GlobeIcon, PaletteIcon, LogOutIcon, CheckIcon,
  ChevronRightIcon, MusicIcon, BellIcon, BackIcon, UsersIcon, AddUserIcon,
} from '@/components/Icons';

type PrivacyOption = 'everyone' | 'contacts' | 'nobody';
type ChatSize = 'small' | 'medium' | 'large';
type SubPage = 'main' | 'profile' | 'privacy' | 'appearance' | 'notifications' | 'accounts';

const springTransition = { type: 'spring' as const, stiffness: 300, damping: 30 };

export default function SettingsView() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { t } = useLanguage();
  const { lang, setLang } = useLanguage();
  const { theme, setTheme } = useTheme();

  const [subPage, setSubPage] = useState<SubPage>('main');

  // Profile form state
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'available' | 'taken'>('idle');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? '');
  const [songUrl, setSongUrl] = useState(profile?.profile_song_url ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [ghostMode, setGhostMode] = useState(profile?.ghost_mode ?? false);
  const [readReceipts, setReadReceipts] = useState(true);
  const [privacyMessages, setPrivacyMessages] = useState<PrivacyOption>('everyone');
  const [privacyCalls, setPrivacyCalls] = useState<PrivacyOption>('everyone');
  const [privacySaving, setPrivacySaving] = useState(false);
  const [privacySaved, setPrivacySaved] = useState(false);
  // Notifications state (local only)
  const [notifMessages, setNotifMessages] = useState(true);
  const [notifCalls, setNotifCalls] = useState(true);
  const [notifGifts, setNotifGifts] = useState(true);
  const [notifChannels, setNotifChannels] = useState(true);
  const [notifSound, setNotifSound] = useState(true);
  const [notifVibration, setNotifVibration] = useState(true);
  const [notifPreview, setNotifPreview] = useState(true);
  // Chat size (persisted to localStorage)
  const [chatSize, setChatSize] = useState<ChatSize>(() => (localStorage.getItem('fluxgram-chat-size') as ChatSize) || 'medium');
  // Accounts state
  const [savedAccounts, setSavedAccounts] = useState<{ email: string; userId: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem('fluxgram-accounts') || '[]'); } catch { return []; }
  });
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [addingAccount, setAddingAccount] = useState(false);
  const userEmail = user?.email ?? '';

  useEffect(() => {
    if (user && userEmail) {
      const accounts = JSON.parse(localStorage.getItem('fluxgram-accounts') || '[]');
      if (!accounts.find((a: { email: string }) => a.email === userEmail)) {
        accounts.push({ email: userEmail, userId: user.id });
        localStorage.setItem('fluxgram-accounts', JSON.stringify(accounts));
        setSavedAccounts(accounts);
      }
    }
  }, [user, userEmail]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const songInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? '');
      setBio(profile.bio ?? '');
      setUsername(profile.username ?? '');
      setAvatarUrl(profile.avatar_url ?? '');
      setSongUrl(profile.profile_song_url ?? '');
      setGhostMode(profile.ghost_mode ?? false);
      setPrivacyMessages((profile.privacy_messages as PrivacyOption) ?? 'everyone');
      setPrivacyCalls((profile.privacy_calls as PrivacyOption) ?? 'everyone');
    }
  }, [profile]);

  useEffect(() => {
    if (!username.trim() || username === profile?.username) { setUsernameStatus('idle'); return; }
    const timeout = setTimeout(async () => {
      const { data } = await supabase.from('profiles').select('id').eq('username', username.trim()).neq('id', user?.id ?? '').maybeSingle();
      setUsernameStatus(data ? 'taken' : 'available');
    }, 500);
    return () => clearTimeout(timeout);
  }, [username, profile, user]);

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
    setAvatarUrl(urlData.publicUrl);
  };

  const handleSongUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const ext = file.name.split('.').pop() || 'mp3';
    const fileName = `songs/${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('chat-media').upload(fileName, file);
    if (error) { console.error('[Settings] Song upload error:', error); return; }
    const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(fileName);
    setSongUrl(urlData.publicUrl);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const updates: Partial<Profile> = {
      display_name: displayName.trim() || null,
      bio: bio.trim() || null,
      avatar_url: avatarUrl || null,
      profile_song_url: songUrl || null,
    };
    if (username.trim() && usernameStatus !== 'taken') updates.username = username.trim();
    await supabase.from('profiles').update(updates).eq('id', user.id);
    await refreshProfile();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleGhostModeToggle = async () => {
    if (!user) return;
    const newVal = !ghostMode;
    setGhostMode(newVal);
    await supabase.from('profiles').update({ ghost_mode: newVal }).eq('id', user.id);
    await refreshProfile();
  };

  const handlePrivacySave = async () => {
    if (!user) return;
    setPrivacySaving(true);
    await supabase.from('profiles').update({ privacy_messages: privacyMessages, privacy_calls: privacyCalls }).eq('id', user.id);
    await refreshProfile();
    setPrivacySaving(false);
    setPrivacySaved(true);
    setTimeout(() => setPrivacySaved(false), 2000);
  };

  const handleChatSizeChange = (size: ChatSize) => {
    setChatSize(size);
    localStorage.setItem('fluxgram-chat-size', size);
  };

  const saveAccountToList = (email: string, userId: string) => {
    const existing = savedAccounts.filter((a) => a.email !== email);
    existing.push({ email, userId });
    setSavedAccounts(existing);
    localStorage.setItem('fluxgram-accounts', JSON.stringify(existing));
  };

  const handleAddAccount = async () => {
    if (!addEmail.trim() || !addPassword.trim()) return;
    setAddingAccount(true);
    setAddError(null);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: addEmail.trim(),
      password: addPassword,
    });
    if (error) {
      setAddError(error.message);
      setAddingAccount(false);
      return;
    }
    if (data.user) {
      saveAccountToList(addEmail.trim(), data.user.id);
      setShowAddAccount(false);
      setAddEmail('');
      setAddPassword('');
      await refreshProfile();
    }
    setAddingAccount(false);
  };

  const handleSwitchAccount = async (email: string) => {
    // Find stored session for this email
    const accounts = JSON.parse(localStorage.getItem('fluxgram-accounts') || '[]');
    const account = accounts.find((a: { email: string }) => a.email === email);
    if (!account) return;
    // We rely on Supabase session persistence - just sign in again silently
    // Since we don't store passwords, we need the user to re-authenticate
    // But with session persistence, switching is handled by Supabase
    // For now, we just show a message that they need to sign in
    setAddEmail(email);
    setShowAddAccount(true);
  };

  const handleRemoveAccount = (email: string) => {
    const updated = savedAccounts.filter((a) => a.email !== email);
    setSavedAccounts(updated);
    localStorage.setItem('fluxgram-accounts', JSON.stringify(updated));
  };

  const initials = (displayName || username || '?').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  const themeLabels: Record<ThemeName, string> = {
    dark: t('darkTheme'), light: t('lightTheme'), neon: t('neonTheme'),
    halloween: t('halloweenTheme'), newyear: t('newyearTheme'),
    summer: t('summerTheme'), spring: t('springTheme'), black: t('blackTheme'),
  };
  const langOptions: { key: Language; label: string }[] = [
    { key: 'en', label: t('english') }, { key: 'ru', label: t('russian') },
  ];
  const privacyOptions: PrivacyOption[] = ['everyone', 'contacts', 'nobody'];
  const chatSizeOptions: { key: ChatSize; label: string }[] = [
    { key: 'small', label: t('small') },
    { key: 'medium', label: t('medium') },
    { key: 'large', label: t('large') },
  ];

  const renderPrivacySelect = (label: string, value: PrivacyOption, onChange: (v: PrivacyOption) => void) => (
    <div className="space-y-2">
      <p className="text-sm" style={{ color: 'var(--app-text-muted)' }}>{label}</p>
      <div className="grid grid-cols-3 gap-2">
        {privacyOptions.map((opt) => (
          <button key={opt} onClick={() => onChange(opt)}
            className="py-2.5 rounded-xl text-sm font-medium transition-all border"
            style={{ background: value === opt ? 'var(--app-accent)' : 'var(--app-surface)', color: value === opt ? '#fff' : 'var(--app-text)', borderColor: value === opt ? 'transparent' : 'var(--app-border)' }}>
            {t(opt as TranslationKey)}
          </button>
        ))}
      </div>
    </div>
  );

  const renderToggle = (label: string, desc: string | undefined, value: boolean, onChange: () => void) => (
    <div className="flex items-center justify-between py-1">
      <div className="min-w-0">
        <p className="text-sm font-medium" style={{ color: 'var(--app-text)' }}>{label}</p>
        {desc && <p className="text-xs mt-0.5" style={{ color: 'var(--app-text-muted)' }}>{desc}</p>}
      </div>
      <button onClick={onChange} className="relative w-12 h-6 rounded-full transition-all flex-shrink-0"
              style={{ background: value ? 'var(--app-accent)' : 'var(--app-border)' }}>
        <motion.div className="absolute top-0.5 w-5 h-5 rounded-full bg-white"
                    animate={{ left: value ? '26px' : '2px' }} transition={springTransition} />
      </button>
    </div>
  );

  // Cards for main settings page — Telegram-style with 3 main items
  const cards: { key: SubPage; icon: typeof UserIcon; label: string; desc: string; iconBg: string }[] = [
    { key: 'profile', icon: UserIcon, label: t('profilePersonalization'), desc: t('profilePersonalizationDesc'), iconBg: 'var(--app-accent)' },
    { key: 'accounts', icon: UsersIcon, label: t('accounts'), desc: t('accountsDesc'), iconBg: '#e84393' },
    { key: 'notifications', icon: BellIcon, label: t('notifications'), desc: t('notificationsDesc'), iconBg: '#e74c3c' },
    { key: 'privacy', icon: LockIcon, label: t('privacy'), desc: t('privacyDesc'), iconBg: '#f39c12' },
    { key: 'appearance', icon: PaletteIcon, label: t('appearanceAndLanguage'), desc: t('appearanceAndLanguageDesc'), iconBg: '#1abc9c' },
  ];

  const SubPageHeader = ({ title }: { title: string }) => (
    <div className="sticky top-0 z-10 p-4 glass-nav border-b flex items-center gap-3" style={{ borderColor: 'var(--app-border-glass)' }}>
      <button onClick={() => setSubPage('main')} className="p-1 rounded-lg transition-all hover:bg-white/10" style={{ color: 'var(--app-text)' }}>
        <BackIcon size={22} />
      </button>
      <h2 className="text-lg font-bold" style={{ color: 'var(--app-text)' }}>{title}</h2>
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      <div className="liquid-orb" style={{ background: 'var(--app-accent)', width: 300, height: 300, top: '5%', right: '-10%' }} />
      <div className="liquid-orb" style={{ background: 'var(--app-glow)', width: 250, height: 250, bottom: '20%', left: '-8%', animationDelay: '2s' }} />

      <AnimatePresence mode="wait">
        {/* ─── MAIN PAGE ─── */}
        {subPage === 'main' && (
          <motion.div
            key="main"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={springTransition}
            className="flex flex-col h-full overflow-y-auto scroll-smooth-touch"
          >
            <div className="sticky top-0 z-10 p-4 glass-nav border-b" style={{ borderColor: 'var(--app-border-glass)' }}>
              <h2 className="text-xl font-bold" style={{ color: 'var(--app-text)' }}>{t('settings')}</h2>
            </div>

            <div className="p-4 space-y-3 max-w-2xl mx-auto w-full relative z-10">
              {/* Profile card with avatar, name, @username, email */}
              <div className="glass-panel rounded-3xl p-5 flex items-center gap-4">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="w-16 h-16 rounded-full object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-xl"
                       style={{ background: 'var(--app-accent-gradient)', color: '#fff' }}>{initials}</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate" style={{ color: 'var(--app-text)' }}>{displayName || 'User'}</p>
                  <p className="text-sm truncate" style={{ color: 'var(--app-text-muted)' }}>@{username || '...'}</p>
                  {userEmail && (
                    <p className="text-xs truncate mt-0.5" style={{ color: 'var(--app-text-muted)', opacity: 0.7 }}>{userEmail}</p>
                  )}
                </div>
              </div>

              {/* Telegram-style clickable cards */}
              {cards.map(({ key, icon: Icon, label, desc, iconBg }) => (
                <motion.button
                  key={key}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSubPage(key)}
                  className="glass-panel rounded-2xl w-full p-4 flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white"
                       style={{ background: iconBg }}>
                    <Icon size={20} style={{ color: '#fff' }} />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <span className="font-medium block" style={{ color: 'var(--app-text)' }}>{label}</span>
                    <span className="text-xs block truncate" style={{ color: 'var(--app-text-muted)' }}>{desc}</span>
                  </div>
                  <ChevronRightIcon size={18} style={{ color: 'var(--app-text-muted)' }} />
                </motion.button>
              ))}

              {/* Logout */}
              <button onClick={() => { if (confirm(t('confirmLogout'))) signOut(); }}
                      className="w-full py-3 rounded-2xl font-semibold transition-all hover:scale-[1.02] flex items-center justify-center gap-2 border"
                      style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)', color: 'var(--app-danger)' }}>
                <LogOutIcon size={20} /> {t('logout')}
              </button>
              <div className="h-4" />
            </div>
          </motion.div>
        )}

        {/* ─── PROFILE SUB-PAGE ─── */}
        {subPage === 'profile' && (
          <motion.div
            key="profile"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={springTransition}
            className="flex flex-col h-full overflow-y-auto scroll-smooth-touch"
          >
            <SubPageHeader title={t('profilePersonalization')} />

            <div className="p-4 max-w-2xl mx-auto w-full relative z-10">
              <div className="glass-panel rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-4">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="w-20 h-20 rounded-full object-cover" />
                  ) : (
                    <div className="w-20 h-20 rounded-full flex items-center justify-center font-bold text-2xl"
                         style={{ background: 'var(--app-accent-gradient)', color: '#fff' }}>{initials}</div>
                  )}
                  <button onClick={() => fileInputRef.current?.click()}
                          className="px-4 py-2 rounded-xl text-sm font-medium transition-all hover:scale-105 border"
                          style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}>
                    {t('avatar')}
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleAvatarUpload} />
                </div>

                <form onSubmit={handleSave} className="space-y-4">
                  <div>
                    <label className="block text-sm mb-1.5" style={{ color: 'var(--app-text-muted)' }}>{t('displayName')}</label>
                    <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                           className="w-full px-4 py-2.5 rounded-xl outline-none border backdrop-blur-sm"
                           style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }} />
                  </div>
                  <div>
                    <label className="block text-sm mb-1.5" style={{ color: 'var(--app-text-muted)' }}>{t('username')}</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--app-text-muted)' }}>@</span>
                      <input type="text" value={username}
                             onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                             className="w-full pl-8 pr-24 py-2.5 rounded-xl outline-none border backdrop-blur-sm"
                             style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }} />
                      {usernameStatus === 'available' && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs flex items-center gap-1" style={{ color: 'var(--app-success)' }}>
                          <CheckIcon size={14} /> {t('usernameAvailable')}
                        </span>
                      )}
                      {usernameStatus === 'taken' && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--app-danger)' }}>{t('usernameTaken')}</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm mb-1.5" style={{ color: 'var(--app-text-muted)' }}>{t('bio')}</label>
                    <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={2}
                              className="w-full px-4 py-2.5 rounded-xl outline-none border backdrop-blur-sm resize-none"
                              style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }} />
                  </div>

                  {/* Profile Song */}
                  <div>
                    <label className="block text-sm mb-1.5" style={{ color: 'var(--app-text-muted)' }}>{t('profileSong')}</label>
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => songInputRef.current?.click()}
                              className="px-4 py-2 rounded-xl text-sm font-medium border flex items-center gap-2"
                              style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}>
                        <MusicIcon size={16} /> {t('uploadSong')}
                      </button>
                      <input ref={songInputRef} type="file" accept="audio/*" hidden onChange={handleSongUpload} />
                      {songUrl && (
                        <button type="button" onClick={() => setSongUrl('')}
                                className="text-xs px-2 py-1 rounded-lg" style={{ color: 'var(--app-danger)' }}>
                          {t('delete')}
                        </button>
                      )}
                    </div>
                    {songUrl && (
                      <audio controls src={songUrl} className="w-full mt-2 h-10" style={{ borderRadius: '8px' }} />
                    )}
                  </div>

                  <button type="submit" disabled={saving}
                          className="w-full py-2.5 rounded-xl font-semibold transition-all hover:scale-[1.02] disabled:opacity-50"
                          style={{ background: 'var(--app-accent)', color: '#fff' }}>
                    {saved ? <span className="flex items-center justify-center gap-2"><CheckIcon size={18} /> {t('save')}</span> : t('save')}
                  </button>
                </form>
              </div>
              <div className="h-4" />
            </div>
          </motion.div>
        )}

        {/* ─── NOTIFICATIONS SUB-PAGE ─── */}
        {subPage === 'notifications' && (
          <motion.div
            key="notifications"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={springTransition}
            className="flex flex-col h-full overflow-y-auto scroll-smooth-touch"
          >
            <SubPageHeader title={t('notifications')} />

            <div className="p-4 max-w-2xl mx-auto w-full relative z-10 space-y-3">
              <div className="glass-panel rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--app-text-muted)' }}>{t('notificationsTitle')}</h3>
                <div className="space-y-3">
                  {renderToggle(t('messageNotifications'), undefined, notifMessages, () => setNotifMessages(!notifMessages))}
                  <div className="h-px" style={{ background: 'var(--app-border)' }} />
                  {renderToggle(t('callNotifications'), undefined, notifCalls, () => setNotifCalls(!notifCalls))}
                  <div className="h-px" style={{ background: 'var(--app-border)' }} />
                  {renderToggle(t('giftNotifications'), undefined, notifGifts, () => setNotifGifts(!notifGifts))}
                  <div className="h-px" style={{ background: 'var(--app-border)' }} />
                  {renderToggle(t('channelNotifications'), undefined, notifChannels, () => setNotifChannels(!notifChannels))}
                </div>
              </div>
              <div className="glass-panel rounded-2xl p-5 space-y-4">
                {renderToggle(t('sound'), undefined, notifSound, () => setNotifSound(!notifSound))}
                <div className="h-px" style={{ background: 'var(--app-border)' }} />
                {renderToggle(t('vibration'), undefined, notifVibration, () => setNotifVibration(!notifVibration))}
                <div className="h-px" style={{ background: 'var(--app-border)' }} />
                {renderToggle(t('preview'), undefined, notifPreview, () => setNotifPreview(!notifPreview))}
              </div>
              <div className="h-4" />
            </div>
          </motion.div>
        )}

        {/* ─── PRIVACY SUB-PAGE ─── */}
        {subPage === 'privacy' && (
          <motion.div
            key="privacy"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={springTransition}
            className="flex flex-col h-full overflow-y-auto scroll-smooth-touch"
          >
            <SubPageHeader title={t('privacy')} />

            <div className="p-4 max-w-2xl mx-auto w-full relative z-10 space-y-3">
              <div className="glass-panel rounded-2xl p-5 space-y-5">
                {renderToggle(t('ghostMode'), t('ghostModeDesc'), ghostMode, handleGhostModeToggle)}
                <div className="h-px" style={{ background: 'var(--app-border)' }} />
                {renderToggle(t('readReceipts'), undefined, readReceipts, () => setReadReceipts(!readReceipts))}
                <div className="h-px" style={{ background: 'var(--app-border)' }} />
                {renderPrivacySelect(t('whoCanMessageMe'), privacyMessages, setPrivacyMessages)}
                {renderPrivacySelect(t('whoCanCallMe'), privacyCalls, setPrivacyCalls)}

                <button onClick={handlePrivacySave} disabled={privacySaving}
                        className="w-full py-2.5 rounded-xl font-semibold transition-all disabled:opacity-50"
                        style={{ background: 'var(--app-accent)', color: '#fff' }}>
                  {privacySaved ? <span className="flex items-center justify-center gap-2"><CheckIcon size={18} /> {t('save')}</span> : t('save')}
                </button>
              </div>
              <div className="h-4" />
            </div>
          </motion.div>
        )}

        {/* ─── ACCOUNTS SUB-PAGE ─── */}
        {subPage === 'accounts' && (
          <motion.div
            key="accounts"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={springTransition}
            className="flex flex-col h-full overflow-y-auto scroll-smooth-touch"
          >
            <SubPageHeader title={t('accounts')} />

            <div className="p-4 max-w-2xl mx-auto w-full relative z-10 space-y-3">
              {/* Current account */}
              <div className="glass-panel rounded-2xl p-4 flex items-center gap-3">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold"
                       style={{ background: 'var(--app-accent-gradient)', color: '#fff' }}>{initials}</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate" style={{ color: 'var(--app-text)' }}>{displayName || 'User'}</p>
                  <p className="text-sm truncate" style={{ color: 'var(--app-text-muted)' }}>{userEmail}</p>
                </div>
                <span className="text-xs px-2 py-1 rounded-lg font-medium"
                      style={{ background: 'var(--app-surface)', color: 'var(--app-success)' }}>
                  {t('currentAccount')}
                </span>
              </div>

              {/* Other saved accounts */}
              {savedAccounts.filter((a) => a.email !== userEmail).map((account) => (
                <div key={account.email} className="glass-panel rounded-2xl p-4 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold"
                       style={{ background: 'var(--app-surface)', color: 'var(--app-text-muted)' }}>
                    {account.email[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate" style={{ color: 'var(--app-text)' }}>{account.email}</p>
                  </div>
                  <button onClick={() => handleSwitchAccount(account.email)}
                          className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                          style={{ background: 'var(--app-accent)', color: '#fff' }}>
                    {t('switchAccount')}
                  </button>
                  <button onClick={() => handleRemoveAccount(account.email)}
                          className="p-1.5 rounded-lg" style={{ color: 'var(--app-danger)' }}>
                    <LogOutIcon size={16} />
                  </button>
                </div>
              ))}

              {/* Add account button / form */}
              {!showAddAccount ? (
                <button onClick={() => setShowAddAccount(true)}
                        className="w-full glass-panel rounded-2xl p-4 flex items-center gap-3 transition-all hover:scale-[1.02]">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center"
                       style={{ background: 'var(--app-surface)' }}>
                    <AddUserIcon size={22} style={{ color: 'var(--app-accent)' }} />
                  </div>
                  <span className="font-medium" style={{ color: 'var(--app-text)' }}>{t('addAccount')}</span>
                </button>
              ) : (
                <div className="glass-panel rounded-2xl p-5 space-y-3">
                  <h3 className="font-semibold" style={{ color: 'var(--app-text)' }}>{t('addAccount')}</h3>
                  <input type="email" value={addEmail} onChange={(e) => setAddEmail(e.target.value)}
                         placeholder={t('email')}
                         className="w-full px-4 py-2.5 rounded-xl outline-none border backdrop-blur-sm"
                         style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }} />
                  <input type="password" value={addPassword} onChange={(e) => setAddPassword(e.target.value)}
                         placeholder={t('password')}
                         className="w-full px-4 py-2.5 rounded-xl outline-none border backdrop-blur-sm"
                         style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }} />
                  {addError && (
                    <p className="text-sm" style={{ color: 'var(--app-danger)' }}>{addError}</p>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => { setShowAddAccount(false); setAddEmail(''); setAddPassword(''); setAddError(null); }}
                            className="flex-1 py-2.5 rounded-xl font-medium border"
                            style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}>
                      {t('cancel')}
                    </button>
                    <button onClick={handleAddAccount} disabled={addingAccount}
                            className="flex-1 py-2.5 rounded-xl font-semibold disabled:opacity-50"
                            style={{ background: 'var(--app-accent)', color: '#fff' }}>
                      {addingAccount ? '...' : t('addAccount')}
                    </button>
                  </div>
                </div>
              )}
              <div className="h-4" />
            </div>
          </motion.div>
        )}

        {/* ─── APPEARANCE + LANGUAGE SUB-PAGE ─── */}
        {subPage === 'appearance' && (
          <motion.div
            key="appearance"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={springTransition}
            className="flex flex-col h-full overflow-y-auto scroll-smooth-touch"
          >
            <SubPageHeader title={t('appearanceAndLanguage')} />

            <div className="p-4 max-w-2xl mx-auto w-full relative z-10 space-y-3">
              {/* Theme picker */}
              <div className="glass-panel rounded-2xl p-5">
                <h3 className="flex items-center gap-2 font-semibold mb-4" style={{ color: 'var(--app-text)' }}>
                  <PaletteIcon size={20} style={{ color: 'var(--app-accent)' }} /> {t('theme')}
                </h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {themeList.map((key) => (
                    <button key={key} onClick={() => setTheme(key)}
                            className="flex flex-col items-center gap-2 p-3 rounded-xl transition-all border"
                            style={{ background: theme === key ? 'var(--app-surface)' : 'transparent', borderColor: theme === key ? 'var(--app-accent)' : 'var(--app-border)', borderWidth: theme === key ? '2px' : '1px' }}>
                      <div className="w-10 h-10 rounded-full" style={{ background: themes[key].accentGradient }} />
                      <span className="text-sm font-medium" style={{ color: 'var(--app-text)' }}>{themeLabels[key]}</span>
                      {theme === key && <CheckIcon size={16} style={{ color: 'var(--app-accent)' }} />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chat Size selector */}
              <div className="glass-panel rounded-2xl p-5">
                <h3 className="font-semibold mb-4" style={{ color: 'var(--app-text)' }}>{t('chatSize')}</h3>
                <p className="text-xs mb-3" style={{ color: 'var(--app-text-muted)' }}>{t('chatSizeDesc')}</p>
                <div className="grid grid-cols-3 gap-2">
                  {chatSizeOptions.map(({ key, label }) => (
                    <button key={key} onClick={() => handleChatSizeChange(key)}
                            className="py-2.5 rounded-xl text-sm font-medium transition-all border"
                            style={{
                              background: chatSize === key ? 'var(--app-accent)' : 'var(--app-surface)',
                              color: chatSize === key ? '#fff' : 'var(--app-text)',
                              borderColor: chatSize === key ? 'transparent' : 'var(--app-border)',
                            }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Language picker */}
              <div className="glass-panel rounded-2xl p-5">
                <h3 className="flex items-center gap-2 font-semibold mb-4" style={{ color: 'var(--app-text)' }}>
                  <GlobeIcon size={20} style={{ color: 'var(--app-accent)' }} /> {t('language')}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {langOptions.map(({ key, label }) => (
                    <button key={key} onClick={() => setLang(key)}
                            className="py-2.5 rounded-xl font-medium transition-all border flex items-center justify-center gap-2"
                            style={{ background: lang === key ? 'var(--app-accent)' : 'var(--app-surface)', color: lang === key ? '#fff' : 'var(--app-text)', borderColor: 'var(--app-border)' }}>
                      {lang === key && <CheckIcon size={16} />}
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-4" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
