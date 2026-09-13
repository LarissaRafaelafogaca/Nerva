import { NextFunction, Request, Response } from 'express';
import { Forbidden, Unauthorized } from '../utils/errors';
import { prisma } from '../config/database';
import { isAdminEmail } from '../config/env';

// Admin = role admin OU profile admin (usado no RLS dono-ou-admin dos recursos).
// O papel no JWT já é derivado do e-mail autorizado no momento do login.
export function isAdminUser(user?: { role?: string; profile?: string }): boolean {
  return user?.role === 'admin' || user?.profile === 'admin';
}

// Guarda dos endpoints administrativos: autoritativo. Confirma no banco que o
// e-mail do usuário está na lista de administradores autorizados. Assim, mesmo
// registros antigos com role=admin não obtêm acesso se o e-mail não for autorizado.
export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) return next(Unauthorized('Authentication required'));
  prisma.user
    .findUnique({ where: { id: req.user.id }, select: { email: true } })
    .then((user) => {
      if (!user || !isAdminEmail(user.email)) return next(Forbidden('Admin access required'));
      next();
    })
    .catch(next);
}
