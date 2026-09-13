import { Request, Response } from 'express';
import { env } from '../../config/env';
import * as pushService from './push.service';

// Chave pública VAPID (necessária no cliente para se inscrever).
export async function getPublicKey(_req: Request, res: Response): Promise<void> {
  res.json({ publicKey: env.vapid.publicKey, enabled: pushService.isPushConfigured() });
}

export async function subscribe(req: Request, res: Response): Promise<void> {
  await pushService.saveSubscription(req.user!.id, req.body, req.headers['user-agent']);
  res.status(201).json({ ok: true });
}

export async function unsubscribe(req: Request, res: Response): Promise<void> {
  await pushService.removeSubscription(req.user!.id, req.body.endpoint);
  res.json({ ok: true });
}

// Dispara uma notificação de teste imediata — usada para a demonstração do TCC.
// Se houver uma dose pendente hoje, anexa o doseId para que o botão "Tomei"
// também funcione a partir da notificação de teste.
export async function test(req: Request, res: Response): Promise<void> {
  const { prisma } = await import('../../config/database');
  const { todayStr } = await import('../doses/dose.service');
  const dose = await prisma.doseLog.findFirst({
    where: { userId: req.user!.id, scheduledDate: todayStr(), status: 'pending' },
    orderBy: { scheduledTime: 'asc' },
  });

  const sent = await pushService.sendToUser(req.user!.id, {
    title: 'Nerva — lembrete de teste',
    body: dose?.medicationName
      ? `Está na hora de tomar ${dose.medicationName} (teste).`
      : 'Está na hora de tomar seu medicamento (notificação de teste).',
    tag: dose ? `dose-${dose.id}` : 'nerva-test',
    url: '/dashboard',
    data: dose ? { doseId: dose.id } : {},
  });
  res.json({ ok: true, sent });
}
