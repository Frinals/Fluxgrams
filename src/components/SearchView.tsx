import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, Profile, Group } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { SearchIcon, ChannelIcon, CheckIcon, XIcon } from '@/components/Icons';

interface Props {
  onOpenChat: (chatId: string, peer: Profile) => void;
  onOpenGroup: (group: Group) => void;
}

const springTransition = { type: 'spring' as const, stiffness: 300, damping: 30 };

export default function SearchView({ onOpenChat, onOpenGroup }: Props) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [userResults, setUserResults] = useState<Profile[]>([]);
  const [channelResults, setChannelResults] = useState<Group[]>([]);
  const [searching, setSearching] = useState(false);
  const [subscribedChannelIds, setSubscribedChannelIds] = useState<Set<string>>(new Set());
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [startingChatId, setStartingChatId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  const loadSubscriptions = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', user.id);
    if (data) {
      setSubscribedChannelIds(new Set(data.map((d) => d.group_id)));
    }
  }, [user]);

  useEffect(() => {
    loadSubscriptions();
  }, [loadSubscriptions]);

  useEffect(() => {
    const q = query.replace('@', '').trim();
    if (!q) {
      setUserResults([]);
      setChannelResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      const [usersRes, channelsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
          .neq('id', user?.id ?? '')
          .limit(10),
        supabase
          .from('groups')
          .select('*')
          .eq('type', 'channel')
          .or(`channel_username.ilike.%${q}%,name.ilike.%${q}%`)
          .limit(10),
      ]);
      setUserResults((usersRes.data ?? []) as Profile[]);
      setChannelResults((channelsRes.data ?? []) as Group[]);
      setSearching(false);
    }, 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [query, user]);

  const startChat = async (peer: Profile) => {
    if (!user || startingChatId) return;
    setStartingChatId(peer.id);
    setActionError(null);
    const { data: chatId, error } = await supabase.rpc('create_chat_with_participants', { peer_id: peer.id });
    if (error || !chatId) {
      setActionError(error?.message ?? 'Unable to open chat');
      setStartingChatId(null);
      return;
    }
    setStartingChatId(null);
    onOpenChat(chatId as string, peer);
  };

  const handleSubscribe = async (channel: Group) => {
    if (!user) return;
    setJoiningId(channel.id);
    const { error } = await supabase
      .from('group_members')
      .insert({ group_id: channel.id, user_id: user.id, role: 'member' });
    if (!error) {
      setSubscribedChannelIds((prev) => new Set([...prev, channel.id]));
    }
    setJoiningId(null);
  };

  const hasResults = userResults.length > 0 || channelResults.length > 0;

  return (
    <div className="flex flex-col h-full relative">
      <div className="liquid-orb" style={{ background: 'var(--app-accent)', width: 250, height: 250, top: '5%', right: '-10%' }} />
      <div className="liquid-orb" style={{ background: 'var(--app-glow)', width: 200, height: 200, bottom: '25%', left: '-8%', animationDelay: '3s' }} />

      {/* Search header */}
      <div className="sticky top-0 z-10 p-4 glass-nav border-b" style={{ borderColor: 'var(--app-border-glass)' }}>
        <div className="relative">
          <SearchIcon size={20} className="absolute left-3 top-1/2 -translate-y-1/2"
                       style={{ color: 'var(--app-text-muted)' }} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchUsersOrChannels')}
            autoFocus
            className="w-full pl-11 pr-10 py-2.5 rounded-xl outline-none border backdrop-blur-sm transition-all"
            style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
          />
          {query && (
            <button onClick={() => setQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full transition-all hover:bg-white/10"
                    style={{ color: 'var(--app-text-muted)' }}>
              <XIcon size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-smooth-touch">
        {actionError && (
          <p className="mx-4 mt-3 rounded-xl border p-3 text-sm" style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)', color: 'var(--app-danger)' }}>
            {actionError}
          </p>
        )}
        {!query.trim() ? (
          <div className="flex flex-col items-center justify-center h-64 p-8 text-center">
            <SearchIcon size={48} style={{ color: 'var(--app-text-muted)', opacity: 0.4 }} />
            <p className="text-sm mt-3" style={{ color: 'var(--app-text-muted)' }}>{t('searchUsersOrChannels')}</p>
          </div>
        ) : searching ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-2 rounded-full animate-spin"
                 style={{ borderColor: 'var(--app-border)', borderTopColor: 'var(--app-accent)' }} />
          </div>
        ) : !hasResults ? (
          <div className="flex flex-col items-center justify-center h-40 p-8 text-center">
            <p className="text-sm" style={{ color: 'var(--app-text-muted)' }}>{t('noResults')}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--app-text-muted)', opacity: 0.6 }}>{t('noChannelFound')}</p>
          </div>
        ) : (
          <div className="p-4 space-y-5 max-w-2xl mx-auto w-full">
            {/* Users section */}
            {userResults.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider mb-2 px-1" style={{ color: 'var(--app-text-muted)' }}>
                  {t('profile')}
                </h3>
                <div className="space-y-2">
                  <AnimatePresence>
                    {userResults.map((peer, idx) => (
                      <motion.button
                        key={peer.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ ...springTransition, delay: idx * 0.05 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => startChat(peer)}
                        className="w-full flex items-center gap-3 p-3 rounded-2xl glass-panel"
                      >
                        <ResultAvatar profile={peer} />
                        <div className="flex-1 text-left min-w-0">
                          <p className="font-semibold truncate" style={{ color: 'var(--app-text)' }}>
                            {peer.display_name || 'User'}
                          </p>
                          <p className="text-sm truncate" style={{ color: 'var(--app-text-muted)' }}>
                            {peer.username ? `@${peer.username}` : t('usernameSet')}
                          </p>
                        </div>
                        <span className="px-3 py-1.5 rounded-lg text-xs font-medium flex-shrink-0"
                              style={{ background: 'var(--app-accent)', color: '#fff' }}>
                          {startingChatId === peer.id ? '...' : t('startChat')}
                        </span>
                      </motion.button>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* Channels section */}
            {channelResults.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider mb-2 px-1" style={{ color: 'var(--app-text-muted)' }}>
                  {t('newChannel')}
                </h3>
                <div className="space-y-2">
                  <AnimatePresence>
                    {channelResults.map((channel, idx) => {
                      const isSubscribed = subscribedChannelIds.has(channel.id);
                      return (
                        <motion.div
                          key={channel.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ ...springTransition, delay: idx * 0.05 }}
                          className="w-full flex items-center gap-3 p-3 rounded-2xl glass-panel"
                        >
                          <ChannelAvatar group={channel} />
                          <button
                            onClick={() => onOpenGroup(channel)}
                            className="flex-1 text-left min-w-0"
                          >
                            <p className="font-semibold truncate flex items-center gap-1.5" style={{ color: 'var(--app-text)' }}>
                              <ChannelIcon size={15} style={{ color: 'var(--app-accent)', flexShrink: 0 }} />
                              {channel.name}
                            </p>
                            <p className="text-sm truncate" style={{ color: 'var(--app-text-muted)' }}>
                              {channel.channel_username ? `@${channel.channel_username}` : (channel.description || '...')}
                            </p>
                          </button>
                          {isSubscribed ? (
                            <span className="px-3 py-1.5 rounded-lg text-xs font-medium flex-shrink-0 flex items-center gap-1"
                                  style={{ background: 'var(--app-surface)', color: 'var(--app-success)', border: '1px solid var(--app-border)' }}>
                              <CheckIcon size={14} /> {t('joined')}
                            </span>
                          ) : (
                            <motion.button
                              whileTap={{ scale: 0.95 }}
                              disabled={joiningId === channel.id}
                              onClick={() => handleSubscribe(channel)}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium flex-shrink-0 disabled:opacity-50"
                              style={{ background: 'var(--app-accent)', color: '#fff' }}
                            >
                              {t('subscribe')}
                            </motion.button>
                          )}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ResultAvatar({ profile }: { profile: Profile }) {
  const initials = (profile.display_name || profile.username || '?')
    .split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
  if (profile.avatar_url) {
    return <img src={profile.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover flex-shrink-0" />;
  }
  return (
    <div className="w-11 h-11 rounded-full flex items-center justify-center font-semibold flex-shrink-0 text-sm"
         style={{ background: 'var(--app-accent-gradient)', color: '#fff' }}>{initials}</div>
  );
}

function ChannelAvatar({ group }: { group: Group }) {
  if (group.avatar_url) {
    return <img src={group.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover flex-shrink-0" />;
  }
  return (
    <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
         style={{ background: 'var(--app-accent-gradient)', color: '#fff' }}>
      <ChannelIcon size={20} />
    </div>
  );
}
