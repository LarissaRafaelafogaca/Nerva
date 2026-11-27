self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'Nerva', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Nerva';
  const options = {
    body: payload.body || '',
    tag: payload.tag || 'nerva',
    renotify: true,
    requireInteraction: true,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    // vibration pattern — iOS uses system default
    vibrate: [400, 150, 400, 150, 400],
    actions: [
      { action: 'taken', title: 'Tomei' },
      { action: 'open', title: 'Abrir' },
    ],
    data: { url: payload.url || '/', ...(payload.data || {}) },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const doseId = data.doseId;
  const markTaken = event.action === 'taken' && doseId;

  let targetUrl = data.url || '/';
  if (markTaken) {
    targetUrl = `/dashboard?markDose=${encodeURIComponent(doseId)}&status=taken`;
  }

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const client = clients[0];

      if (client) {
        client.postMessage(
          markTaken
            ? { type: 'mark-dose', doseId, status: 'taken' }
            : { type: 'notification-click', url: targetUrl },
        );
        if ('navigate' in client && markTaken) {
          try {
            await client.navigate(targetUrl);
          } catch {
            /* navigate() not supported in all browsers; postMessage covers this */
          }
        }
        if ('focus' in client) return client.focus();
      }

      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      return undefined;
    })(),
  );
});
