import { Request, Response } from 'express';
import { z } from 'zod';
import { RESOURCES } from './resource.registry';
import * as service from './resource.service';
import { BadRequest, NotFound, ValidationError } from '../../utils/errors';

function getConfig(req: Request) {
  const cfg = RESOURCES[req.params.resource];
  if (!cfg) throw NotFound('Unknown resource');
  return cfg;
}

function parseJsonParam(value: unknown): Record<string, any> | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'object') return value as Record<string, any>;
  try {
    return JSON.parse(String(value));
  } catch {
    throw BadRequest('Invalid JSON in query parameter');
  }
}

function validateBody(schema: z.ZodTypeAny, data: unknown) {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw ValidationError(
      'Invalid request data',
      result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  return result.data;
}

export async function list(req: Request, res: Response): Promise<void> {
  const cfg = getConfig(req);
  const sort = typeof req.query.sort === 'string' ? req.query.sort : undefined;
  const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
  const filter = parseJsonParam(req.query.filter);
  const rows = await service.list(cfg, req.user!, { sort, limit, filter });
  res.json(rows);
}

export async function create(req: Request, res: Response): Promise<void> {
  const cfg = getConfig(req);
  const data = validateBody(cfg.createSchema, req.body);
  const row = await service.create(cfg, req.user!, data);
  res.status(201).json(row);
}

export async function bulkCreate(req: Request, res: Response): Promise<void> {
  const cfg = getConfig(req);
  const arr = validateBody(z.array(cfg.createSchema).max(500), req.body);
  const rows = await service.bulkCreate(cfg, req.user!, arr);
  res.status(201).json(rows);
}

export async function bulkUpdate(req: Request, res: Response): Promise<void> {
  const cfg = getConfig(req);
  const itemSchema = (cfg.updateSchema as z.ZodObject<any>).extend
    ? (cfg.updateSchema as any).extend({ id: z.string().min(1) })
    : z.intersection(cfg.updateSchema, z.object({ id: z.string().min(1) }));
  const arr = validateBody(z.array(itemSchema).max(500), req.body);
  const rows = await service.bulkUpdate(cfg, req.user!, arr as any);
  res.json(rows);
}

export async function update(req: Request, res: Response): Promise<void> {
  const cfg = getConfig(req);
  const data = validateBody(cfg.updateSchema, req.body);
  const row = await service.update(cfg, req.user!, req.params.id, data);
  res.json(row);
}

export async function remove(req: Request, res: Response): Promise<void> {
  const cfg = getConfig(req);
  await service.remove(cfg, req.user!, req.params.id);
  res.json({ ok: true });
}

export async function deleteMany(req: Request, res: Response): Promise<void> {
  const cfg = getConfig(req);
  const filter = parseJsonParam(req.body?.filter ?? req.body) ?? {};
  const result = await service.deleteMany(cfg, req.user!, filter);
  res.json(result);
}
