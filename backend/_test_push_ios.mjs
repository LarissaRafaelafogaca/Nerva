import { PrismaClient } from '@prisma/client';
import webpush from 'web-push';
import dotenv from 'dotenv';
dotenv.config();

const p = new PrismaClient();

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY,
);

// Pega a inscrição iOS mais recente da Larissa
const sub = await p.pushSubscription.findFirst({
  where: {
    userId: 'e1a0dda8-24ba-422c-82c2-1e3178c8032d',
    endpoint: { startsWith: 'https://web.push.apple.com' },
  },
  orderBy: { createdAt: 'desc' },
});

console.log('Inscrição iOS encontrada:', sub?.endpoint?.slice(0, 80));

const payload = JSON.stringify({
  title: 'Nerva — teste direto',
  body: 'Se você está vendo isso, o push iOS funcionou! 🎉',
  tag: 'test-ios-direct',
  url: '/dashboard',
});

try {
  const result = await webpush.sendNotification(
    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
    payload,
  );
  console.log('SUCESSO:', result.statusCode, result.body);
} catch (err) {
  console.log('ERRO:', err.statusCode, err.body, err.message);
}

await p.$disconnect();
