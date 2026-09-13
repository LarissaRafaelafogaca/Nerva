import webpush from 'web-push';
import { prisma } from '../../config/database';
import { env } from '../../config/env';

// Configura o VAPID uma única vez (se houver chaves).
let configured = false;
export function isPushConfigured(): boolean {
  return Boolean(env.vapid.publicKey && env.vapid.privateKey);
}

function ensureConfigured(): void {
  if (configured || !isPushConfigured()) return;
  webpush.setVapidDetails(env.vapid.subject, env.vapid.publicKey, env.vapid.privateKey);
  configured = true;
}

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

// Registra (ou atualiza) a inscrição de push do dispositivo do usuário.
export async function saveSubscription(
  userId: string,
  sub: PushSubscriptionInput,
  userAgent?: string,
): Promise<void> {
  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    update: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent },
    create: {
      userId,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      userAgent,
    },
  });
}

export async function removeSubscription(userId: string, endpoint: string): Promise<void> {
  await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
}

export interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  url?: string;
  data?: Record<string, unknown>;
}

// Envia um push para todas as inscrições de um usuário. Remove inscrições
// expiradas/invalidadas (404/410). Retorna quantos envios tiveram sucesso.
export async function sendToUser(userId: string, payload: PushPayload): Promise<number> {
  ensureConfigured();
  if (!isPushConfigured()) return 0;

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  let sent = 0;

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
        );
        sent += 1;
      } catch (err: any) {
        const status = err?.statusCode;
        // Inscrição não existe mais no navegador → limpar.
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => undefined);
        }
      }
    }),
  );

  return sent;
}
