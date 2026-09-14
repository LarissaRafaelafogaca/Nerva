import { NextFunction, Request, Response } from 'express';
import { Forbidden, Unauthorized } from '../utils/errors';
import { isAdminEmail } from '../config/env';

// Admin = role admin OU profile admin (usado no RLS dono-ou-admin dos recursos).
export function isAdminUser(user?: { role?: string; profile?: string }): boolean {
  return user?.role === 'admin' || user?.profile === 'admin';
}

// Guarda dos endpoints administrativos: verifica o JWT (role/profile) que já
// foi derivado do e-mail autorizado no momento do login. Mais eficiente que
// uma query extra ao banco a cada requisição.
export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) return next(Unauthorized('Authentication required'));
  if (!isAdminUser(req.user)) return next(Forbidden('Admin access required'));
  next();
}
