/**
 * Seed de DESENVOLVIMENTO — dados SINTÉTICOS.
 * NUNCA use dados reais de pacientes. Nomes, e-mails e registros são fictícios.
 */
import 'dotenv/config';
import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().split('T')[0];
}

async function main(): Promise<void> {
  console.log('Seeding dados sintéticos...');

  const password = await argon2.hash('Password123');

  // ---- Admin (Larissa Rafaela Fogaça) ----
  // Deve bater com ADMIN_EMAILS no .env para ter acesso administrativo.
  const adminEmail = (process.env.ADMIN_EMAILS ?? 'larissarafaelafogaca@gmail.com')
    .split(',')[0]
    .trim()
    .toLowerCase();
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: 'admin', profile: 'admin', emailVerified: true },
    create: {
      email: adminEmail,
      passwordHash: password,
      fullName: 'Larissa Rafaela Fogaça',
      role: 'admin',
      profile: 'admin',
      emailVerified: true,
    },
  });

  // ---- Paciente 1 (sintético) ----
  const patient = await prisma.user.upsert({
    where: { email: 'paciente@nerva.test' },
    update: {},
    create: {
      email: 'paciente@nerva.test',
      passwordHash: password,
      fullName: 'Paciente Fictício',
      role: 'user',
      profile: 'patient',
      emailVerified: true,
      language: 'pt',
    },
  });

  // ---- Paciente 2 (sintético) ----
  const patient2 = await prisma.user.upsert({
    where: { email: 'paciente2@nerva.test' },
    update: {},
    create: {
      email: 'paciente2@nerva.test',
      passwordHash: password,
      fullName: 'Segundo Paciente Fictício',
      role: 'user',
      profile: 'patient',
      emailVerified: true,
    },
  });

  // Limpa dados antigos dos pacientes de seed (idempotência)
  for (const uid of [patient.id, patient2.id]) {
    await prisma.doseLog.deleteMany({ where: { userId: uid } });
    await prisma.sideEffect.deleteMany({ where: { userId: uid } });
    await prisma.seizure.deleteMany({ where: { userId: uid } });
    await prisma.sleepRecord.deleteMany({ where: { userId: uid } });
    await prisma.medication.deleteMany({ where: { userId: uid } });
  }

  // Medicamentos do paciente 1
  const med1 = await prisma.medication.create({
    data: {
      userId: patient.id,
      name: 'Carbamazepina',
      dosage: '200mg',
      frequency: '2x/dia',
      times: ['08:00', '20:00'],
      color: 'emerald',
      active: true,
    },
  });
  const med2 = await prisma.medication.create({
    data: {
      userId: patient.id,
      name: 'Ácido Valproico',
      dosage: '500mg',
      frequency: '1x/dia',
      times: ['22:00'],
      color: 'violet',
      active: true,
    },
  });

  // Doses dos últimos 30 dias (mix de status)
  const doseData: any[] = [];
  for (let i = 30; i >= 1; i--) {
    const date = daysAgo(i);
    for (const med of [med1, med2]) {
      for (const time of med.times) {
        const roll = Math.random();
        const status = roll < 0.75 ? 'taken' : roll < 0.9 ? 'missed' : 'skipped';
        doseData.push({
          userId: patient.id,
          medicationId: med.id,
          medicationName: med.name,
          scheduledDate: date,
          scheduledTime: time,
          status,
          takenAt: status === 'taken' ? new Date(`${date}T${time}:00Z`) : null,
        });
      }
    }
  }
  await prisma.doseLog.createMany({ data: doseData, skipDuplicates: true });

  // Crises
  await prisma.seizure.createMany({
    data: [
      {
        userId: patient.id,
        dateTime: new Date(`${daysAgo(12)}T14:30:00Z`),
        type: 'focal',
        durationMinutes: 2,
        severity: 'mild',
        triggers: ['triggerStress', 'triggerSleep'],
        notes: 'Registro sintético.',
      },
      {
        userId: patient.id,
        dateTime: new Date(`${daysAgo(4)}T09:15:00Z`),
        type: 'tonic_clonic',
        durationMinutes: 3,
        severity: 'moderate',
        triggers: ['triggerMissedMed'],
      },
    ],
  });

  // Sono
  const sleepData = [];
  for (let i = 7; i >= 1; i--) {
    sleepData.push({
      userId: patient.id,
      date: daysAgo(i),
      hours: Number((6 + Math.random() * 3).toFixed(1)),
      quality: (['fair', 'good', 'excellent'] as const)[Math.floor(Math.random() * 3)],
      bedtime: '23:00',
      wakeTime: '07:00',
    });
  }
  await prisma.sleepRecord.createMany({ data: sleepData, skipDuplicates: true });

  // Efeito colateral
  await prisma.sideEffect.create({
    data: {
      userId: patient.id,
      date: daysAgo(6),
      medicationId: med1.id,
      medicationName: med1.name,
      description: 'Sonolência leve pela manhã (dado sintético).',
      severity: 'mild',
    },
  });

  console.log('Seed concluído.');
  console.log('Logins sintéticos (senha: Password123):');
  console.log(`  admin:    ${admin.email}`);
  console.log(`  paciente: ${patient.email}`);
  console.log(`  paciente: ${patient2.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
