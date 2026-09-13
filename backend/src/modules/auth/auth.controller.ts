import { Request, Response } from 'express';
import { env } from '../../config/env';
import * as authService from './auth.service';

const REFRESH_COOKIE = 'refresh_token';

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 30,
    path: '/api/auth',
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
}

export async function register(req: Request, res: Response): Promise<void> {
  const result = await authService.register(req.body);
  res.status(201).json(result);
}

export async function verifyOtp(req: Request, res: Response): Promise<void> {
  const { access_token, refresh_token, user } = await authService.verifyOtp(req.body);
  setRefreshCookie(res, refresh_token);
  res.json({ access_token, refresh_token, user });
}

export async function resendOtp(req: Request, res: Response): Promise<void> {
  await authService.resendOtp(req.body.email);
  res.json({ ok: true });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { access_token, refresh_token, user } = await authService.login(req.body);
  setRefreshCookie(res, refresh_token);
  res.json({ access_token, refresh_token, user });
}

export async function googleToken(req: Request, res: Response): Promise<void> {
  const { access_token, refresh_token, user } = await authService.loginWithGoogleIdToken(req.body);
  setRefreshCookie(res, refresh_token);
  res.json({ access_token, refresh_token, user });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const token = req.body?.refresh_token ?? (req as any).cookies?.[REFRESH_COOKIE];
  const tokens = await authService.refresh(token ?? '');
  setRefreshCookie(res, tokens.refresh_token);
  res.json(tokens);
}

export async function logout(req: Request, res: Response): Promise<void> {
  const token = req.body?.refresh_token ?? (req as any).cookies?.[REFRESH_COOKIE];
  await authService.logout(token);
  clearRefreshCookie(res);
  res.json({ ok: true });
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  await authService.requestPasswordReset(req.body.email);
  // Sempre 200 para não permitir enumeração de contas.
  res.json({ ok: true });
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  await authService.resetPassword(req.body);
  res.json({ ok: true });
}

export async function me(req: Request, res: Response): Promise<void> {
  const user = await authService.getMe(req.user!.id);
  res.json(user);
}

export async function updateMe(req: Request, res: Response): Promise<void> {
  const user = await authService.updateMe(req.user!.id, req.body);
  res.json(user);
}

export async function verifyPin(req: Request, res: Response): Promise<void> {
  const ok = await authService.verifyPin(req.user!.id, String(req.body?.pin ?? ''));
  res.json({ ok });
}

// ----- Google OAuth por redirect (fluxo de página) -----

export async function googleRedirect(req: Request, res: Response): Promise<void> {
  if (!env.google.clientId) {
    res.redirect(`${env.frontendUrl}/login?error=google_not_configured`);
    return;
  }
  const returnTo = typeof req.query.returnTo === 'string' ? req.query.returnTo : '/';
  const params = new URLSearchParams({
    client_id: env.google.clientId,
    redirect_uri: env.google.callbackUrl,
    response_type: 'code',
    scope: 'openid email profile',
    state: Buffer.from(JSON.stringify({ returnTo })).toString('base64url'),
    access_type: 'offline',
    prompt: 'select_account',
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}

export async function googleCallback(req: Request, res: Response): Promise<void> {
  try {
    const code = String(req.query.code ?? '');
    const state = String(req.query.state ?? '');
    let returnTo = '/';
    try {
      returnTo = JSON.parse(Buffer.from(state, 'base64url').toString()).returnTo ?? '/';
    } catch {
      /* ignore */
    }

    const { access_token, refresh_token } = await authService.exchangeGoogleCode(code);
    setRefreshCookie(res, refresh_token);
    // Entrega o access token ao front-end via fragmento de URL segura.
    const redirect = new URL(env.frontendUrl + (returnTo.startsWith('/') ? returnTo : '/'));
    redirect.searchParams.set('access_token', access_token);
    res.redirect(redirect.toString());
  } catch {
    res.redirect(`${env.frontendUrl}/login?error=google_failed`);
  }
}
