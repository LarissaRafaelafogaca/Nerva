import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database';
import * as authService from '../src/modules/auth/auth.service';
import { resetDb, closeDb } from './helpers';

const app = createApp();

async function makeUser(email: string) {
  await authService.register({ email, password: 'Password123', full_name: email });
  const user = await prisma.user.findUnique({ where: { email } });
  await prisma.user.update({ where: { id: user!.id }, data: { emailVerified: true } });
  const login = await request(app).post('/api/auth/login').send({ email, password: 'Password123' });
  return { id: user!.id, token: login.body.access_token as string };
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await closeDb();
});

describe('Push', () => {
  it('expõe a chave pública sem exigir autenticação', async () => {
    const res = await request(app).get('/api/push/public-key');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('enabled');
  });

  it('exige autenticação para inscrever', async () => {
    const res = await request(app)
      .post('/api/push/subscribe')
      .send({ endpoint: 'https://example.com/x', keys: { p256dh: 'a', auth: 'b' } });
    expect(res.status).toBe(401);
  });

  it('salva e remove a inscrição do usuário autenticado', async () => {
    const u = await makeUser('push@nerva.test');
    const sub = {
      endpoint: 'https://push.example.com/abc',
      keys: { p256dh: 'chave-p256dh', auth: 'chave-auth' },
    };
    const create = await request(app)
      .post('/api/push/subscribe')
      .set('Authorization', `Bearer ${u.token}`)
      .send(sub);
    expect(create.status).toBe(201);
    expect(await prisma.pushSubscription.count({ where: { userId: u.id } })).toBe(1);

    const del = await request(app)
      .post('/api/push/unsubscribe')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ endpoint: sub.endpoint });
    expect(del.status).toBe(200);
    expect(await prisma.pushSubscription.count({ where: { userId: u.id } })).toBe(0);
  });
});
