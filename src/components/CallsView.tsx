import { useState, useEffect, useCallback } from 'react';
import { supabase, Call, Profile } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { PhoneIncomingIcon, PhoneOutgoingIcon, PhoneOffIcon, VideoIcon } from '@/components/Icons';

export default function CallsView() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [calls, setCalls] = useState<(Call & { peer: Profile | null; isOutgoing: boolean })[]>([]);
  const [loading, setLoading] = useState(true);
  const [peerCache, setPeerCache] = useState<Record<string, Profile>>({});

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

    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .in('id', peerIds);

    const cache: Record<string, Profile> = {};
    if (profiles) {
      for (const p of profiles) {
        cache[p.id] = p as Profile;
      }
      setPeerCache(cache);
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
      .channel('calls_list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calls' }, () => loadCalls())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadCalls]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getInitials = (name: string) =>
    name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  const statusColor = (status: string) => {
    if (status === 'missed') return 'var(--app-danger)';
    if (status === 'declined') return 'var(--app-text-muted)';
    if (status === 'accepted' || status === 'ended') return 'var(--app-success)';
    return 'var(--app-text-muted)';
  };

  const statusLabel = (call: Call & { isOutgoing: boolean }) => {
    if (call.status === 'missed') return t('missed');
    if (call.status === 'declined') return t('callDeclined');
    if (call.status === 'ended') return t('callEnded');
    if (call.status === 'pending') return t('calling');
    if (call.status === 'accepted') return t('callConnected');
    return call.isOutgoing ? t('outgoing') : t('incoming');
  };

  return (
    <div className="flex flex-col h-full relative">
      {/* Liquid background orbs */}
      <div className="liquid-orb" style={{ background: 'var(--app-accent)', width: 250, height: 250, top: '10%', left: '-10%' }} />
      <div className="liquid-orb" style={{ background: 'var(--app-glow)', width: 200, height: 200, bottom: '20%', right: '-8%', animationDelay: '2.5s' }} />

      <div className="sticky top-0 z-10 p-4 glass-nav border-b"
           style={{ borderColor: 'var(--app-border-glass)' }}>
        <h2 className="text-xl font-bold" style={{ color: 'var(--app-text)' }}>{t('calls')}</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-2 rounded-full animate-spin"
                 style={{ borderColor: 'var(--app-border)', borderTopColor: 'var(--app-accent)' }} />
          </div>
        ) : calls.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64">
            <p className="text-sm" style={{ color: 'var(--app-text-muted)' }}>{t('noCalls')}</p>
          </div>
        ) : (
          calls.map((call) => {
            const name = call.peer?.display_name ?? 'Unknown';
            const initials = getInitials(name);
            return (
              <div key={call.id}
                   className="flex items-center gap-3 p-4 mx-3 my-1 rounded-2xl transition-all hover:scale-[1.01] glass-panel glass-shimmer">
                {call.peer?.avatar_url ? (
                  <img src={call.peer.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-full flex items-center justify-center font-semibold"
                       style={{ background: 'var(--app-accent-gradient)', color: '#fff' }}>
                    {initials}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate" style={{ color: 'var(--app-text)' }}>{name}</p>
                  <div className="flex items-center gap-1.5">
                    {call.status === 'missed' || call.status === 'declined' ? (
                      <PhoneOffIcon size={14} style={{ color: statusColor(call.status) }} />
                    ) : call.isOutgoing ? (
                      <PhoneOutgoingIcon size={14} style={{ color: statusColor(call.status) }} />
                    ) : (
                      <PhoneIncomingIcon size={14} style={{ color: statusColor(call.status) }} />
                    )}
                    <span className="text-sm" style={{ color: statusColor(call.status) }}>
                      {statusLabel(call)}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {call.call_type === 'video' && <VideoIcon size={16} style={{ color: 'var(--app-text-muted)' }} />}
                  <span className="text-xs" style={{ color: 'var(--app-text-muted)' }}>
                    {formatTime(call.created_at)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
