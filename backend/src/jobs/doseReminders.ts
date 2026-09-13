import cron from 'node-cron';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { isPushConfigured, sendToUser } from '../modules/push/push.service';
import { todayStr } from '../modules/doses/dose.service';

// Envia lembretes push das doses do dia quando o horário chega.
// Regras:
//  - considera doses pending de hoje;
//  - dispara quando o horário programado já passou (até 30 min de atraso),
//    evitando spam de doses muito antigas (essas viram "missed" pelo outro cron);
//  - envia apenas uma vez (marca reminderSentAt).
const LATE_WINDOW_MINUTES = 30;

let task: cron.ScheduledTask | null = null;

// Retorna { date: 'YYYY-MM-DD', minutes } no fuso configurado (APP_TIMEZONE).
// Os horários das doses são digitados em hora LOCAL, então a comparação precisa
// ser feita no mesmo fuso — não em UTC.
function nowInAppTz(now: Date): { date: string; minutes: number } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: env.appTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  let hour = parseInt(parts.hour, 10);
  if (hour === 24) hour = 0; // alguns ambientes retornam 24 à meia-noite
  const minutes = hour * 60 + parseInt(parts.minute, 10);
  return { date, minutes };
}

export async function runDoseReminders(now = new Date()): Promise<number> {
  if (!isPushConfigured()) return 0;

  const { date: today, minutes: nowMinutes } = nowInAppTz(now);

  const pending = await prisma.doseLog.findMany({
    where: { status: 'pending', scheduledDate: today, reminderSentAt: null },
  });

  let notified = 0;
  for (const dose of pending) {
    if (!dose.scheduledTime) continue;
    const [h, m] = dose.scheduledTime.split(':').map((n) => parseInt(n, 10));
    const doseMinutes = (h || 0) * 60 + (m || 0);
    const delta = nowMinutes - doseMinutes; // minutos desde o horário programado
    if (delta < 0 || delta > LATE_WINDOW_MINUTES) continue;

    const sent = await sendToUser(dose.userId, {
      title: 'Nerva — hora do medicamento',
      body: dose.medicationName
        ? `Está na hora de tomar ${dose.medicationName} (${dose.scheduledTime}).`
        : `Está na hora de tomar seu medicamento (${dose.scheduledTime}).`,
      tag: `dose-${dose.id}`,
      url: '/dashboard',
      data: { doseId: dose.id },
    });

    // Marca como lembrado mesmo se não houver inscrição ativa, para não reprocessar.
    await prisma.doseLog.update({
      where: { id: dose.id },
      data: { reminderSentAt: now },
    });
    if (sent > 0) notified += 1;
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
