import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, Call, Profile } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { PhoneIcon, VideoIcon, PhoneOffIcon, MicIcon, MicOffIcon } from '@/components/Icons';

interface IncomingCallData {
  call: Call & { offer: any };
  caller: Profile;
}

const springTransition = { type: 'spring' as const, stiffness: 300, damping: 30 };

export default function IncomingCallModal() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [incoming, setIncoming] = useState<IncomingCallData | null>(null);
  const [callState, setCallState] = useState<'ringing' | 'connected' | 'ended'>('ringing');
  const [callDuration, setCallDuration] = useState(0);
  const [activeCall, setActiveCall] = useState<any>(null);
  const [muted, setMuted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // WebRTC Refs
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

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
            setIncoming({ call: newCall as any, caller: callerProfile as Profile });
            setCallState('ringing');
            setErrorMsg(null);
          }
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'calls' },
        (payload) => {
          const updated = payload.new as Call;
          if (activeCall?.id === updated.id) {
            if (updated.status === 'declined' || updated.status === 'ended') {
              cleanupCall();
            }
          }
        }
      )
      .subscribe();

    return () => { 
      supabase.removeChannel(channel); 
      cleanupCall();
    };
  }, [user, activeCall]);

  useEffect(() => {
    if (callState !== 'connected') return;
    const interval = setInterval(() => setCallDuration((d) => d + 1), 1000);
    return () => clearInterval(interval);
  }, [callState]);

  const cleanupCall = () => {
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    if (localStream.current) {
      localStream.current.getTracks().forEach(track => track.stop());
      localStream.current = null;
    }
    setCallState('ended');
    setTimeout(() => {
      setIncoming(null);
      setActiveCall(null);
      setMuted(false);
      setCallDuration(0);
    }, 1500);
  };

  const acceptCall = useCallback(async () => {
    if (!incoming) return;
    setErrorMsg(null);
    
    try {
      // 1. Получаем доступ к микрофону
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStream.current = stream;

      // 2. Создаем WebRTC соединение (используем бесплатный сервер Google для связи)
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      peerConnection.current = pc;

      // 3. Добавляем наши аудиодорожки
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      // 4. Когда придет звук от собеседника - включаем его
      pc.ontrack = (event) => {
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = event.streams[0];
        }
      };

      // 5. Обрабатываем предложение (offer) от звонящего
      if (incoming.call.offer) {
        await pc.setRemoteDescription(new RTCSessionDescription(incoming.call.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        // 6. Отправляем ответ (answer) обратно в базу, чтобы звонящий нас услышал
        await supabase.from('calls').update({ 
          status: 'accepted', 
          answer: answer 
        }).eq('id', incoming.call.id);
      }

      setActiveCall(incoming.call);
      setCallState('connected');
      setCallDuration(0);
    } catch (err) {
      console.error("Ошибка при принятии звонка:", err);
      setErrorMsg("Нет доступа к микрофону. Разрешите его в настройках браузера.");
    }
  }, [incoming]);

  const declineCall = useCallback(async () => {
    if (!incoming) return;
    await supabase.from('calls').update({ status: 'declined', ended_at: new Date().toISOString() }).eq('id', incoming.call.id);
    cleanupCall();
  }, [incoming]);

  const endCall = useCallback(async () => {
    if (!activeCall) return;
    await supabase.from('calls').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', activeCall.id);
    cleanupCall();
  }, [activeCall]);

  const toggleMute = () => {
    if (localStream.current) {
      const audioTrack = localStream.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMuted(!audioTrack.enabled);
      }
    }
  };

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
      {/* Скрытый аудиоплеер для WebRTC */}
      <audio ref={remoteAudioRef} autoPlay />

      <AnimatePresence>
        {/* ─── Входящий звонок (Баннер сверху) ─── */}
        {callState === 'ringing' && (
          <motion.div
            initial={{ y: '-100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '-100%', opacity: 0 }}
            transition={springTransition}
            className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 pt-4"
          >
            <div className="w-full max-w-2xl rounded-3xl border shadow-xl overflow-hidden glass-nav" style={{ borderColor: 'var(--app-border-glass)' }}>
              <div className="flex items-center gap-4 p-4">
                <div className="relative flex-shrink-0">
                  {incoming.caller.avatar_url ? (
                    <img src={incoming.caller.avatar_url} alt="" className="w-14 h-14 rounded-2xl object-cover" />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-lg" style={{ background: 'var(--app-accent-gradient)', color: '#fff' }}>{initials}</div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium" style={{ color: 'var(--app-accent)' }}>
                    {isVideo ? 'Видеозвонок' : 'Входящий звонок'}
                  </p>
                  <p className="font-bold truncate" style={{ color: 'var(--app-text)' }}>
                    {incoming.caller.display_name}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={declineCall} className="w-12 h-12 rounded-full flex items-center justify-center text-white transition-transform active:scale-90" style={{ background: 'var(--app-danger)' }}>
                    <PhoneOffIcon size={22} />
                  </button>
                  <button onClick={acceptCall} className="w-12 h-12 rounded-full flex items-center justify-center text-white transition-transform active:scale-90 animate-pulse" style={{ background: 'var(--app-success)' }}>
                    {isVideo ? <VideoIcon size={22} /> : <PhoneIcon size={22} />}
                  </button>
                </div>
              </div>
              {errorMsg && <p className="text-xs text-center text-red-500 pb-2">{errorMsg}</p>}
            </div>
          </motion.div>
        )}

        {/* ─── Экран разговора ─── */}
        {(callState === 'connected' || callState === 'ended') && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-between p-8"
            style={{ background: 'var(--app-bg)' }}
          >
            <div className="flex flex-col items-center mt-16 relative z-10 w-full">
              <p className="text-sm mb-6 font-medium" style={{ color: 'var(--app-text-muted)' }}>
                {callState === 'connected' ? formatDuration(callDuration) : 'Вызов завершен'}
              </p>

              <div className="relative">
                {incoming.caller.avatar_url ? (
                  <img src={incoming.caller.avatar_url} alt="" className="relative w-36 h-36 rounded-full object-cover border-4" style={{ borderColor: 'var(--app-accent)' }} />
                ) : (
                  <div className="relative w-36 h-36 rounded-full flex items-center justify-center font-bold text-5xl border-4" style={{ background: 'var(--app-accent-gradient)', color: '#fff', borderColor: 'var(--app-accent)' }}>{initials}</div>
                )}
              </div>

              <h2 className="text-2xl font-bold mt-6" style={{ color: 'var(--app-text)' }}>{incoming.caller.display_name}</h2>
              <p className="text-sm mt-1 font-medium" style={{ color: 'var(--app-text-muted)' }}>@{incoming.caller.username || '...'}</p>
            </div>

            <div className="mb-16 relative z-10">
              {callState === 'connected' && (
                <div className="flex items-center gap-6">
                  <button onClick={toggleMute} className="flex flex-col items-center gap-2 transition-transform active:scale-90">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center transition-all" style={{ background: muted ? 'var(--app-danger)' : 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                      {muted ? <MicOffIcon size={26} style={{ color: '#fff' }} /> : <MicIcon size={26} style={{ color: 'var(--app-text)' }} />}
                    </div>
                  </button>

                  <button onClick={endCall} className="flex flex-col items-center gap-2 transition-transform active:scale-90">
                    <div className="w-[72px] h-[72px] rounded-full flex items-center justify-center text-white" style={{ background: 'var(--app-danger)' }}>
                      <PhoneOffIcon size={32} />
                    </div>
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
