import { prisma } from '../../config/database';
import { NotFound } from '../../utils/errors';
import { computeAdherence } from '../doses/dose.service';
import {
  serializeMedication,
  serializeSeizure,
  serializeSleepRecord,
  serializeUser,
} from '../../utils/serialize';

function isPatient(u: { profile: string | null; role: string }): boolean {
  return u.profile === 'patient' || (!u.profile && u.role === 'user');
}

// Lista pacientes com estatísticas agregadas (adesão 90d, contagem de crises, etc.).
export async function listPatients(): Promise<any[]> {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
  const patients = users.filter(isPatient);

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setUTCDate(ninetyDaysAgo.getUTCDate() - 90);
  const fromDate = ninetyDaysAgo.toISOString().split('T')[0];

  const result = [];
  for (const p of patients) {
    const [doses, seizureCount, activeMeds, sleep] = await Promise.all([
      prisma.doseLog.findMany({
        where: { userId: p.id, scheduledDate: { gte: fromDate } },
        select: { status: true },
      }),
      prisma.seizure.count({ where: { userId: p.id } }),
      prisma.medication.count({ where: { userId: p.id, active: true } }),
      prisma.sleepRecord.findMany({
        where: { userId: p.id },
        orderBy: { date: 'desc' },
        take: 7,
        select: { hours: true },
      }),
    ]);
    const adherence = computeAdherence(doses);
    const sleepAvg = sleep.length
      ? Number((sleep.reduce((s, r) => s + (r.hours || 0), 0) / sleep.length).toFixed(1))
      : null;
    result.push({
      patient: serializeUser(p),
      adherence,
      seizureCount,
      activeMeds,
      sleepAvg,
    });
  }
  return result;
}

export async function getPatientDetail(id: string): Promise<any> {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || !isPatient(user)) throw NotFound('Patient not found');

  const [meds, seizures, sleep, doses] = await Promise.all([
    prisma.medication.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' } }),
    prisma.seizure.findMany({ where: { userId: id }, orderBy: { dateTime: 'desc' }, take: 10 }),
    prisma.sleepRecord.findMany({ where: { userId: id }, orderBy: { date: 'desc' }, take: 7 }),
    prisma.doseLog.findMany({
      where: { userId: id },
      select: { status: true },
    }),
  ]);

  return {
    patient: serializeUser(user),
    medications: meds.map(serializeMedication),
    seizures: seizures.map(serializeSeizure),
    sleep: sleep.map(serializeSleepRecord),
    adherence: computeAdherence(doses),
  };
}

// Visão epidemiológica agregada (sem PII).
export async function getEpidemiology(): Promise<any> {
  const users = await prisma.user.findMany({ select: { id: true, profile: true, role: true } });
  const patients = users.filter(isPatient);
  const patientIds = patients.map((p) => p.id);

  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [seizuresThisMonth, activeMedCount, seizureTypeGroups, doses] = await Promise.all([
    prisma.seizure.count({
      where: { userId: { in: patientIds }, dateTime: { gte: startOfMonth } },
    }),
    prisma.medication.count({ where: { userId: { in: patientIds }, active: true } }),
    prisma.seizure.groupBy({
      by: ['type'],
      where: { userId: { in: patientIds } },
      _count: { _all: true },
    }),
    prisma.doseLog.findMany({
      where: { userId: { in: patientIds } },
      select: { status: true },
    }),
  ]);

  const adherence = computeAdherence(doses);
  const seizureTypeDistribution = seizureTypeGroups.map((g) => ({
    type: g.type ?? 'unknown',
    count: g._count._all,
  }));

  return {
    totalPatients: patients.length,
    seizuresThisMonth,
    avgAdherence: adherence.rate,
    activeMedCount,
    seizureTypeDistribution,
  };
}
