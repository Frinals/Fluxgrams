import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export function useCall() {
  const { user } = useAuth();
  const [callState, setCallState] = useState<'idle' | 'calling' | 'incoming' | 'active'>('idle');
  const [remotePeer, setRemotePeer] = useState<any>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel(`calls:${user.id}`);
    
    channel.on('broadcast', { event: 'incoming_call' }, (payload) => {
      setRemotePeer(payload.payload.from);
      setCallState('incoming');

      // УВЕДОМЛЕНИЕ О ЗВОНКЕ
      if ('Notification' in window && Notification.permission === 'granted') {
        const notification = new Notification('Входящий звонок!', {
          body: 'Нажмите, чтобы открыть приложение.',
          icon: '/Fluxgram/vite.svg',
          tag: 'call',
          requireInteraction: true, // Уведомление не исчезнет само
        });
        
        // Если нажать на уведомление, откроется вкладка
        notification.onclick = () => {
          window.focus();
        };
      }
    });

    // ... остальная логика звонков (acceptCall, ice_candidate) без изменений ...
    channel.on('broadcast', { event: 'call_accepted' }, async (payload) => {
      setCallState('active');
      if (pcRef.current) await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.payload.sdp));
    });

    channel.on('broadcast', { event: 'webrtc_answer' }, async (payload) => {
      if (pcRef.current) await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.payload.sdp));
    });

    channel.on('broadcast', { event: 'ice_candidate' }, async (payload) => {
      if (pcRef.current) await pcRef.current.addIceCandidate(new RTCIceCandidate(payload.payload.candidate));
    });

    channel.subscribe();
    channelRef.current = channel;

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const startCall = useCallback(async (peerId: string) => {
    if (!user) return;
    setCallState('calling');
    setRemotePeer(peerId);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    setLocalStream(stream);
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    pcRef.current = pc;
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
    pc.onicecandidate = (event) => {
      if (event.candidate) channelRef.current?.send({ type: 'broadcast', event: 'ice_candidate', payload: { candidate: event.candidate, to: peerId } });
    };
    pc.ontrack = (event) => setRemoteStream(event.streams[0]);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    channelRef.current?.send({ type: 'broadcast', event: 'incoming_call', payload: { from: user.id, sdp: offer, to: peerId } });
  }, [user]);

  const acceptCall = useCallback(async () => {
    if (!remotePeer || !user) return;
    setCallState('active');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    setLocalStream(stream);
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    pcRef.current = pc;
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
    pc.onicecandidate = (event) => {
      if (event.candidate) channelRef.current?.send({ type: 'broadcast', event: 'ice_candidate', payload: { candidate: event.candidate, to: remotePeer } });
    };
    pc.ontrack = (event) => setRemoteStream(event.streams[0]);
    channelRef.current?.send({ type: 'broadcast', event: 'call_accepted', payload: { sdp: pc.localDescription, to: remotePeer } });
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
    setRemoteStream(null);
    setRemotePeer(null);
    setIsMuted(false);
  }, [localStream]);

  return { callState, remotePeer, localStream, remoteStream, isMuted, startCall, acceptCall, endCall, toggleMute };
}
