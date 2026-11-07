import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, Call, Profile } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { PhoneIcon, VideoIcon, PhoneOffIcon, MicIcon, MicOffIcon, LockShieldIcon } from '@/components/Icons';

interface IncomingCallData {
  call: Call;
  caller: Profile;
}

const springTransition = { type: 'spring' as const, stiffness: 300, damping: 30 };

export default function IncomingCallModal() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [incoming, setIncoming] = useState<IncomingCallData | null>(null);
  const [callState, setCallState] = useState<'ringing' | 'connected' | 'ended'>('ringing');
  const [callDuration, setCallDuration] = useState(0);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [muted, setMuted] = useState(false);
  const [showBanner, setShowBanner] = useState(true);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('incoming_calls')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'calls', filter: `receiver_id=eq.${user.id}` },
        async (payload) => {
          const newCall = payload.new as Call;
          if (newCall.status !== 'pending') return;

          const { data: callerProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', newCall.caller_id)
            .maybeSingle();

          if (callerProfile) {
            setIncoming({ call: newCall, caller: callerProfile as Profile });
            setCallState('ringing');
            setShowBanner(true);
          }
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'calls' },
        (payload) => {
          const updated = payload.new as Call;
          if (activeCall?.id === updated.id) {
            if (updated.status === 'declined' || updated.status === 'ended') {
              setCallState('ended');
              setTimeout(() => {
                setActiveCall(null);
                setIncoming(null);
                setShowBanner(true);
              }, 1500);
            }
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, activeCall]);

  useEffect(() => {
    if (callState !== 'connected') return;
    const interval = setInterval(() => setCallDuration((d) => d + 1), 1000);
    return () => clearInterval(interval);
  }, [callState]);

  const acceptCall = useCallback(async () => {
    if (!incoming) return;
    await supabase.from('calls').update({ status: 'accepted' }).eq('id', incoming.call.id);
    setActiveCall(incoming.call);
    setCallState('connected');
    setCallDuration(0);
    setShowBanner(false);
  }, [incoming]);

  const declineCall = useCallback(async () => {
    if (!incoming) return;
    await supabase.from('calls').update({ status: 'declined', ended_at: new Date().toISOString() }).eq('id', incoming.call.id);
    setCallState('ended');
    setTimeout(() => {
      setIncoming(null);
      setActiveCall(null);
      setShowBanner(true);
    }, 1500);
  }, [incoming]);

  const endCall = useCallback(async () => {
    if (!activeCall) return;
    await supabase.from('calls').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', activeCall.id);
    setCallState('ended');
    setTimeout(() => {
      setIncoming(null);
      setActiveCall(null);
      setShowBanner(true);
    }, 1500);
  }, [activeCall]);

  if (!incoming) return null;

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const initials = (incoming.caller.display_name || incoming.caller.username || '?')
    .split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  const isVideo = incoming.call.call_type === 'video';

  return (
    <>
      <AnimatePresence>
        {/* ─── Incoming Call Banner (drops from top while ringing) ─── */}
        {callState === 'ringing' && showBanner && (
          <motion.div
            initial={{ y: '-100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '-100%', opacity: 0 }}
            transition={springTransition}
            className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 pt-4"
          >
            <div
              className="w-full max-w-2xl rounded-3xl border shadow-2xl overflow-hidden"
              style={{
                background: 'var(--app-nav-bg)',
                backdropFilter: 'blur(32px) saturate(180%)',
                WebkitBackdropFilter: 'blur(32px) saturate(180%)',
                borderColor: 'var(--app-border-glass)',
                boxShadow: '0 12px 40px rgba(0,0,0,0.3), 0 0 30px var(--app-glow)',
              }}
            >
              <div className="flex items-center gap-4 p-4">
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="absolute inset-0 rounded-2xl animate-ping"
                       style={{ background: 'var(--app-accent)', opacity: 0.2 }} />
                  {incoming.caller.avatar_url ? (
                    <img src={incoming.caller.avatar_url} alt=""
                         className="relative w-14 h-14 rounded-2xl object-cover" />
                  ) : (
                    <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-lg"
                         style={{ background: 'var(--app-accent-gradient)', color: '#fff' }}>
                      {initials}
                    </div>
                  )}
                </div>

                {/* Caller info */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium" style={{ color: 'var(--app-accent)' }}>
                    {isVideo ? t('videoCall') : t('incomingCall')}
                  </p>
                  <p className="font-bold truncate" style={{ color: 'var(--app-text)' }}>
                    {incoming.caller.display_name}
                  </p>
                  <p className="text-xs flex items-center gap-1" style={{ color: 'var(--app-text-muted)' }}>
                    <LockShieldIcon size={12} /> {t('endToEndEncryptedCall')}
                  </p>
                </div>

                {/* Accept / Decline buttons */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    whileHover={{ scale: 1.05 }}
                    onClick={declineCall}
                    className="w-12 h-12 rounded-full flex items-center justify-center transition-all"
                    style={{ background: 'var(--app-danger)' }}
                  >
                    <PhoneOffIcon size={22} className="text-white" />
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    whileHover={{ scale: 1.05 }}
                    onClick={acceptCall}
                    className="w-12 h-12 rounded-full flex items-center justify-center transition-all animate-pulse"
                    style={{ background: 'var(--app-success)' }}
                  >
                    {isVideo ? <VideoIcon size={22} className="text-white" /> : <PhoneIcon size={22} className="text-white" />}
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── Full-screen Call UI (when connected or ended) ─── */}
        {(callState === 'connected' || callState === 'ended') && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-between p-8"
            style={{
              background: 'rgba(0,0,0,0.9)',
              backdropFilter: 'blur(40px)',
              WebkitBackdropFilter: 'blur(40px)',
            }}
          >
            {/* Animated background orbs */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="absolute w-[400px] h-[400px] rounded-full opacity-20 blur-[120px] animate-pulse"
                   style={{ background: 'var(--app-accent)', top: '-10%', left: '10%' }} />
              <div className="absolute w-[300px] h-[300px] rounded-full opacity-15 blur-[100px] animate-pulse"
                   style={{ background: 'var(--app-glow)', bottom: '10%', right: '5%', animationDelay: '2s' }} />
            </div>

            {/* Top: caller info + E2EE badge */}
            <div className="flex flex-col items-center mt-16 relative z-10">
              {/* E2EE badge */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full mb-6"
                   style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)' }}>
                <LockShieldIcon size={14} style={{ color: '#22c55e' }} />
                <span className="text-xs font-medium" style={{ color: '#22c55e' }}>
                  {t('endToEndEncryptedCall')}
                </span>
              </div>

              <p className="text-sm mb-3" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {callState === 'connected' ? formatDuration(callDuration) : t('callEnded')}
              </p>

              {/* Avatar with pulse ring */}
              <div className="relative">
                {callState === 'connected' && (
                  <motion.div
                    animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.1, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute -inset-4 rounded-full"
                    style={{ background: 'var(--app-accent)', opacity: 0.2 }}
                  />
                )}
                {incoming.caller.avatar_url ? (
                  <img src={incoming.caller.avatar_url} alt=""
                       className="relative w-36 h-36 rounded-full object-cover border-4"
                       style={{ borderColor: 'var(--app-accent)' }} />
                ) : (
                  <div className="relative w-36 h-36 rounded-full flex items-center justify-center font-bold text-5xl border-4"
                       style={{ background: 'var(--app-accent-gradient)', color: '#fff', borderColor: 'var(--app-accent)' }}>
                    {initials}
                  </div>
                )}
              </div>

              <h2 className="text-2xl font-bold mt-6 text-white">
                {incoming.caller.display_name}
              </h2>
              <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                @{incoming.caller.username || '...'}
              </p>

              <div className="flex items-center gap-2 mt-3">
                {isVideo ? <VideoIcon size={16} style={{ color: 'rgba(255,255,255,0.4)' }} /> : <PhoneIcon size={16} style={{ color: 'rgba(255,255,255,0.4)' }} />}
                <span className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {isVideo ? t('videoCall') : t('call')}
                </span>
              </div>
            </div>

            {/* Bottom: call controls */}
            <div className="mb-16 relative z-10">
              {callState === 'connected' && (
                <div className="flex items-center gap-6">
                  {/* Mute button */}
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    whileHover={{ scale: 1.05 }}
                    onClick={() => setMuted(!muted)}
                    className="flex flex-col items-center gap-2 transition-all"
                  >
                    <div
                      className="w-16 h-16 rounded-full flex items-center justify-center transition-all"
                      style={{
                        background: muted ? 'rgba(239,68,68,0.9)' : 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        boxShadow: muted ? '0 0 20px rgba(239,68,68,0.4)' : 'none',
                      }}
                    >
                      {muted ? <MicOffIcon size={26} className="text-white" /> : <MicIcon size={26} className="text-white" />}
                    </div>
                    <span className="text-xs font-medium" style={{ color: muted ? '#ef4444' : 'rgba(255,255,255,0.5)' }}>
                      {muted ? t('mutedMic') : t('muteMicrophone')}
                    </span>
                  </motion.button>

                  {/* End call button */}
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    whileHover={{ scale: 1.05 }}
                    onClick={endCall}
                    className="flex flex-col items-center gap-2 transition-all"
                  >
                    <div className="w-18 h-18 rounded-full flex items-center justify-center"
                         style={{
                           background: 'var(--app-danger)',
                           width: '4.5rem',
                           height: '4.5rem',
                           boxShadow: '0 0 30px rgba(239,68,68,0.4)',
                         }}>
                      <PhoneOffIcon size={30} className="text-white" />
                    </div>
                    <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      {t('endCall')}
                    </span>
                  </motion.button>
                </div>
              )}

              {callState === 'ended' && (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center"
                       style={{ background: 'rgba(255,255,255,0.1)' }}>
                    <PhoneOffIcon size={28} className="text-white/60" />
                  </div>
                  <span className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>{t('callEnded')}</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
