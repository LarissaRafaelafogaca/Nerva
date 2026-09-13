import { Request, Response } from 'express';
import * as service from './dose.service';
import { BadRequest } from '../../utils/errors';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function today(req: Request, res: Response): Promise<void> {
  const date = typeof req.query.date === 'string' && DATE_RE.test(req.query.date)
    ? req.query.date
    : service.todayStr();
  // Antes de retornar, garante integridade das doses vencidas.
  await service.markMissedDoses(new Date(), req.user!.id);
  const doses = await service.generateAndGetDoses(req.user!.id, date);
  res.json(doses);
}

export async function take(req: Request, res: Response): Promise<void> {
  const dose = await service.takeDose(req.user!, req.params.id);
  res.json(dose);
}

export async function skip(req: Request, res: Response): Promise<void> {
  const dose = await service.skipDose(req.user!, req.params.id);
  res.json(dose);
}

export async function adherence(req: Request, res: Response): Promise<void> {
  const days = req.query.days ? parseInt(String(req.query.days), 10) : undefined;
  const from = typeof req.query.from === 'string' ? req.query.from : undefined;
  const to = typeof req.query.to === 'string' ? req.query.to : undefined;
  if ((from && !DATE_RE.test(from)) || (to && !DATE_RE.test(to))) {
    throw BadRequest('from/to must be YYYY-MM-DD');
  }
  const result = await service.getAdherence(req.user!.id, { days, from, to });
  res.json(result);
}
