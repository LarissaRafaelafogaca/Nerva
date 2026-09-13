import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database';
import * as authService from '../src/modules/auth/auth.service';
import { computeAdherence, markMissedDoses, todayStr } from '../src/modules/doses/dose.service';
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

describe('Doses e adesão', () => {
  it('gera doses do dia sem duplicar', async () => {
    const u = await makeUser('dose1@nerva.test');
    await request(app)
      .post('/api/medications')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ name: 'Med', times: ['08:00', '20:00'] });

    const first = await request(app).get('/api/doses').set('Authorization', `Bearer ${u.token}`);
    expect(first.status).toBe(200);
    expect(first.body).toHaveLength(2);

    // Segunda chamada não deve duplicar
    const second = await request(app).get('/api/doses').set('Authorization', `Bearer ${u.token}`);
    expect(second.body).toHaveLength(2);
  });

  it('marca dose como tomada e pulada', async () => {
    const u = await makeUser('dose2@nerva.test');
    await request(app).post('/api/medications').set('Authorization', `Bearer ${u.token}`).send({ name: 'Med', times: ['08:00'] });
    const doses = await request(app).get('/api/doses').set('Authorization', `Bearer ${u.token}`);
    const id = doses.body[0].id;

    const taken = await request(app).post(`/api/doses/${id}/take`).set('Authorization', `Bearer ${u.token}`);
    expect(taken.status).toBe(200);
    expect(taken.body.status).toBe('taken');
    expect(taken.body.taken_at).toBeTruthy();
  });

  it('markMissedDoses marca pending vencidas de dias anteriores', async () => {
    const u = await makeUser('dose3@nerva.test');
    const med = await prisma.medication.create({
      data: { userId: u.id, name: 'Med', times: ['08:00'], active: true },
    });
    // dose de ontem, ainda pending
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    await prisma.doseLog.create({
      data: {
        userId: u.id,
        medicationId: med.id,
        medicationName: 'Med',
        scheduledDate: todayStr(yesterday),
        scheduledTime: '08:00',
        status: 'pending',
      },
    });
    const count = await markMissedDoses(new Date(), u.id);
    expect(count).toBe(1);
    const updated = await prisma.doseLog.findFirst({ where: { userId: u.id } });
    expect(updated!.status).toBe('missed');
  });

  it('não altera doses taken/skipped no markMissed', async () => {
    const u = await makeUser('dose4@nerva.test');
    const med = await prisma.medication.create({ data: { userId: u.id, name: 'M', times: ['08:00'], active: true } });
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    await prisma.doseLog.create({
      data: { userId: u.id, medicationId: med.id, scheduledDate: todayStr(yesterday), scheduledTime: '08:00', status: 'taken' },
    });
    const count = await markMissedDoses(new Date(), u.id);
    expect(count).toBe(0);
  });

  it('calcula adesão: taken / (taken+missed+skipped)', () => {
    const a = computeAdherence([
      { status: 'taken' },
      { status: 'taken' },
      { status: 'missed' },
      { status: 'skipped' },
      { status: 'pending' },
    ]);
    expect(a.taken).toBe(2);
    expect(a.total).toBe(5);
    // completed = 4, taken = 2 -> 50%
    expect(a.rate).toBe(50);
  });

  it('endpoint de adesão retorna a janela solicitada', async () => {
    const u = await makeUser('dose5@nerva.test');
    const res = await request(app).get('/api/doses/adherence?days=7').set('Authorization', `Bearer ${u.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('rate');
    expect(res.body).toHaveProperty('from');
    expect(res.body).toHaveProperty('to');
  });

  it('constraint impede dose duplicada exata', async () => {
    const u = await makeUser('dose6@nerva.test');
    const med = await prisma.medication.create({ data: { userId: u.id, name: 'M', times: ['08:00'], active: true } });
    const date = todayStr();
    await prisma.doseLog.create({ data: { userId: u.id, medicationId: med.id, scheduledDate: date, scheduledTime: '08:00', status: 'pending' } });
    await expect(
      prisma.doseLog.create({ data: { userId: u.id, medicationId: med.id, scheduledDate: date, scheduledTime: '08:00', status: 'pending' } }),
    ).rejects.toThrow();
  });
});
