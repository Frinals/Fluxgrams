import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, Call, Profile } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { PhoneIcon, VideoIcon, PhoneOffIcon, MicIcon, MicOffIcon, LockShieldIcon } from '@/components/Icons';

interface Props {
  peer: Profile;
  callType: 'audio' | 'video';
  chatId: string | null;
  onCancel: () => void;
}

export default function OutgoingCallModal({ peer, callType, chatId, onCancel }: Props) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [callState, setCallState] = useState<'calling' | 'connected' | 'declined' | 'ended'>('calling');
  const [callDuration, setCallDuration] = useState(0);
  const [callRecord, setCallRecord] = useState<Call | null>(null);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    if (!user || !chatId) return;

    const initiate = async () => {
      const { data } = await supabase
        .from('calls')
        .insert({
          chat_id: chatId,
          caller_id: user.id,
          receiver_id: peer.id,
          status: 'pending',
          call_type: callType,
        })
        .select('*')
        .single();

      if (data) {
        setCallRecord(data as Call);
      }
    };
    initiate();
  }, [user, chatId, peer.id, callType]);

  useEffect(() => {
    if (!callRecord) return;

    const channel = supabase
      .channel(`outgoing_call:${callRecord.id}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'calls', filter: `id=eq.${callRecord.id}` },
        (payload) => {
          const updated = payload.new as Call;
          if (updated.status === 'accepted') {
            setCallState('connected');
            setCallDuration(0);
          } else if (updated.status === 'declined') {
            setCallState('declined');
            setTimeout(() => onCancel(), 1500);
          } else if (updated.status === 'ended') {
            setCallState('ended');
            setTimeout(() => onCancel(), 1500);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [callRecord, onCancel]);

  useEffect(() => {
    if (callState !== 'connected') return;
    const interval = setInterval(() => setCallDuration((d) => d + 1), 1000);
    return () => clearInterval(interval);
  }, [callState]);

  const endCall = useCallback(async () => {
    if (callRecord) {
      const status = callState === 'connected' ? 'ended' : 'missed';
      await supabase.from('calls')
        .update({ status, ended_at: new Date().toISOString() })
        .eq('id', callRecord.id);
    }
    setCallState('ended');
    setTimeout(() => onCancel(), 1000);
  }, [callRecord, callState, onCancel]);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const initials = (peer.display_name || peer.username || '?')
    .split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  const statusText = () => {
    switch (callState) {
      case 'calling': return t('ringDuration');
      case 'connected': return formatDuration(callDuration);
      case 'declined': return t('callDeclined');
      case 'ended': return t('callEnded');
    }
  };

  return (
    <AnimatePresence>
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
            {statusText()}
          </p>

          {/* Avatar with pulse ring */}
          <div className="relative">
            {callState === 'calling' && (
              <>
                <motion.div
                  animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="absolute -inset-4 rounded-full"
                  style={{ background: 'var(--app-accent)' }}
                />
                <motion.div
                  animate={{ scale: [1, 1.5, 1], opacity: [0.2, 0, 0.2] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
                  className="absolute -inset-4 rounded-full"
                  style={{ background: 'var(--app-accent)' }}
                />
              </>
            )}
            {callState === 'connected' && (
              <motion.div
                animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.1, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute -inset-4 rounded-full"
                style={{ background: 'var(--app-accent)', opacity: 0.2 }}
              />
            )}
            {peer.avatar_url ? (
              <img src={peer.avatar_url} alt=""
                   className="relative w-36 h-36 rounded-full object-cover border-4"
                   style={{ borderColor: 'var(--app-accent)' }} />
            ) : (
              <div className="relative w-36 h-36 rounded-full flex items-center justify-center font-bold text-5xl border-4"
                   style={{ background: 'var(--app-accent-gradient)', color: '#fff', borderColor: 'var(--app-accent)' }}>
                {initials}
              </div>
            )}
          </div>

          <h2 className="text-2xl font-bold mt-6 text-white">{peer.display_name}</h2>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
            @{peer.username || '...'}
          </p>

          <div className="flex items-center gap-2 mt-3">
            {callType === 'video' ? <VideoIcon size={16} style={{ color: 'rgba(255,255,255,0.4)' }} /> : <PhoneIcon size={16} style={{ color: 'rgba(255,255,255,0.4)' }} />}
            <span className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {callType === 'video' ? t('videoCall') : t('call')}
            </span>
          </div>
        </div>

        {/* Bottom: call controls */}
        <div className="mb-16 relative z-10">
          {callState === 'connected' ? (
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
                <div className="rounded-full flex items-center justify-center"
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
          ) : (
            <motion.button
              whileTap={{ scale: 0.9 }}
              whileHover={{ scale: 1.05 }}
              onClick={endCall}
              className="flex flex-col items-center gap-2 transition-all"
            >
              <div className="w-18 h-18 rounded-full flex items-center justify-center"
                   style={{
                     background: callState === 'declined' ? 'rgba(255,255,255,0.1)' : 'var(--app-danger)',
                     width: '4.5rem',
                     height: '4.5rem',
                     boxShadow: '0 0 30px rgba(239,68,68,0.4)',
                   }}>
                <PhoneOffIcon size={30} className="text-white" />
              </div>
              <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {t('cancel')}
              </span>
            </motion.button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
