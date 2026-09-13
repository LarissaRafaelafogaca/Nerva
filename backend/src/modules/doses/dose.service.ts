import { prisma } from '../../config/database';
import { serializeDoseLog } from '../../utils/serialize';
import { NotFound } from '../../utils/errors';
import { AuthUser } from '../../middleware/auth';
import { isAdminUser } from '../../middleware/rbac';

// Regras de negócio de doses no backend (a fonte de verdade — o front-end não
// decide se uma dose existe). Datas usam formato YYYY-MM-DD.

const GRACE_PERIOD_MINUTES = 120;

export function todayStr(now = new Date()): string {
  return now.toISOString().split('T')[0];
}

// Gera as doses previstas para uma data a partir dos medicamentos ativos,
// evitando duplicação (constraint única cobre concorrência). Retorna as doses do dia.
export async function generateAndGetDoses(userId: string, date: string): Promise<any[]> {
  const meds = await prisma.medication.findMany({ where: { userId, active: true } });

  const existing = await prisma.doseLog.findMany({ where: { userId, scheduledDate: date } });
  const existingKeys = new Set(existing.map((d) => `${d.medicationId}_${d.scheduledTime ?? ''}`));

  const toCreate: any[] = [];
  for (const med of meds) {
    const times = med.times && med.times.length ? med.times : ['08:00'];
    for (const time of times) {
      const key = `${med.id}_${time}`;
      if (!existingKeys.has(key)) {
        toCreate.push({
          userId,
          medicationId: med.id,
          medicationName: med.name,
          scheduledDate: date,
          scheduledTime: time,
          status: 'pending' as const,
        });
      }
    }
  }

  if (toCreate.length) {
    // skipDuplicates respeita a constraint única e cobre concorrência
    await prisma.doseLog.createMany({ data: toCreate, skipDuplicates: true });
  }

  const all = await prisma.doseLog.findMany({
    where: { userId, scheduledDate: date },
    orderBy: { scheduledTime: 'asc' },
  });
  return all.map(serializeDoseLog);
}

async function assertDoseOwnership(user: AuthUser, id: string) {
  const dose = await prisma.doseLog.findUnique({ where: { id } });
  if (!dose) throw NotFound('Dose not found');
  if (!isAdminUser(user) && dose.userId !== user.id) throw NotFound('Dose not found');
  return dose;
}

export async function takeDose(user: AuthUser, id: string): Promise<any> {
  await assertDoseOwnership(user, id);
  const dose = await prisma.doseLog.update({
    where: { id },
    data: { status: 'taken', takenAt: new Date() },
  });
  // Verifica marcos de sequência e envia push de parabéns (assíncrono, não bloqueia).
  void checkStreakMilestone(user.id).catch(() => undefined);
  return serializeDoseLog(dose);
}

export async function skipDose(user: AuthUser, id: string): Promise<any> {
  await assertDoseOwnership(user, id);
  const dose = await prisma.doseLog.update({
    where: { id },
    data: { status: 'skipped', takenAt: null },
  });
  return serializeDoseLog(dose);
}

// Marca como missed as doses pending vencidas.
// - dias anteriores -> missed
// - hoje -> missed apenas após tolerância (120 min) do horário programado
// Não altera taken/skipped. `scopeUserId` limita a um usuário (opcional; o cron roda global).
export async function markMissedDoses(now = new Date(), scopeUserId?: string): Promise<number> {
  const today = todayStr(now);
  const pending = await prisma.doseLog.findMany({
    where: { status: 'pending', ...(scopeUserId ? { userId: scopeUserId } : {}) },
  });

  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const toMissIds: string[] = [];

  for (const d of pending) {
    if (!d.scheduledDate) continue;
    if (d.scheduledDate < today) {
      toMissIds.push(d.id);
    } else if (d.scheduledDate === today && d.scheduledTime) {
      const [dh, dm] = d.scheduledTime.split(':').map((n) => parseInt(n, 10));
      const doseMinutes = (dh || 0) * 60 + (dm || 0);
      if (nowMinutes - doseMinutes > GRACE_PERIOD_MINUTES) toMissIds.push(d.id);
    }
  }

  if (toMissIds.length) {
    await prisma.doseLog.updateMany({
      where: { id: { in: toMissIds } },
      data: { status: 'missed' },
    });
  }
  return toMissIds.length;
}

