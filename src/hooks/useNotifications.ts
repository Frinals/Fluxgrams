import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export function useNotifications() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Запрашиваем разрешение
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const messageChannel = supabase.channel('global_notifications_messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        if (payload.new.sender_id !== user.id) {
          const { data } = await supabase.from('profiles').select('display_name').eq('id', payload.new.sender_id).single();
          const senderName = data?.display_name || 'Пользователь';

          if (Notification.permission === 'granted') {
            // ИСПОЛЬЗУЕМ SERVICE WORKER ДЛЯ ФОНОВЫХ УВЕДОМЛЕНИЙ
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.ready.then(registration => {
                registration.showNotification(`Сообщение от ${senderName}`, {
                  body: payload.new.content || 'Медиафайл',
                  icon: '/Fluxgram/vite.svg',
                  tag: 'message',
                  vibrate: [200, 100, 200] // Вибрация для телефона (если поддерживается)
                } as any);
              });
            } else {
              // Если Service Worker не поддерживается, показываем обычное
              new Notification(`Сообщение от ${senderName}`, {
                body: payload.new.content || 'Медиафайл',
                icon: '/Fluxgram/vite.svg',
              });
            }
          }
        }
      }).subscribe();

    return () => {
      supabase.removeChannel(messageChannel);
    };
  }, [user]);
}
