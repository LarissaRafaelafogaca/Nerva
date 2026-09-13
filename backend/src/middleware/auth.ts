import { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../config/auth';
import { Unauthorized } from '../utils/errors';

export interface AuthUser {
  id: string;
  role: 'user' | 'admin';
  profile: 'patient' | 'admin';
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7).trim();
  // fallback para cookie de sessão
  const cookieToken = (req as any).cookies?.access_token;
  return cookieToken ?? null;
}

// Exige autenticação. Preenche req.user a partir do JWT (nunca de dados do corpo).
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) throw Unauthorized('Authentication required');
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role, profile: payload.profile };
    next();
  } catch {
    throw Unauthorized('Invalid or expired token');
  }
}

// Autenticação opcional: não falha se ausente.
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role, profile: payload.profile };
  } catch {
    // ignora token inválido no modo opcional
  }
  next();
}
