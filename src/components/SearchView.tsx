import { useState, useEffect } from 'react';
import { supabase, Profile, Group } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { SearchIcon, VerifiedIcon } from '@/components/Icons';

export default function SearchView({ onOpenChat, onOpenGroup, onViewProfile }: any) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ profiles: Profile[], groups: Group[] }>({ profiles: [], groups: [] });
  const [loading, setLoading] = useState(false);

  // ПЛАВНЫЙ ПОИСК (Debounce)
  useEffect(() => {
    if (!query.trim() || !user) {
      setResults({ profiles: [], groups: [] });
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setLoading(true);
      const clean = query.replace('@', '');

      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .ilike('username', `%${clean}%`)
        .neq('id', user.id)
        .limit(20);

      const { data: groups } = await supabase
        .from('groups')
        .select('*')
        .ilike('name', `%${clean}%`)
        .limit(20);

      setResults({ profiles: profiles || [], groups: groups || [] });
      setLoading(false);
    }, 400); // Ждем 400мс после последнего нажатия клавиши

    return () => clearTimeout(delayDebounceFn);
  }, [query, user]);

  const startChat = async (peer: Profile) => {
    if (!user) return;
    const { data: chatId } = await supabase.rpc('create_chat_with_participants', { peer_id: peer.id });
    if (chatId) onOpenChat(chatId, peer);
  };

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--app-bg)' }}>
      <div className="sticky top-0 z-20 px-5 py-4 glass-nav border-b" style={{ borderColor: 'var(--app-border-glass)' }}>
        <h2 className="text-[26px] font-bold" style={{ color: 'var(--app-text)' }}>Поиск</h2>
      </div>
      
      <div className="p-4 flex-shrink-0">
        <div className="relative flex items-center">
          <SearchIcon size={20} className="absolute left-3" style={{ color: 'var(--app-text-muted)' }} />
          <input 
            type="text" 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Введите @юзернейм..." 
            className="w-full pl-10 pr-4 p-3 rounded-xl border outline-none"
            style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-10">
        {loading && <p className="text-center mt-4 text-sm" style={{ color: 'var(--app-text-muted)' }}>Поиск...</p>}
        
        {/* Люди */}
        {results.profiles.map((p) => (
          <div key={p.id} className="flex items-center justify-between p-3 hover:bg-white/5 rounded-xl">
            <div className="flex items-center gap-3">
              {p.avatar_url ? <img src={p.avatar_url} className="w-10 h-10 rounded-full object-cover" /> : <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">{(p.username || '?')[0].toUpperCase()}</div>}
              <div>
                <div className="flex items-center gap-1">
                  <p className="font-bold" style={{ color: 'var(--app-text)' }}>{p.display_name || p.username}</p>
                  {(p as any).is_verified && <VerifiedIcon size={14} />}
                </div>
                <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>@{p.username}</p>
              </div>
            </div>
            <button 
              onClick={() => onViewProfile(p)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-500 text-white"
            >
              Просмотреть
            </button>
          </div>
        ))}
        
        {/* Группы */}
        {results.groups.map((g) => (
          <div key={g.id} onClick={() => onOpenGroup(g)} className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl cursor-pointer">
            {g.avatar_url ? <img src={g.avatar_url} className="w-10 h-10 rounded-full object-cover" /> : <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold">{(g.name || '?')[0].toUpperCase()}</div>}
            <div>
              <p className="font-bold" style={{ color: 'var(--app-text)' }}>{g.name}</p>
              <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>Группа</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
