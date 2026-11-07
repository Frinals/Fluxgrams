import { useState, useEffect, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, Profile, GroupType } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { XIcon, CheckIcon, GroupIcon, ChannelIcon, SearchIcon, ImageIcon } from '@/components/Icons';

interface Props {
  type: GroupType;
  onClose: () => void;
  onCreated: (groupId: string, groupName: string, groupType: GroupType) => void;
}

const springTransition = { type: 'spring' as const, stiffness: 300, damping: 30 };

function CreateGroupModalInner({ type, onClose, onCreated }: Props) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [channelUsername, setChannelUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'available' | 'taken'>('idle');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const isChannel = type === 'channel';

  // Channel username check
  useEffect(() => {
    if (!isChannel) return;
    if (!channelUsername.trim()) { setUsernameStatus('idle'); return; }
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from('groups')
        .select('id')
        .eq('channel_username', channelUsername.trim())
        .maybeSingle();
      setUsernameStatus(data ? 'taken' : 'available');
    }, 500);
    return () => clearTimeout(timeout);
  }, [channelUsername, isChannel]);

  // Member search (only for groups)
  useEffect(() => {
    if (isChannel) return;
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const timeout = setTimeout(async () => {
      const query = searchQuery.replace('@', '').trim();
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
        .neq('id', user?.id ?? '')
        .limit(20);
      setSearchResults((data ?? []) as Profile[]);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery, user, isChannel]);

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingAvatar(true);
    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `group-avatars/${user.id}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('chat-media').upload(fileName, file);
    if (uploadError) { console.error('[CreateGroup] Avatar upload error:', uploadError); setUploadingAvatar(false); return; }
    const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(fileName);
    setAvatarUrl(urlData.publicUrl);
    setUploadingAvatar(false);
    e.target.value = '';
  };

  const toggleUser = (id: string) => {
    setSelectedUsers((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const handleCreate = async () => {
    if (!user || !name.trim()) return;
    if (isChannel && !channelUsername.trim()) return;
    if (isChannel && usernameStatus === 'taken') return;
    setCreating(true);

    const insertData: Record<string, unknown> = {
      name: name.trim(),
      description: description.trim() || null,
      avatar_url: avatarUrl,
      type,
      owner_id: user.id,
    };

    if (isChannel) {
      insertData.channel_username = channelUsername.trim();
    }

    const { data: group, error } = await supabase
      .from('groups')
      .insert(insertData)
      .select('*')
      .maybeSingle();

    if (error || !group) {
      console.error('[CreateGroup] Failed:', error);
      setCreating(false);
      return;
    }

    const members = [
      { group_id: group.id, user_id: user.id, role: 'owner' as const },
      ...(!isChannel ? Array.from(selectedUsers).map((uid) => ({ group_id: group.id, user_id: uid, role: 'member' as const })) : []),
    ];

    const { error: memberError } = await supabase.from('group_members').insert(members);
    if (memberError) console.error('[CreateGroup] Members insert failed:', memberError);

    setCreating(false);
    onCreated(group.id, group.name, group.type);
  };

  const getInitials = (p: Profile) =>
    (p.display_name || p.username || '?').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  const canCreate = name.trim() && (!isChannel || (channelUsername.trim() && usernameStatus !== 'taken'));

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={springTransition}
        className="glass-panel rounded-3xl p-6 max-w-md w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          {isChannel ? <ChannelIcon size={24} style={{ color: 'var(--app-accent)' }} /> : <GroupIcon size={24} style={{ color: 'var(--app-accent)' }} />}
          <h2 className="text-lg font-bold flex-1" style={{ color: 'var(--app-text)' }}>
            {isChannel ? t('newChannel') : t('newGroup')}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10" style={{ color: 'var(--app-text-muted)' }}>
            <XIcon size={20} />
          </button>
        </div>

        {/* Avatar upload + Name */}
        <div className="flex items-center gap-4 mb-4">
          <button onClick={() => avatarInputRef.current?.click()} disabled={uploadingAvatar}
                  className="w-20 h-20 rounded-full flex items-center justify-center flex-shrink-0 transition-all hover:scale-105 relative overflow-hidden"
                  style={{ background: 'var(--app-accent-gradient)', color: '#fff' }}>
            {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            : uploadingAvatar ? <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
            : <ImageIcon size={28} />}
          </button>
          <input ref={avatarInputRef} type="file" accept="image/*" hidden onChange={handleAvatarSelect} />
          <div className="flex-1">
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                   placeholder={isChannel ? t('channelName') : t('groupName')}
                   className="w-full px-4 py-2.5 rounded-xl outline-none border backdrop-blur-sm"
                   style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }} />
          </div>
        </div>

        {/* Description */}
        <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
               placeholder={t('description')}
               className="w-full px-4 py-2.5 rounded-xl outline-none border backdrop-blur-sm mb-4"
               style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }} />

        {isChannel ? (
          /* Channel username field */
          <div className="mb-4">
            <label className="block text-sm mb-1.5" style={{ color: 'var(--app-text-muted)' }}>{t('channelUsername')}</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--app-text-muted)' }}>@</span>
              <input type="text" value={channelUsername}
                     onChange={(e) => setChannelUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                     placeholder="mychannel"
                     className="w-full pl-8 pr-24 py-2.5 rounded-xl outline-none border backdrop-blur-sm"
                     style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }} />
              {usernameStatus === 'available' && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs flex items-center gap-1" style={{ color: 'var(--app-success)' }}>
                  <CheckIcon size={14} /> {t('usernameAvailable')}
                </span>
              )}
              {usernameStatus === 'taken' && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--app-danger)' }}>
                  {t('usernameTaken')}
                </span>
              )}
            </div>
            <p className="text-xs mt-2" style={{ color: 'var(--app-text-muted)' }}>
              Users can search and subscribe to your channel by this username.
            </p>
          </div>
        ) : (
          /* Member search — only for groups */
          <>
            <p className="text-sm font-semibold mb-2" style={{ color: 'var(--app-text-muted)' }}>{t('addMembers')}</p>
            <div className="relative mb-3">
              <SearchIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--app-text-muted)' }} />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                     placeholder={t('selectMembers')}
                     className="w-full pl-10 pr-4 py-2.5 rounded-xl outline-none border backdrop-blur-sm"
                     style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }} />
            </div>
            {selectedUsers.size > 0 && (
              <p className="text-xs mb-2" style={{ color: 'var(--app-accent)' }}>{selectedUsers.size} {t('members')}</p>
            )}
            <div className="flex-1 overflow-y-auto space-y-1 mb-4 scroll-smooth-touch" style={{ maxHeight: 200 }}>
              <AnimatePresence>
                {searchResults.map((p) => {
                  const isSelected = selectedUsers.has(p.id);
                  return (
                    <motion.button key={p.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      onClick={() => toggleUser(p.id)}
                      className="w-full flex items-center gap-3 p-2.5 rounded-xl transition-all border"
                      style={{ background: isSelected ? 'var(--app-surface)' : 'transparent', borderColor: isSelected ? 'var(--app-accent)' : 'transparent' }}>
                      {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                      : <div className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm" style={{ background: 'var(--app-accent-gradient)', color: '#fff' }}>{getInitials(p)}</div>}
                      <div className="flex-1 text-left min-w-0">
                        <p className="font-medium truncate text-sm" style={{ color: 'var(--app-text)' }}>{p.display_name || 'User'}</p>
                        <p className="text-xs truncate" style={{ color: 'var(--app-text-muted)' }}>@{p.username || '...'}</p>
                      </div>
                      {isSelected && <CheckIcon size={18} style={{ color: 'var(--app-accent)' }} />}
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </div>
          </>
        )}

        {/* Create button */}
        <motion.button whileTap={{ scale: 0.96 }} onClick={handleCreate} disabled={!canCreate || creating}
                className="w-full py-3 rounded-xl font-semibold transition-all disabled:opacity-50"
                style={{ background: 'var(--app-accent)', color: '#fff' }}>
          {creating ? '...' : (isChannel ? t('createChannel') : t('createGroup'))}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

export const CreateGroupModal = memo(CreateGroupModalInner);
