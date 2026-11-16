import { useState, useEffect, useCallback } from 'react';
import { supabase, Call, Profile } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { PhoneIncomingIcon, PhoneOutgoingIcon, PhoneOffIcon, VideoIcon } from '@/components/Icons';

export default function CallsView() {
  const { user } = useAuth();
  const [calls, setCalls] = useState<(Call & { peer: Profile | null; isOutgoing: boolean })[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCalls = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('calls')
        .select('*')
        .or(`caller_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error || !data) {
        setCalls([]);
        setLoading(false);
        return;
      }

      const peerIds = [...new Set(data.map((c) => (c.caller_id === user.id ? c.receiver_id : c.caller_id)))];
      const { data: profiles } = await supabase.from('profiles').select('*').in('id', peerIds);

      const cache: Record<string, Profile> = {};
      if (profiles) {
        for (const p of profiles) cache[p.id] = p as Profile;
      }

      setCalls(data.map((c) => ({
        ...c,
        peer: cache[c.caller_id === user.id ? c.receiver_id : c.caller_id] ?? null,
        isOutgoing: c.caller_id === user.id,
      })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadCalls();
  }, [loadCalls]);

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--app-bg)' }}>
      <div className="sticky top-0 z-10 px-5 py-4 glass-nav border-b" style={{ borderColor: 'var(--app-border-glass)' }}>
        <h2 className="text-[26px] font-bold tracking-tight" style={{ color: 'var(--app-text)' }}>Звонки</h2>
      </div>
      <div className="flex-1 overflow-y-auto pb-28">
        {loading ? (
          <div className="flex justify-center p-10"><div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--app-accent)' }} /></div>
        ) : calls.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 opacity-50">
            <p className="text-sm font-medium" style={{ color: 'var(--app-text)' }}>Нет недавних звонков</p>
          </div>
        ) : (
          <div className="px-2 pt-2">
            {calls.map((call) => (
              <div key={call.id} className="flex items-center gap-4 px-3 py-3 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5">
                <div className="w-[50px] h-[50px] rounded-full flex items-center justify-center font-semibold text-[17px] border-2" style={{ background: 'var(--app-surface)', color: 'var(--app-text)', borderColor: 'var(--app-bg)' }}>
                  {(call.peer?.display_name || '?').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[16px] truncate" style={{ color: call.status === 'missed' ? 'var(--app-danger)' : 'var(--app-text)' }}>
                    {call.peer?.display_name || 'Неизвестный'}
                  </p>
                  <div className="flex items-center gap-1.5">
                    {call.status === 'missed' ? <PhoneOffIcon size={14} style={{ color: 'var(--app-danger)' }} /> : call.isOutgoing ? <PhoneOutgoingIcon size={14} style={{ color: 'var(--app-text-muted)' }} /> : <PhoneIncomingIcon size={14} style={{ color: 'var(--app-success)' }} />}
                    <span className="text-[14px]" style={{ color: 'var(--app-text-muted)' }}>{call.status === 'missed' ? 'Пропущенный' : call.isOutgoing ? 'Исходящий' : 'Входящий'}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {call.call_type === 'video' && <VideoIcon size={16} style={{ color: 'var(--app-text-muted)' }} />}
                  <span className="text-[12px]" style={{ color: 'var(--app-text-muted)' }}>{new Date(call.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