export interface Adherence {
  rate: number;
  taken: number;
  missed: number;
  skipped: number;
  pending: number;
  total: number;
}

export function computeAdherence(
  doses: Array<{ status: string }>,
): Adherence {
  const taken = doses.filter((d) => d.status === 'taken').length;
  const missed = doses.filter((d) => d.status === 'missed').length;
  const skipped = doses.filter((d) => d.status === 'skipped').length;
  const pending = doses.filter((d) => d.status === 'pending').length;
  const completed = taken + missed + skipped;
  const rate = completed > 0 ? Math.round((taken / completed) * 100) : 0;
  return { rate, taken, missed, skipped, pending, total: doses.length };
}

// Adesão do usuário numa janela de N dias (ou período custom from/to em YYYY-MM-DD).
export async function getAdherence(
  userId: string,
  opts: { days?: number; from?: string; to?: string },
): Promise<Adherence & { from: string; to: string }> {
  let from: string;
  let to: string;
  if (opts.from && opts.to) {
    from = opts.from;
    to = opts.to;
  } else {
    const days = opts.days && opts.days > 0 ? opts.days : 30;
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setUTCDate(fromDate.getUTCDate() - (days - 1));
    from = todayStr(fromDate);
    to = todayStr(toDate);
  }

  const doses = await prisma.doseLog.findMany({
    where: { userId, scheduledDate: { gte: from, lte: to } },
    select: { status: true },
  });
  return { ...computeAdherence(doses), from, to };
}

// ---------------------------------------------------------------------------
// Streak e parabéns via push
// ---------------------------------------------------------------------------

const STREAK_MILESTONES = [3, 7, 14, 21, 30, 60, 90, 180, 365];

// Calcula a sequência de dias aderentes do usuário (espelho da lógica do front).
// Um dia é aderente se tem pelo menos 1 dose tomada e 0 perdidas.
async function calcStreak(userId: string): Promise<number> {
  const doses = await prisma.doseLog.findMany({
    where: { userId },
    select: { scheduledDate: true, status: true },
  });

  const byDate: Record<string, { taken: number; missed: number }> = {};
  for (const d of doses) {
    byDate[d.scheduledDate] = byDate[d.scheduledDate] ?? { taken: 0, missed: 0 };
    if (d.status === 'taken') byDate[d.scheduledDate].taken += 1;
    if (d.status === 'missed') byDate[d.scheduledDate].missed += 1;
  }

  const today = todayStr();
  let streak = 0;
  const cursor = new Date(today + 'T00:00:00Z');

  for (let i = 0; i < 365; i++) {
    const dateStr = cursor.toISOString().split('T')[0];
    const day = byDate[dateStr];
    const isToday = dateStr === today;

    if (day) {
      if (day.missed > 0) break;
      if (day.taken > 0) streak++;
      else if (!isToday) break;
    } else if (!isToday) {
      break;
    }

    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return streak;
}

// Após marcar uma dose como tomada, verifica se o usuário atingiu um marco e
// envia um push de parabéns. Dispara de forma assíncrona (não bloqueia a resposta).
async function checkStreakMilestone(userId: string): Promise<void> {
  const { sendToUser, isPushConfigured } = await import('../push/push.service');
  if (!isPushConfigured()) return;

  const streak = await calcStreak(userId);
  if (!STREAK_MILESTONES.includes(streak)) return;

  const isBig = streak >= 30;
  const title = isBig
    ? `Incrível! ${streak} dias seguidos! 🏆`
    : `${streak} dias seguidos! 🔥`;
  const body = streak >= 30
    ? `Você é um exemplo de cuidado com a saúde. Continue assim!`
    : `Você está criando um ótimo hábito de adesão. Continue!`;

  await sendToUser(userId, { title, body, tag: `streak-${streak}`, url: '/dashboard' });
}
