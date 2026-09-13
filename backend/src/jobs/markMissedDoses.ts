import cron from 'node-cron';
import { markMissedDoses } from '../modules/doses/dose.service';
import { env } from '../config/env';

// Executa a cada 15 minutos, marcando doses pending vencidas como missed.
// O timezone é configurável via APP_TIMEZONE (default UTC). A comparação de
// tolerância usa horas UTC, consistente com o armazenamento de datas.
let task: cron.ScheduledTask | null = null;

export function startMissedDoseJob(): void {
  if (task) return;
  task = cron.schedule(
    '*/15 * * * *',
    async () => {
      try {
        const count = await markMissedDoses(new Date());
        if (!env.isProd && count > 0) {
          // eslint-disable-next-line no-console
          console.log(`[cron] marked ${count} dose(s) as missed`);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[cron] markMissedDoses failed', err instanceof Error ? err.message : err);
      }
    },
    { timezone: env.appTimezone },
  );
}

export function stopMissedDoseJob(): void {
  if (task) {
    task.stop();
    task = null;
  }
}
