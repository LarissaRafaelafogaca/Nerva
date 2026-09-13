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

let token: string;

beforeEach(async () => {
  await resetDb();
  const u = await makeUser('crud@nerva.test');
  token = u.token;
});

afterAll(async () => {
  await closeDb();
});

function auth(req: request.Test) {
  return req.set('Authorization', `Bearer ${token}`);
}

describe('CRUD de recursos', () => {
  it('medicamentos: create/list/update/delete', async () => {
    const created = await auth(request(app).post('/api/medications')).send({ name: 'Lamotrigina', dosage: '100mg', times: ['09:00'] });
    expect(created.status).toBe(201);
    expect(created.body.name).toBe('Lamotrigina');
    expect(created.body.created_by_id).toBeDefined();
    expect(created.body.created_date).toBeDefined();
    const id = created.body.id;

    const updated = await auth(request(app).patch(`/api/medications/${id}`)).send({ dosage: '150mg' });
    expect(updated.body.dosage).toBe('150mg');

    const del = await auth(request(app).delete(`/api/medications/${id}`));
    expect(del.status).toBe(200);
    const list = await auth(request(app).get('/api/medications'));
    expect(list.body).toHaveLength(0);
  });

  it('crises: sort e limit', async () => {
    for (const d of ['2026-01-01T10:00:00Z', '2026-02-01T10:00:00Z', '2026-03-01T10:00:00Z']) {
      await auth(request(app).post('/api/seizures')).send({ date_time: d, type: 'focal' });
    }
    const desc = await auth(request(app).get('/api/seizures?sort=-date_time&limit=2'));
    expect(desc.body).toHaveLength(2);
    expect(new Date(desc.body[0].date_time).getTime()).toBeGreaterThan(new Date(desc.body[1].date_time).getTime());
  });

  it('filtro com $gte funciona em dose-logs', async () => {
    const med = await prisma.medication.create({ data: { userId: (await prisma.user.findFirst())!.id, name: 'M', times: ['08:00'] } });
    await auth(request(app).post('/api/dose-logs')).send({ medication_id: med.id, scheduled_date: '2026-01-01', scheduled_time: '08:00' });
    await auth(request(app).post('/api/dose-logs')).send({ medication_id: med.id, scheduled_date: '2026-06-01', scheduled_time: '08:00' });

    const filter = encodeURIComponent(JSON.stringify({ scheduled_date: { $gte: '2026-05-01' } }));
    const res = await auth(request(app).get(`/api/dose-logs?filter=${filter}`));
    expect(res.body).toHaveLength(1);
    expect(res.body[0].scheduled_date).toBe('2026-06-01');
  });

  it('sono: registro por data e validação', async () => {
    const ok = await auth(request(app).post('/api/sleep-records')).send({ date: '2026-01-01', hours: 8, quality: 'good' });
    expect(ok.status).toBe(201);
    const bad = await auth(request(app).post('/api/sleep-records')).send({ date: '2026-01-02', hours: 99 });
    expect(bad.status).toBe(422);
  });

  it('efeito colateral: create e list', async () => {
    const res = await auth(request(app).post('/api/side-effects')).send({ date: '2026-01-01', description: 'Tontura' });
    expect(res.status).toBe(201);
    const list = await auth(request(app).get('/api/side-effects'));
    expect(list.body).toHaveLength(1);
  });

  it('updateMe atualiza preferências e mascara o PIN', async () => {
    const res = await auth(request(app).patch('/api/auth/me')).send({
      theme: 'dark',
      preferences: { security: { pin: '1234', pinLock: true } },
    });
    expect(res.status).toBe(200);
    expect(res.body.theme).toBe('dark');
    expect(res.body.preferences.security.pin).toBe('__set__'); // nunca expõe o hash
  });
});
