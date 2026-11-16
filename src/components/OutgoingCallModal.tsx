import { useState, useEffect, useCallback, useRef } from 'react';
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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // WebRTC Refs
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!user || !chatId) return;

    const initiateCall = async () => {
      try {
        // 1. Запрашиваем микрофон
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStream.current = stream;

        // 2. Создаем WebRTC соединение
        const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        peerConnection.current = pc;

        // 3. Добавляем наши треки
        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        // 4. Когда ответят - включаем звук
        pc.ontrack = (event) => {
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = event.streams[0];
          }
        };

        // 5. Создаем Offer (предложение)
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // 6. Отправляем в базу
        const { data, error } = await supabase
          .from('calls')
          .insert({
            chat_id: chatId,
            caller_id: user.id,
            receiver_id: peer.id,
            status: 'pending',
            call_type: callType,
            offer: offer // передаем WebRTC данные
          })
          .select('*')
          .single();

        if (error) {
          console.error("Ошибка создания звонка:", error);
          setErrorMsg("Ошибка базы данных: " + error.message);
          return;
        }

        if (data) setCallRecord(data as Call);
      } catch (err) {
        console.error("Микрофон недоступен:", err);
        setErrorMsg("Нет доступа к микрофону.");
      }
    };
    
    initiateCall();

    // Очистка при закрытии
    return () => {
      if (peerConnection.current) peerConnection.current.close();
      if (localStream.current) localStream.current.getTracks().forEach(t => t.stop());
    };
  }, [user, chatId, peer.id, callType]);

  useEffect(() => {
    if (!callRecord) return;

    const channel = supabase
      .channel(`outgoing_call:${callRecord.id}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'calls', filter: `id=eq.${callRecord.id}` },
        async (payload) => {
          const updated = payload.new as Call & { answer: any };
          
          if (updated.status === 'accepted' && updated.answer) {
            // Получили ответ от собеседника, завершаем соединение
            if (peerConnection.current) {
              await peerConnection.current.setRemoteDescription(new RTCSessionDescription(updated.answer));
            }
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
    if (peerConnection.current) peerConnection.current.close();
    if (localStream.current) localStream.current.getTracks().forEach(t => t.stop());
    
    setCallState('ended');
    setTimeout(() => onCancel(), 1000);
  }, [callRecord, callState, onCancel]);

  const toggleMute = () => {
    if (localStream.current) {
      const audioTrack = localStream.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMuted(!audioTrack.enabled);
      }
    }
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const initials = (peer.display_name || peer.username || '?')
    .split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  const statusText = () => {
    switch (callState) {
      case 'calling': return "Вызов...";
      case 'connected': return formatDuration(callDuration);
      case 'declined': return "Отклонен";
      case 'ended': return "Завершен";
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex flex-col items-center justify-between p-8"
        style={{ background: 'var(--app-bg)' }}
      >
        {/* Скрытый аудиоплеер */}
        <audio ref={remoteAudioRef} autoPlay />

        <div className="flex flex-col items-center mt-16 relative z-10 w-full">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full mb-6 bg-green-500/10 border border-green-500/20">
            <LockShieldIcon size={14} style={{ color: '#22c55e' }} />
            <span className="text-xs font-medium" style={{ color: '#22c55e' }}>Зашифровано</span>
          </div>

          <p className="text-sm font-medium mb-6" style={{ color: 'var(--app-text-muted)' }}>
            {statusText()}
          </p>

          <div className="relative">
            {peer.avatar_url ? (
              <img src={peer.avatar_url} alt="" className="relative w-36 h-36 rounded-full object-cover border-4" style={{ borderColor: 'var(--app-accent)' }} />
            ) : (
              <div className="relative w-36 h-36 rounded-full flex items-center justify-center font-bold text-5xl border-4" style={{ background: 'var(--app-accent-gradient)', color: '#fff', borderColor: 'var(--app-accent)' }}>
                {initials}
              </div>
            )}
          </div>

          <h2 className="text-2xl font-bold mt-6" style={{ color: 'var(--app-text)' }}>{peer.display_name}</h2>
          <p className="text-sm mt-1 font-medium" style={{ color: 'var(--app-text-muted)' }}>@{peer.username || '...'}</p>
          
          {errorMsg && <p className="text-xs text-red-500 mt-4">{errorMsg}</p>}
        </div>

        <div className="mb-16 relative z-10">
          {callState === 'connected' ? (
            <div className="flex items-center gap-6">
              <button onClick={toggleMute} className="flex flex-col items-center gap-2 transition-transform active:scale-90">
                <div className="w-16 h-16 rounded-full flex items-center justify-center transition-all" style={{ background: muted ? 'var(--app-danger)' : 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                  {muted ? <MicOffIcon size={26} style={{ color: '#fff' }} /> : <MicIcon size={26} style={{ color: 'var(--app-text)' }} />}
                </div>
              </button>

              <button onClick={endCall} className="flex flex-col items-center gap-2 transition-transform active:scale-90">
                <div className="rounded-full flex items-center justify-center text-white" style={{ background: 'var(--app-danger)', width: '72px', height: '72px' }}>
                  <PhoneOffIcon size={32} />
                </div>
              </button>
            </div>
          ) : (
            <button onClick={endCall} className="flex flex-col items-center gap-2 transition-transform active:scale-90">
              <div className="rounded-full flex items-center justify-center text-white" style={{ background: 'var(--app-danger)', width: '72px', height: '72px' }}>
                <PhoneOffIcon size={32} />
              </div>
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
