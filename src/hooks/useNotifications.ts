import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export function useNotifications() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // 1. Спрашиваем разрешение у телефона на показ уведомлений
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // 2. Слушаем новые сообщения
    const messageChannel = supabase.channel('global_notifications_messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        // Если сообщение не от нас
        if (payload.new.sender_id !== user.id) {
          // Достаем имя того, кто написал
          const { data } = await supabase.from('profiles').select('display_name').eq('id', payload.new.sender_id).single();
          const senderName = data?.display_name || 'Пользователь';
          
          // Показываем уведомление, если у нас есть разрешение
          if (Notification.permission === 'granted') {
            new Notification(`Сообщение от ${senderName}`, {
              body: payload.new.content || 'Медиафайл',
              icon: '/Fluxgram/vite.svg', // Путь к твоей иконке
              tag: 'message', // Чтобы уведомления заменяли друг друга
            });
          }
        }
      }).subscribe();

    return () => {
      supabase.removeChannel(messageChannel);
    };
  }, [user]);
}
