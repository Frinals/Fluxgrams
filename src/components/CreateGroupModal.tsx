import { useState } from 'react';
import { motion } from 'framer-motion';
import { supabase, GroupType } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { GroupIcon, ChannelIcon } from '@/components/Icons';

interface Props {
  type: GroupType;
  onClose: () => void;
  onCreated: (groupId: string, name: string, type: GroupType) => void;
}

export function CreateGroupModal({ type, onClose, onCreated }: Props) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !user) {
      setError('Введите название');
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .insert({
          name: name.trim(),
          type: type,
          owner_id: user.id,
          username: type === 'channel' ? username.trim() : null
        })
        .select()
        .single();

      if (groupError) throw groupError;

      const { error: memberError } = await supabase
        .from('group_members')
        .insert({
          group_id: groupData.id,
          user_id: user.id,
          role: 'admin'
        });

      if (memberError) throw memberError;

      onCreated(groupData.id, groupData.name, type);
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Ошибка при создании');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="w-full max-w-md rounded-3xl p-6 shadow-2xl glass-panel"
        style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'var(--app-accent-gradient)', color: '#fff' }}>
            {type === 'channel' ? <ChannelIcon size={24} /> : <GroupIcon size={24} />}
          </div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--app-text)' }}>
            {type === 'channel' ? 'Новый канал' : 'Новая группа'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1" style={{ color: 'var(--app-text-muted)' }}>Название</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Друзья"
              className="w-full px-4 py-3 rounded-xl outline-none border"
              style={{ background: 'var(--app-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
            />
          </div>

          {type === 'channel' && (
            <div>
              <label className="block text-sm mb-1" style={{ color: 'var(--app-text-muted)' }}>Юзернейм канала</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                placeholder="@my_channel"
                className="w-full px-4 py-3 rounded-xl outline-none border"
                style={{ background: 'var(--app-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
              />
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl font-medium border"
              style={{ background: 'transparent', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 rounded-xl font-semibold disabled:opacity-50"
              style={{ background: 'var(--app-accent)', color: '#fff' }}
            >
              {loading ? 'Создание...' : 'Создать'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
