import cron from 'node-cron';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { isPushConfigured, sendToUser } from '../modules/push/push.service';

// Envia lembretes push em 4 momentos por dose:
//   10 min ANTES  → aviso antecipado (reminderSentAt ainda null)
//   horário EXATO → alarme principal (marca reminderSentAt)
//    5 min DEPOIS → lembrete pós, se ainda pending
//   15 min DEPOIS → último lembrete, se ainda pending
// Cada janela tem uma tag única para não sobrescrever a anterior no dispositivo.

let task: cron.ScheduledTask | null = null;

function nowInAppTz(now: Date): { date: string; minutes: number } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: env.appTimezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  let hour = parseInt(parts.hour, 10);
  if (hour === 24) hour = 0;
  const minutes = hour * 60 + parseInt(parts.minute, 10);
  return { date, minutes };
}

export async function runDoseReminders(now = new Date()): Promise<number> {
  if (!isPushConfigured()) return 0;

  const { date: today, minutes: nowMinutes } = nowInAppTz(now);

  const allToday = await prisma.doseLog.findMany({
    where: { scheduledDate: today },
  });

  let notified = 0;

  for (const dose of allToday) {
    if (!dose.scheduledTime) continue;
    const [h, m] = dose.scheduledTime.split(':').map((n) => parseInt(n, 10));
    const doseMinutes = (h || 0) * 60 + (m || 0);
    const delta = nowMinutes - doseMinutes; // negativo = antes do horário

    // ── 1. Aviso antecipado: 10 min antes (delta entre -11 e -9) ──────────
    if (dose.status === 'pending' && dose.reminderSentAt === null) {
      if (delta >= -11 && delta <= -9) {
        await sendToUser(dose.userId, {
          title: '💊 Nerva — medicamento em 10 minutos',
          body: dose.medicationName
            ? `Faltam 10 minutos para tomar ${dose.medicationName} (${dose.scheduledTime}). Prepare-se!`
            : `Faltam 10 minutos para o seu medicamento das ${dose.scheduledTime}.`,
          tag: `dose-pre-${dose.id}`,
          url: '/dashboard',
          data: { doseId: dose.id },
        });
        notified += 1;
      }
    }

    // ── 2. Alarme principal: horário exato (delta entre 0 e 2) ───────────
    if (dose.status === 'pending' && dose.reminderSentAt === null) {
      if (delta >= 0 && delta <= 2) {
        const sent = await sendToUser(dose.userId, {
          title: '🔔 Nerva — hora do medicamento!',
          body: dose.medicationName
            ? `Está na hora de tomar ${dose.medicationName} (${dose.scheduledTime}). Confirme no app!`
            : `Está na hora do seu medicamento das ${dose.scheduledTime}. Confirme no app!`,
          tag: `dose-exact-${dose.id}`,
          url: '/dashboard',
          data: { doseId: dose.id },
        });
        // Marca reminderSentAt para controlar os lembretes pós
        await prisma.doseLog.update({
          where: { id: dose.id },
          data: { reminderSentAt: now },
        });
        if (sent > 0) notified += 1;
      }
    }

    // ── 3. Lembrete pós 5 min: só se já enviou o principal (delta 5-7) ───
    if (dose.status === 'pending' && dose.reminderSentAt !== null) {
      if (delta >= 5 && delta <= 7) {
        await sendToUser(dose.userId, {
          title: 'Nerva — você tomou seu medicamento?',
          body: dose.medicationName
            ? `Sua dose de ${dose.medicationName} das ${dose.scheduledTime} ainda não foi confirmada.`
            : `Sua dose das ${dose.scheduledTime} ainda não foi confirmada. Abra o Nerva.`,
          tag: `dose-post5-${dose.id}`,
          url: '/dashboard',
          data: { doseId: dose.id },
        });
        notified += 1;
      }
    }

    // ── 4. Lembrete final 15 min: só se ainda pending (delta 15-17) ──────
    if (dose.status === 'pending' && dose.reminderSentAt !== null) {
      if (delta >= 15 && delta <= 17) {
        await sendToUser(dose.userId, {
          title: 'Nerva — lembrete final',
          body: dose.medicationName
            ? `Última chamada: ${dose.medicationName} das ${dose.scheduledTime} aguarda confirmação.`
            : `Última chamada: medicamento das ${dose.scheduledTime} aguarda confirmação.`,
          tag: `dose-post15-${dose.id}`,
          url: '/dashboard',
          data: { doseId: dose.id },
        });
        notified += 1;
      }
    }
  }

  return notified;
}

export function startDoseReminderJob(): void {
  if (task) return;
  task = cron.schedule(
    '* * * * *', // a cada minuto
    async () => {
      try {
        const n = await runDoseReminders(new Date());
        if (!env.isProd && n > 0) {
          // eslint-disable-next-line no-console
          console.log(`[cron] ${n} lembrete(s) de dose enviado(s)`);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[cron] doseReminders falhou', err instanceof Error ? err.message : err);
      }
    },
    { timezone: env.appTimezone },
  );
}

export function stopDoseReminderJob(): void {
  if (task) {
    task.stop();
    task = null;
  }
}
