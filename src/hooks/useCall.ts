import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export function useCall() {
  const { user } = useAuth();
  const [callState, setCallState] = useState<'idle' | 'calling' | 'incoming' | 'active'>('idle');
  const [remotePeer, setRemotePeer] = useState<any>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<any>(null);
  const remoteOfferRef = useRef<any>(null);
  const callStateRef = useRef(callState);
  const iceCandidatesQueue = useRef<any[]>([]);

  useEffect(() => { callStateRef.current = callState; }, [callState]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel(`calls:${user.id}`);
    
    channel.on('broadcast', { event: 'incoming_call' }, async (payload) => {
      if (callStateRef.current !== 'idle') return; // Игнорируем, если заняты
      remoteOfferRef.current = payload.payload.sdp;
      const { data } = await supabase.from('profiles').select('*').eq('id', payload.payload.from).single();
      setRemotePeer(data || { id: payload.payload.from, display_name: 'Пользователь' });
      setCallState('incoming');
    });

    channel.on('broadcast', { event: 'call_accepted' }, async (payload) => {
      setCallState('active');
      if (pcRef.current) {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.payload.sdp));
        // Применяем накопленные ICE-кандидаты
        iceCandidatesQueue.current.forEach(c => pcRef.current?.addIceCandidate(c));
        iceCandidatesQueue.current = [];
      }
    });

    channel.on('broadcast', { event: 'ice_candidate' }, async (payload) => {
      const candidate = new RTCIceCandidate(payload.payload.candidate);
      if (pcRef.current && pcRef.current.remoteDescription) {
        await pcRef.current.addIceCandidate(candidate);
      } else {
        iceCandidatesQueue.current.push(candidate);
      }
    });

    channel.subscribe();
    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const startCall = useCallback(async (peer: any) => {
    if (!user) return;
    setCallState('calling');
    setRemotePeer(peer);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    setLocalStream(stream);
    
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    pcRef.current = pc;
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
    
    pc.onicecandidate = (event) => {
      if (event.candidate) channelRef.current?.send({ type: 'broadcast', event: 'ice_candidate', payload: { candidate: event.candidate, to: peer.id } });
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    const peerChannel = supabase.channel(`calls:${peer.id}`);
    peerChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') peerChannel.send({ type: 'broadcast', event: 'incoming_call', payload: { from: user.id, sdp: offer } });
    });
  }, [user]);

  const acceptCall = useCallback(async () => {
    if (!remotePeer || !user || !remoteOfferRef.current) return;
    setCallState('active');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    setLocalStream(stream);
    
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    pcRef.current = pc;
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
    
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const callerChannel = supabase.channel(`calls:${remotePeer.id}`);
        callerChannel.subscribe(s => s === 'SUBSCRIBED' && callerChannel.send({ type: 'broadcast', event: 'ice_candidate', payload: { candidate: event.candidate } }));
      }
    };

    await pc.setRemoteDescription(new RTCSessionDescription(remoteOfferRef.current));
    iceCandidatesQueue.current.forEach(c => pc.addIceCandidate(c));
    iceCandidatesQueue.current = [];

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    
    const callerChannel = supabase.channel(`calls:${remotePeer.id}`);
    callerChannel.subscribe(s => s === 'SUBSCRIBED' && callerChannel.send({ type: 'broadcast', event: 'call_accepted', payload: { sdp: answer } }));
  }, [remotePeer, user]);

  const toggleMute = useCallback(() => {
    localStream?.getAudioTracks().forEach(track => { track.enabled = !track.enabled; });
    setIsMuted(!isMuted);
  }, [localStream, isMuted]);

  const endCall = useCallback(() => {
    pcRef.current?.close();
    localStream?.getTracks().forEach(t => t.stop());
    setCallState('idle'); setLocalStream(null); setRemotePeer(null); setIsMuted(false);
  }, [localStream]);

  return { callState, remotePeer, isMuted, startCall, acceptCall, endCall, toggleMute };
}
