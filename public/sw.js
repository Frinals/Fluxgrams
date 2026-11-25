self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Новое сообщение';
  const options = {
    body: data.body || 'Откройте приложение, чтобы прочитать',
    icon: '/Fluxgram/vite.svg',
    badge: '/Fluxgram/vite.svg',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      if (clientList.length > 0) return clientList[0].focus();
      return clients.openWindow('/Fluxgram/');
    })
  );
});
