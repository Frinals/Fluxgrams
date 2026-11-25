import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { VerifiedIcon } from '@/components/Icons';

export default function SearchView({ onOpenChat, onViewProfile }: any) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    const search = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
        .neq('id', user?.id)
        .limit(20);
      
      if (data) setResults(data);
      setLoading(false);
    };

    const timer = setTimeout(search, 400); // Плавный поиск: ждем 0.4 сек после ввода
    return () => clearTimeout(timer);
  }, [query, user]);

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--app-bg)' }}>
      <div className="p-4 sticky top-0 z-10" style={{ background: 'var(--app-bg)' }}>
        <h2 className="text-[26px] font-bold mb-4" style={{ color: 'var(--app-text)' }}>Поиск</h2>
        <input 
          type="text" 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по @username или имени..."
          className="w-full px-5 py-3.5 rounded-2xl outline-none border text-[16px]"
          style={{ background: 'var(--app-surface)', color: 'var(--app-text)', borderColor: 'var(--app-border)' }}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-24">
        {loading && <p className="text-center mt-4" style={{ color: 'var(--app-text-muted)' }}>Ищем...</p>}
        {!loading && query.length >= 2 && results.length === 0 && (
          <p className="text-center mt-4" style={{ color: 'var(--app-text-muted)' }}>Никого не нашли</p>
        )}
        
        {results.map((p) => (
          <div key={p.id} className="flex items-center gap-3 p-3 rounded-2xl mb-2 border" style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
            <div onClick={() => onViewProfile(p.id)} className="w-12 h-12 rounded-full overflow-hidden cursor-pointer flex items-center justify-center text-white font-bold" style={{ background: 'var(--app-accent)' }}>
              {p.avatar_url ? <img src={p.avatar_url} className="w-full h-full object-cover" /> : (p.display_name || 'U')[0]}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-1">
                <p className="font-semibold text-[16px]" style={{ color: 'var(--app-text)' }}>{p.display_name || 'User'}</p>
                {p.is_verified && <VerifiedIcon size={16} className="text-blue-500" />}
              </div>
              <p className="text-sm" style={{ color: 'var(--app-text-muted)' }}>@{p.username || 'user'}</p>
            </div>
            <button onClick={() => onOpenChat(null, p)} className="px-4 py-2 rounded-xl text-white text-sm font-semibold" style={{ background: 'var(--app-accent)' }}>
              Написать
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
