// Camada de push do front-end: registra o service worker, pede permissão
// (SEMPRE a partir de um toque do usuário — exigência do iOS), inscreve o
// dispositivo e envia a inscrição ao backend.
import { http } from '@/api/httpClient';

const SW_URL = '/sw.js';

export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

// Detecta iOS e se o app está rodando instalado (standalone).
export function isIOS() {
  return /iP(hone|ad|od)/.test(navigator.userAgent);
}
export function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)')?.matches ||
    window.navigator.standalone === true
  );
}

// No iOS o push só funciona com o PWA instalado na tela inicial.
export function needsInstallFirst() {
  return isIOS() && !isStandalone();
}

export function permissionStatus() {
  return isPushSupported() ? Notification.permission : 'unsupported';
}

let swRegistration = null;
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  if (!swRegistration) {
    swRegistration = await navigator.serviceWorker.register(SW_URL, { scope: '/' });
  }
  return swRegistration;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

// Fluxo completo: chamar a partir do clique em "Ativar lembretes".
// Retorna { ok, reason }. reason em caso de falha: 'unsupported' | 'install_first'
// | 'denied' | 'no_key' | 'error'.
export async function enablePush() {
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' };
  if (needsInstallFirst()) return { ok: false, reason: 'install_first' };

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, reason: 'denied' };

  const { publicKey, enabled } = await http.get('/push/public-key', { auth: false });
  if (!enabled || !publicKey) return { ok: false, reason: 'no_key' };

  const reg = await registerServiceWorker();
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  const json = sub.toJSON();
  await http.post('/push/subscribe', {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  });

  return { ok: true };
}

export async function disablePush() {
  try {
    const reg = await registerServiceWorker();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe().catch(() => {});
      await http.post('/push/unsubscribe', { endpoint }).catch(() => {});
    }
  } catch {
    /* ignore */
  }
}

// Dispara uma notificação de teste imediata (para a demonstração).
export async function sendTestNotification() {
  return http.post('/push/test', {});
}
