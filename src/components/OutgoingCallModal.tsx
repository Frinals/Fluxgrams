import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { supabase, Profile } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { PhoneOffIcon, MicIcon, MicOffIcon } from '@/components/Icons';

export default function OutgoingCallModal({ peer, callType, chatId, onCancel }: any) {
  const { user } = useAuth();
  const [callState, setCallState] = useState<'calling' | 'connected' | 'ended'>('calling');
  const [callRecord, setCallRecord] = useState<any | null>(null);
  const [muted, setMuted] = useState(false);
  
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const initiate = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStream.current = stream;
        
        const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        peerConnection.current = pc;
        stream.getTracks().forEach(track => pc.addTrack(track, stream));
        
        pc.ontrack = (event) => { if (remoteAudioRef.current) remoteAudioRef.current.srcObject = event.streams[0]; };
        
        // Сбор ICE-кандидатов
        pc.onicecandidate = (event) => {
          if (event.candidate) supabase.from('calls').update({ ice_candidate: event.candidate }).eq('id', callRecord?.id).then();
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const { data } = await supabase.from('calls').insert({
          chat_id: chatId, caller_id: user?.id, receiver_id: peer.id,
          status: 'pending', call_type: callType, offer
        }).select('*').single();
        
        if (data) setCallRecord(data);
      } catch (err) { alert('Нет доступа к микрофону'); onCancel(); }
    };
    initiate();
    return () => { if (peerConnection.current) peerConnection.current.close(); if (localStream.current) localStream.current.getTracks().forEach(t => t.stop()); };
  }, []);

  useEffect(() => {
    if (!callRecord) return;
    const channel = supabase.channel(`outgoing_${callRecord.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'calls', filter: `id=eq.${callRecord.id}` }, async (payload) => {
        if (payload.new.status === 'accepted' && payload.new.answer) {
          await peerConnection.current?.setRemoteDescription(new RTCSessionDescription(payload.new.answer));
          setCallState('connected');
        } else if (payload.new.status === 'declined' || payload.new.status === 'ended') {
          setCallState('ended'); setTimeout(onCancel, 1500);
        }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [callRecord]);

  const endCall = async () => {
    if (callRecord) await supabase.from('calls').update({ status: 'ended' }).eq('id', callRecord.id);
    onCancel();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[999] bg-[#0f1115] flex flex-col items-center justify-center">
      <audio ref={remoteAudioRef} autoPlay />
      <h2 className="text-2xl font-bold text-white mb-2">{peer.display_name}</h2>
      <p className="text-gray-400 mb-10">{callState === 'calling' ? 'Вызов...' : callState === 'connected' ? 'Соединено' : 'Завершено'}</p>
      
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
  );
}
