/* Service Worker do Nerva — recebe push e exibe a notificação de lembrete. */

// Ativa imediatamente novas versões.
self.addEventListener('install', () => {
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Recebe o push enviado pelo backend e mostra a notificação.
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
    // Mantém a notificação na tela até o usuário interagir (não some sozinha) —
    // importante para um lembrete de medicamento. (Melhor suporte no Android.)
    requireInteraction: true,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    // Vibração forte/insistente (o iOS usa o padrão do sistema).
    vibrate: [400, 150, 400, 150, 400],
    // Ações rápidas direto da notificação.
    actions: [
      { action: 'taken', title: 'Tomei' },
      { action: 'open', title: 'Abrir' },
    ],
    data: { url: payload.url || '/', ...(payload.data || {}) },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Ao tocar na notificação (ou numa ação), foca/abre o app. Se o usuário tocou
// em "Tomei", pedimos ao app para registrar a dose como tomada — o app tem o
// token de autenticação, então a marcação é feita por ele (com segurança).
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const doseId = data.doseId;
  const markTaken = event.action === 'taken' && doseId;

  // URL para abrir: se for "Tomei", inclui parâmetros que o app interpreta.
  let targetUrl = data.url || '/';
  if (markTaken) {
    targetUrl = `/dashboard?markDose=${encodeURIComponent(doseId)}&status=taken`;
  }

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const client = clients[0];

      if (client) {
        // App já aberto: envia a instrução por mensagem E também navega via URL
        // (redundância proposital para garantir que a marcação aconteça).
        client.postMessage(
          markTaken
            ? { type: 'mark-dose', doseId, status: 'taken' }
            : { type: 'notification-click', url: targetUrl },
        );
        if ('navigate' in client && markTaken) {
          try {
            await client.navigate(targetUrl);
          } catch {
            /* alguns navegadores restringem navigate(); o postMessage cobre */
          }
        }
        if ('focus' in client) return client.focus();
      }

      // App fechado: abre na URL com os parâmetros (o app processa ao carregar).
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      return undefined;
    })(),
  );
});
