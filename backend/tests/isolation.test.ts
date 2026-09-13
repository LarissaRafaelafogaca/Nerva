import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database';
import * as authService from '../src/modules/auth/auth.service';
import { resetDb, closeDb } from './helpers';

const app = createApp();

async function makeUser(email: string, opts: { admin?: boolean } = {}) {
  await authService.register({ email, password: 'Password123', full_name: email });
  const user = await prisma.user.findUnique({ where: { email } });
  await prisma.user.update({
    where: { id: user!.id },
    data: {
      emailVerified: true,
      ...(opts.admin ? { role: 'admin', profile: 'admin' } : {}),
    },
  });
  const login = await request(app).post('/api/auth/login').send({ email, password: 'Password123' });
  return { id: user!.id, token: login.body.access_token as string };
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await closeDb();
});

describe('Isolamento de usuários', () => {
  it('usuário não vê medicamentos de outro', async () => {
    const alice = await makeUser('alice@nerva.test');
    const bob = await makeUser('bob@nerva.test');

    await request(app)
      .post('/api/medications')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ name: 'Med da Alice', times: ['08:00'] });

    const bobList = await request(app)
      .get('/api/medications')
      .set('Authorization', `Bearer ${bob.token}`);
    expect(bobList.status).toBe(200);
    expect(bobList.body).toHaveLength(0);

    const aliceList = await request(app)
      .get('/api/medications')
      .set('Authorization', `Bearer ${alice.token}`);
    expect(aliceList.body).toHaveLength(1);
  });

  it('usuário não altera nem exclui recurso de outro (404)', async () => {
    const alice = await makeUser('alice2@nerva.test');
    const bob = await makeUser('bob2@nerva.test');

    const created = await request(app)
      .post('/api/seizures')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ date_time: new Date().toISOString(), type: 'focal' });
    const id = created.body.id;

    const bobUpdate = await request(app)
      .patch(`/api/seizures/${id}`)
      .set('Authorization', `Bearer ${bob.token}`)
      .send({ notes: 'invasão' });
    expect(bobUpdate.status).toBe(404);

    const bobDelete = await request(app)
      .delete(`/api/seizures/${id}`)
      .set('Authorization', `Bearer ${bob.token}`);
    expect(bobDelete.status).toBe(404);
  });

  it('deleteMany não apaga dados de outro usuário', async () => {
    const alice = await makeUser('alice3@nerva.test');
    const bob = await makeUser('bob3@nerva.test');
    await request(app).post('/api/sleep-records').set('Authorization', `Bearer ${alice.token}`).send({ date: '2026-01-01', hours: 8 });
    await request(app).post('/api/sleep-records').set('Authorization', `Bearer ${bob.token}`).send({ date: '2026-01-01', hours: 7 });

    // Bob tenta apagar tudo passando created_by_id da Alice
    await request(app)
      .post('/api/sleep-records/delete-many')
      .set('Authorization', `Bearer ${bob.token}`)
      .send({ filter: { created_by_id: alice.id } });

    const aliceRecs = await request(app).get('/api/sleep-records').set('Authorization', `Bearer ${alice.token}`);
    expect(aliceRecs.body).toHaveLength(1); // dados da Alice intactos
  });

  it('usuário comum não acessa endpoints administrativos', async () => {
    const bob = await makeUser('bob4@nerva.test');
    const res = await request(app).get('/api/admin/patients').set('Authorization', `Bearer ${bob.token}`);
    expect(res.status).toBe(403);

    const usersList = await request(app).get('/api/users').set('Authorization', `Bearer ${bob.token}`);
    expect(usersList.status).toBe(403);
  });

  it('admin acessa endpoints administrativos', async () => {
    const admin = await makeUser('admin@nerva.test', { admin: true });
    const res = await request(app).get('/api/admin/patients').set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    const epi = await request(app).get('/api/admin/epidemiology').set('Authorization', `Bearer ${admin.token}`);
    expect(epi.status).toBe(200);
    expect(epi.body).toHaveProperty('totalPatients');
  });

  it('deleteMany do ADMIN também não apaga dados de outro usuário', async () => {
    const admin = await makeUser('admin2@nerva.test', { admin: true });
    const patient = await makeUser('vitima@nerva.test');
    await request(app)
      .post('/api/medications')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ name: 'Med do paciente', times: ['08:00'] });

    // Admin tenta apagar passando o created_by_id do paciente.
    await request(app)
      .post('/api/medications/delete-many')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ filter: { created_by_id: patient.id } });

    // Dados do paciente devem permanecer intactos.
    const patientMeds = await request(app)
      .get('/api/medications')
      .set('Authorization', `Bearer ${patient.token}`);
    expect(patientMeds.body).toHaveLength(1);
  });
});
