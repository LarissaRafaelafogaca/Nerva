import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

const subs = await p.pushSubscription.findMany({
  select: { id: true, userId: true, endpoint: true, userAgent: true, createdAt: true },
  orderBy: { createdAt: 'desc' },
  take: 20,
});

console.log(`Total inscrições: ${subs.length}`);
for (const s of subs) {
  const isIOS = s.userAgent?.includes('iPhone') || s.userAgent?.includes('iPad') || s.endpoint?.includes('apple');
  console.log(JSON.stringify({
    id: s.id,
    userId: s.userId,
    endpoint: s.endpoint?.slice(0, 60) + '...',
    ios: isIOS,
    ua: s.userAgent?.slice(0, 80),
    created: s.createdAt,
  }));
}

await p.$disconnect();
