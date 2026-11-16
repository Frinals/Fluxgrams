import { useState, useEffect, useCallback, memo } from 'react';
import { supabase, Call, Profile } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { PhoneIncomingIcon, PhoneOutgoingIcon, PhoneOffIcon, VideoIcon } from '@/components/Icons';

export default function CallsView() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [calls, setCalls] = useState<(Call & { peer: Profile | null; isOutgoing: boolean })[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCalls = useCallback(async () => {
    if (!user) return;

    const { data } = await supabase
      .from('calls')
      .select('*')
      .or(`caller_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!data) {
      setLoading(false);
      return;
    }

    const peerIds = [...new Set(
      data.map((c) => (c.caller_id === user.id ? c.receiver_id : c.caller_id))
    )];

    const { data: profiles } = await supabase.from('profiles').select('*').in('id', peerIds);

    const cache: Record<string, Profile> = {};
    if (profiles) {
      for (const p of profiles) cache[p.id] = p as Profile;
    }

    const enriched = data.map((c) => ({
      ...c,
      peer: cache[c.caller_id === user.id ? c.receiver_id : c.caller_id] ?? null,
      isOutgoing: c.caller_id === user.id,
    }));

    setCalls(enriched);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadCalls();
    const channel = supabase
      .channel('calls_list_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calls' }, () => loadCalls())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadCalls]);

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--app-bg)' }}>
      <div className="sticky top-0 z-10 px-5 py-4 glass-nav border-b" style={{ borderColor: 'var(--app-border-glass)' }}>
        <h2 className="text-[26px] font-bold tracking-tight" style={{ color: 'var(--app-text)' }}>{t('calls')}</h2>
      </div>

      <div className="flex-1 overflow-y-auto scroll-smooth-touch pb-28">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-2 rounded-full animate-spin border-t-transparent" style={{ borderColor: 'var(--app-accent)' }} />
          </div>
        ) : calls.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 opacity-50">
            <p className="text-sm font-medium" style={{ color: 'var(--app-text)' }}>{t('noCalls')}</p>
          </div>
        ) : (
          <div className="px-2 pt-2">
            {calls.map((call) => (
              <CallListItem key={call.id} call={call} t={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Вынесенный компонент для производительности (никаких лагов)
const CallListItem = memo(function CallListItem({ call, t }: { call: any, t: any }) {
  const name = call.peer?.display_name || call.peer?.username || 'Unknown';
  const initials = name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
  const isMissed = call.status === 'missed' || call.status === 'declined';
  
  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="w-full flex items-center gap-4 px-3 py-3 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
      <div className="relative flex-shrink-0">
        <div className="w-[50px] h-[50px] rounded-full p-[2px]" style={{ background: 'var(--app-accent-gradient)' }}>
          {call.peer?.avatar_url ? (
            <img src={call.peer.avatar_url} alt="" className="w-full h-full rounded-full object-cover border-2" style={{ borderColor: 'var(--app-bg)' }} />
          ) : (
            <div className="w-full h-full rounded-full flex items-center justify-center font-semibold text-[17px] border-2" style={{ background: 'var(--app-surface)', color: 'var(--app-text)', borderColor: 'var(--app-bg)' }}>
              {initials}
            </div>
          )}
        </div>
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[16px] truncate" style={{ color: isMissed ? 'var(--app-danger)' : 'var(--app-text)' }}>
          {name}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {isMissed ? (
            <PhoneOffIcon size={14} style={{ color: 'var(--app-danger)' }} />
          ) : call.isOutgoing ? (
            <PhoneOutgoingIcon size={14} style={{ color: 'var(--app-text-muted)' }} />
          ) : (
            <PhoneIncomingIcon size={14} style={{ color: 'var(--app-success)' }} />
          )}
          <span className="text-[14px] truncate" style={{ color: 'var(--app-text-muted)' }}>
            {isMissed ? 'Пропущенный' : (call.isOutgoing ? 'Исходящий' : 'Входящий')}
          </span>
        </div>
      </div>
      
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        {call.call_type === 'video' && <VideoIcon size={16} style={{ color: 'var(--app-text-muted)' }} />}
        <span className="text-[12px] font-medium" style={{ color: 'var(--app-text-muted)' }}>
          {formatTime(call.created_at)}
        </span>
      </div>
    </div>
  );
});
