import { NextFunction, Request, Response } from 'express';
import { Forbidden, Unauthorized } from '../utils/errors';
import { isAdminEmail } from '../config/env';

export function isAdminUser(user?: { role?: string; profile?: string }): boolean {
  return user?.role === 'admin' || user?.profile === 'admin';
}

// role/profile são derivados do e-mail autorizado no login, não do JWT diretamente
export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) return next(Unauthorized('Authentication required'));
  if (!isAdminUser(req.user)) return next(Forbidden('Admin access required'));
  next();
}
