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

  useEffect(() => { callStateRef.current = callState; }, [callState]);

  // 1. Слушаем входящие звонки на СВОЕЙ частоте (calls:user.id)
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel(`calls:${user.id}`);
    
    channel.on('broadcast', { event: 'incoming_call' }, async (payload) => {
      // ЕСЛИ УЖЕ ЗАНЯТ - ШЛЕМ ОТКАЗ ЗВОНЯЩЕМУ
      if (callStateRef.current !== 'idle') {
        const busyChannel = supabase.channel(`calls:${payload.payload.from}`);
        busyChannel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            busyChannel.send({ type: 'broadcast', event: 'call_busy' });
            setTimeout(() => supabase.removeChannel(busyChannel), 2000);
          }
        });
        return;
      }

      remoteOfferRef.current = payload.payload.sdp;
      const { data } = await supabase.from('profiles').select('*').eq('id', payload.payload.from).single();
      setRemotePeer(data || { id: payload.payload.from, display_name: 'Пользователь' });
      setCallState('incoming');
    });

    channel.on('broadcast', { event: 'call_busy' }, () => {
      alert('Абонент занят или уже разговаривает.');
      setCallState('idle');
    });

    channel.on('broadcast', { event: 'call_accepted' }, async (payload) => {
      setCallState('active');
      if (pcRef.current) await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.payload.sdp));
    });

    channel.on('broadcast', { event: 'ice_candidate' }, async (payload) => {
      if (pcRef.current) {
        try { await pcRef.current.addIceCandidate(new RTCIceCandidate(payload.payload.candidate)); } catch (e) {}
      }
    });

    channel.subscribe();
    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // 2. Совершаем звонок (Отправляем сигнал В КОМНАТУ СОБЕСЕДНИКА)
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
      if (event.candidate && peer) {
        const peerChannel = supabase.channel(`calls:${peer.id}`);
        peerChannel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            peerChannel.send({ type: 'broadcast', event: 'ice_candidate', payload: { candidate: event.candidate } });
          }
        });
      }
    };
    
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Создаем канал для СОБЕСЕДНИКА и отправляем туда сигнал!
    const peerChannel = supabase.channel(`calls:${peer.id}`);
    peerChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        peerChannel.send({ 
          type: 'broadcast', 
          event: 'incoming_call', 
          payload: { from: user.id, sdp: offer } 
        });
      }
    });
  }, [user]);

  // 3. Принимаем звонок (Отправляем ответ В КОМНАТУ ЗВОНЯЩЕГО)
  const acceptCall = useCallback(async () => {
    if (!remotePeer || !user || !remoteOfferRef.current) return;
    setCallState('active');
    
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    setLocalStream(stream);
    
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    pcRef.current = pc;
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
    
    pc.onicecandidate = (event) => { 
      if (event.candidate && remotePeer) {
         const callerChannel = supabase.channel(`calls:${remotePeer.id}`);
         callerChannel.subscribe((status) => {
           if (status === 'SUBSCRIBED') {
             callerChannel.send({ type: 'broadcast', event: 'ice_candidate', payload: { candidate: event.candidate } });
           }
         });
      }
    };

    await pc.setRemoteDescription(new RTCSessionDescription(remoteOfferRef.current));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    const callerChannel = supabase.channel(`calls:${remotePeer.id}`);
    callerChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        callerChannel.send({ type: 'broadcast', event: 'call_accepted', payload: { sdp: answer } });
      }
    });
  }, [remotePeer, user]);

  const toggleMute = useCallback(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => { track.enabled = !track.enabled; });
      setIsMuted(prev => !prev);
    }
  }, [localStream]);

  const endCall = useCallback(() => {
    pcRef.current?.close();
    localStream?.getTracks().forEach(t => t.stop());
    setCallState('idle');
    setLocalStream(null);
    setRemotePeer(null);
    setIsMuted(false);
    remoteOfferRef.current = null;
  }, [localStream]);

  return { callState, remotePeer, isMuted, startCall, acceptCall, endCall, toggleMute };
}
