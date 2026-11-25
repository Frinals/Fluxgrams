import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export function useCall() {
  const { user } = useAuth();
  const [callState, setCallState] = useState<'idle' | 'calling' | 'incoming' | 'active'>('idle');
  const [remotePeer, setRemotePeer] = useState<any>(null); // Тут будем хранить данные звонящего
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<any>(null);
  const remoteOfferRef = useRef<any>(null); // Сохраняем входящий оффер

  // 1. Слушаем входящие звонки
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel(`calls:${user.id}`);
    
    channel.on('broadcast', { event: 'incoming_call' }, async (payload) => {
      remoteOfferRef.current = payload.payload.sdp; // Сохраняем оффер
      
      // Подгружаем профиль звонящего, чтобы показать имя и аву
      const { data } = await supabase.from('profiles').select('*').eq('id', payload.payload.from).single();
      setRemotePeer(data || { id: payload.payload.from, display_name: 'Пользователь' });
      
      setCallState('incoming');

      // Уведомление на телефон
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Входящий звонок!', {
          body: `Звонит ${data?.display_name || 'Пользователь'}`,
          icon: '/Fluxgram/vite.svg',
          tag: 'call',
          requireInteraction: true, 
        });
      }
    });

    channel.on('broadcast', { event: 'call_accepted' }, async (payload) => {
      setCallState('active');
      if (pcRef.current) {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.payload.sdp));
      }
    });

    channel.on('broadcast', { event: 'ice_candidate' }, async (payload) => {
      if (pcRef.current) {
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(payload.payload.candidate));
        } catch (e) { console.error(e); }
      }
    });

    channel.subscribe();
    channelRef.current = channel;

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // 2. Совершаем звонок
  const startCall = useCallback(async (peer: any) => {
    if (!user) return;
    setCallState('calling');
    setRemotePeer(peer);

    // Запрашиваем микрофон
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    setLocalStream(stream);

    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    pcRef.current = pc;
    
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    // Передаем наши ICE-кандидаты (маршруты соединения)
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        channelRef.current?.send({ type: 'broadcast', event: 'ice_candidate', payload: { candidate: event.candidate, to: peer.id } });
      }
    };

    // Создаем Оффер (предложение)
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Отправляем Оффер собеседнику
    channelRef.current?.send({
      type: 'broadcast',
      event: 'incoming_call',
      payload: { from: user.id, sdp: offer, to: peer.id }
    });
  }, [user]);

  // 3. Принимаем звонок
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
        channelRef.current?.send({ type: 'broadcast', event: 'ice_candidate', payload: { candidate: event.candidate, to: remotePeer.id } });
      }
    };

    // ГЛАВНОЕ ИСПРАВЛЕНИЕ: Устанавливаем Оффер и генерируем Ответ (Answer)
    await pc.setRemoteDescription(new RTCSessionDescription(remoteOfferRef.current));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    // Отправляем Ответ обратно звонящему
    channelRef.current?.send({ 
      type: 'broadcast', 
      event: 'call_accepted', 
      payload: { sdp: answer, to: remotePeer.id } 
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
