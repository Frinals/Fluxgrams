import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, Call, Profile } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { PhoneIcon, PhoneOffIcon, MicIcon, MicOffIcon } from '@/components/Icons';

export default function IncomingCallModal() {
  const { user } = useAuth();
  const [incoming, setIncoming] = useState<any | null>(null);
  const [callState, setCallState] = useState<'ringing' | 'connected'>('ringing');
  const [activeCall, setActiveCall] = useState<any | null>(null);
  const [muted, setMuted] = useState(false);
  
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel('incoming_calls')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'calls', filter: `receiver_id=eq.${user.id}` }, async (payload) => {
        const newCall = payload.new;
        if (newCall.status !== 'pending') return;
        const { data: callerProfile } = await supabase.from('profiles').select('*').eq('id', newCall.caller_id).single();
        setIncoming({ call: newCall, caller: callerProfile });
        setCallState('ringing');
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'calls' }, (payload) => {
        if (activeCall?.id === payload.new.id && (payload.new.status === 'declined' || payload.new.status === 'ended')) {
          cleanup();
        }
      }).subscribe();

    return () => { supabase.removeChannel(channel); cleanup(); };
  }, [user, activeCall]);

  const cleanup = () => {
    if (peerConnection.current) peerConnection.current.close();
    if (localStream.current) localStream.current.getTracks().forEach(t => t.stop());
    setIncoming(null); setActiveCall(null); setMuted(false);
  };

  const acceptCall = async () => {
    if (!incoming) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStream.current = stream;
      
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      peerConnection.current = pc;

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.ontrack = (event) => { if (remoteAudioRef.current) remoteAudioRef.current.srcObject = event.streams[0]; };
      
      // ВАЖНО: Сбор ICE-кандидатов
      pc.onicecandidate = (event) => {
        if (event.candidate) supabase.from('calls').update({ ice_candidate: event.candidate }).eq('id', incoming.call.id).then();
      };

      await pc.setRemoteDescription(new RTCSessionDescription(incoming.call.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await supabase.from('calls').update({ status: 'accepted', answer }).eq('id', incoming.call.id);
      
      setActiveCall(incoming.call);
      setCallState('connected');
    } catch (err) { alert('Нет доступа к микрофону'); }
  };

  const declineCall = async () => {
    if (incoming) await supabase.from('calls').update({ status: 'declined' }).eq('id', incoming.call.id);
    cleanup();
  };

  const endCall = async () => {
    if (activeCall) await supabase.from('calls').update({ status: 'ended' }).eq('id', activeCall.id);
    cleanup();
  };

  if (!incoming) return null;
  const isVideo = incoming.call.call_type === 'video';

  return (
    <>
      <audio ref={remoteAudioRef} autoPlay />
      <AnimatePresence>
        {callState === 'ringing' && (
          <motion.div initial={{ y: '-100%' }} animate={{ y: 0 }} exit={{ y: '-100%' }} className="fixed top-0 left-0 right-0 z-[999] p-4 flex justify-center">
            <div className="bg-[#1a1a1a] border border-white/10 p-4 rounded-3xl w-full max-w-md flex items-center gap-4 shadow-2xl">
              <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-xl">
                {(incoming.caller?.username || 'U')[0].toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="text-white font-bold">{incoming.caller?.display_name || 'Звонок'}</p>
                <p className="text-xs text-green-500">{isVideo ? 'Видеозвонок' : 'Входящий звонок'}</p>
              </div>
              <button onClick={declineCall} className="w-12 h-12 rounded-full bg-red-500 text-white flex items-center justify-center"><PhoneOffIcon size={20} /></button>
              <button onClick={acceptCall} className="w-12 h-12 rounded-full bg-green-500 text-white flex items-center justify-center animate-pulse"><PhoneIcon size={20} /></button>
            </div>
          </motion.div>
        )}
        {callState === 'connected' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[999] bg-[#0f1115] flex flex-col items-center justify-center">
            <h2 className="text-2xl font-bold text-white mb-10">{incoming.caller?.display_name}</h2>
            <div className="flex gap-6">
              <button onClick={() => { 
                const track = localStream.current?.getAudioTracks()[0]; 
                if (track) { track.enabled = !track.enabled; setMuted(!track.enabled); } 
              }} className={`w-16 h-16 rounded-full flex items-center justify-center ${muted ? 'bg-red-500' : 'bg-white/10'}`}>
                {muted ? <MicOffIcon size={24} className="text-white" /> : <MicIcon size={24} className="text-white" />}
              </button>
              <button onClick={endCall} className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center"><PhoneOffIcon size={28} className="text-white" /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
