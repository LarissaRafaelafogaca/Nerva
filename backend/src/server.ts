import { createApp } from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { startMissedDoseJob, stopMissedDoseJob } from './jobs/markMissedDoses';
import { startDoseReminderJob, stopDoseReminderJob } from './jobs/doseReminders';

async function main(): Promise<void> {
  await connectDatabase();

  const app = createApp();
  const server = app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Nerva backend rodando em http://localhost:${env.port} (env=${env.nodeEnv})`);
    // eslint-disable-next-line no-console
    console.log(`Docs: http://localhost:${env.port}/api/docs`);
  });

  startMissedDoseJob();
  startDoseReminderJob();

  const shutdown = async (signal: string) => {
    // eslint-disable-next-line no-console
    console.log(`\n${signal} recebido, encerrando...`);
    stopMissedDoseJob();
    stopDoseReminderJob();
    server.close();
    await disconnectDatabase();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Falha ao iniciar o servidor:', err);
  process.exit(1);
});
