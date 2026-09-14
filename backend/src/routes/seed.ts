import { Router } from 'express';
import argon2 from 'argon2';
import { prisma } from '../config/database';
import { env } from '../config/env';

const router = Router();

// Endpoint de seed — só funciona em desenvolvimento OU se SEED_SECRET bater.
// Remover após o uso em produção.
router.post('/seed', async (req, res) => {
  const secret = req.headers['x-seed-secret'] || req.body?.secret;
  if (env.isProd && secret !== process.env.SEED_SECRET) {
    res.status(403).json({ error: 'forbidden' });
    return;
  }

  try {
    const password = await argon2.hash('Password123');
    const adminEmail = (process.env.ADMIN_EMAILS || 'larissarafaelafogaca@gmail.com')
      .split(',')[0].trim().toLowerCase();

    // Admin
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: { passwordHash: password, emailVerified: true, role: 'admin', profile: 'admin' },
      create: { email: adminEmail, passwordHash: password, fullName: 'Larissa Rafaela Fogaça', role: 'admin', profile: 'admin', emailVerified: true, provider: 'local' },
    });

    // Paciente 1
    const p1 = await prisma.user.upsert({
      where: { email: 'paciente@nerva.test' },
      update: { passwordHash: password, emailVerified: true },
      create: { email: 'paciente@nerva.test', passwordHash: password, fullName: 'Paciente Fictício', role: 'user', profile: 'patient', emailVerified: true, provider: 'local', language: 'pt' },
    });

    // Paciente 2
    await prisma.user.upsert({
      where: { email: 'paciente2@nerva.test' },
      update: { passwordHash: password, emailVerified: true },
      create: { email: 'paciente2@nerva.test', passwordHash: password, fullName: 'Segundo Paciente Fictício', role: 'user', profile: 'patient', emailVerified: true, provider: 'local' },
    });

    // Usuários de teste do Google
    for (const email of ['larissa.rafaela.aluno@unifacvest.edu.br', 'rosasimone09@gmail.com']) {
      await prisma.user.upsert({
        where: { email },
        update: { emailVerified: true },
        create: { email, role: 'user', profile: 'patient', emailVerified: true, provider: 'local', passwordHash: password },
      });
    }

    // Medicamentos do paciente 1
    const med1 = await prisma.medication.upsert({
      where: { id: 'seed-med-1' },
      update: {},
      create: { id: 'seed-med-1', userId: p1.id, name: 'Carbamazepina', dosage: '200mg', frequency: '2x/dia', times: ['08:00', '20:00'], color: 'emerald', active: true },
    });

    // Doses dos últimos 7 dias
    const today = new Date().toISOString().split('T')[0];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const date = d.toISOString().split('T')[0];
      if (date === today) continue;
      for (const time of ['08:00', '20:00']) {
        await prisma.doseLog.upsert({
          where: { uniq_scheduled_dose: { userId: p1.id, medicationId: med1.id, scheduledDate: date, scheduledTime: time } },
          update: {},
          create: { userId: p1.id, medicationId: med1.id, medicationName: 'Carbamazepina', scheduledDate: date, scheduledTime: time, status: 'taken', takenAt: new Date(date + 'T' + time + ':00Z') },
        });
      }
    }

    res.json({
      ok: true,
      message: 'Seed concluído. REMOVA este endpoint após o uso.',
      users: [adminEmail, 'paciente@nerva.test', 'paciente2@nerva.test'],
      password: 'Password123',
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
