import argon2 from 'argon2';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../config/auth';
import { BadRequest, Conflict, Unauthorized } from '../../utils/errors';
import { serializeUser } from '../../utils/serialize';
import { sendOtpEmail, sendPasswordResetEmail } from './mailer';
import { isAdminEmail } from '../../config/env';

// role/profile derivados exclusivamente do ADMIN_EMAILS — nunca do cliente
function roleForEmail(email: string): { role: 'admin' | 'user'; profile: 'admin' | 'patient' } {
  return isAdminEmail(email)
    ? { role: 'admin', profile: 'admin' }
    : { role: 'user', profile: 'patient' };
}

const googleClient = env.google.clientId ? new OAuth2Client(env.google.clientId) : null;

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function generateOtp(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

function minutesFromNow(min: number): Date {
  return new Date(Date.now() + min * 60_000);
}

async function issueRefreshToken(userId: string): Promise<string> {
  const raw = crypto.randomBytes(48).toString('hex');
  const record = await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(raw),
      expiresAt: minutesFromNow(60 * 24 * 30),
    },
  });
  return signRefreshToken({ sub: userId, jti: record.id }) + '.' + raw;
}

function accessTokenFor(user: { id: string; role: any; profile: any }): string {
  return signAccessToken({ sub: user.id, role: user.role, profile: user.profile });
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

async function issueTokens(user: { id: string; role: any; profile: any }): Promise<AuthTokens> {
  return {
    access_token: accessTokenFor(user),
    refresh_token: await issueRefreshToken(user.id),
  };
}

export async function register(input: {
  email: string;
  password: string;
  full_name?: string;
  profile?: 'patient' | 'admin';
}): Promise<{ email: string }> {
  const email = input.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.emailVerified) throw Conflict('Email already registered');

  const passwordHash = await argon2.hash(input.password);
  const { role, profile } = roleForEmail(email);

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash, fullName: input.full_name ?? existing.fullName, role, profile },
      })
    : await prisma.user.create({
        data: {
          email,
          passwordHash,
          fullName: input.full_name,
          provider: 'local',
          role,
          profile,
          emailVerified:
            process.env.SKIP_EMAIL_VERIFICATION === 'true' ||
            (!process.env.SMTP_HOST && !process.env.RESEND_API_KEY),
        },
      });

  const hasEmail =
    !!(process.env.SMTP_HOST || process.env.RESEND_API_KEY) &&
    process.env.SKIP_EMAIL_VERIFICATION !== 'true';

  if (hasEmail && !user.emailVerified) {
    const devCode = await createAndSendOtp(user.id, email);
    const exposeDevCode = !env.isProd && !env.smtp.host;
    return { email, ...(exposeDevCode ? { dev_otp: devCode } : {}) };
  }

  if (!user.emailVerified) {
    await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });
  }
  return { email, auto_verified: true } as { email: string; auto_verified?: boolean };
}

async function createAndSendOtp(userId: string, email: string): Promise<string> {
  const code = generateOtp();
  await prisma.emailVerificationToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });
  await prisma.emailVerificationToken.create({
    data: { userId, codeHash: hashToken(code), expiresAt: minutesFromNow(env.otpExpiresMinutes) },
  });
  await sendOtpEmail(email, code);
  return code;
}

export async function resendOtp(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || user.emailVerified) return;
  await createAndSendOtp(user.id, user.email);
}

export async function verifyOtp(input: {
  email: string;
  otpCode: string;
}): Promise<AuthTokens & { user: any }> {
  const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (!user) throw BadRequest('Invalid verification code');

  const token = await prisma.emailVerificationToken.findFirst({
    where: { userId: user.id, usedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  if (!token || token.expiresAt < new Date()) throw BadRequest('Invalid or expired verification code');
  if (token.codeHash !== hashToken(input.otpCode)) throw BadRequest('Invalid verification code');

  await prisma.emailVerificationToken.update({ where: { id: token.id }, data: { usedAt: new Date() } });
  const updated = await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });
  return { ...(await issueTokens(updated)), user: serializeUser(updated) };
}

export async function login(input: { email: string; password: string }): Promise<AuthTokens & { user: any }> {
  const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (!user || !user.passwordHash) throw Unauthorized('Invalid credentials');

  const ok = await argon2.verify(user.passwordHash, input.password);
  if (!ok) throw Unauthorized('Invalid credentials');
  if (!user.emailVerified) throw Unauthorized('Email not verified');

  return { ...(await issueTokens(user)), user: serializeUser(user) };
}

export async function loginWithGoogleIdToken(input: {
  credential: string;
  profile?: 'patient' | 'admin';
}): Promise<AuthTokens & { user: any }> {
  if (!googleClient) throw BadRequest('Google login is not configured');
  const ticket = await googleClient.verifyIdToken({ idToken: input.credential, audience: env.google.clientId });
  const payload = ticket.getPayload();
  if (!payload?.email) throw Unauthorized('Invalid Google token');
  return upsertGoogleUser({ email: payload.email, providerId: payload.sub, fullName: payload.name, profile: input.profile });
}

export async function exchangeGoogleCode(code: string): Promise<AuthTokens & { user: any }> {
  if (!env.google.clientId || !env.google.clientSecret) throw BadRequest('Google login is not configured');
  const client = new OAuth2Client(env.google.clientId, env.google.clientSecret, env.google.callbackUrl);
  const { tokens } = await client.getToken(code);
  if (!tokens.id_token) throw Unauthorized('Google authentication failed');
  const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: env.google.clientId });
  const payload = ticket.getPayload();
  if (!payload?.email) throw Unauthorized('Invalid Google token');
  return upsertGoogleUser({ email: payload.email, providerId: payload.sub, fullName: payload.name });
}

export async function upsertGoogleUser(input: {
  email: string;
  providerId: string;
  fullName?: string | null;
  profile?: 'patient' | 'admin';
}): Promise<AuthTokens & { user: any }> {
  const email = input.email.toLowerCase();
  const { role, profile } = roleForEmail(email);
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: { email, fullName: input.fullName ?? undefined, provider: 'google', providerId: input.providerId, emailVerified: true, role, profile },
    });
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { provider: 'google', providerId: input.providerId, emailVerified: true, role, profile, fullName: user.fullName ?? input.fullName ?? undefined },
    });
  }
  return { ...(await issueTokens(user)), user: serializeUser(user) };
}

export async function refresh(rawToken: string): Promise<AuthTokens> {
  const parts = rawToken.split('.');
  const raw = parts.slice(3).join('.');
  const jwt = parts.slice(0, 3).join('.');

  let payload;
  try {
    payload = verifyRefreshToken(jwt);
  } catch {
    throw Unauthorized('Invalid refresh token');
  }

  const record = await prisma.refreshToken.findUnique({ where: { id: payload.jti } });
  if (!record || record.revokedAt || record.expiresAt < new Date()) {
    throw Unauthorized('Refresh token revoked or expired');
  }
  if (record.tokenHash !== hashToken(raw)) throw Unauthorized('Invalid refresh token');

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw Unauthorized('User not found');

  await prisma.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });
  return { access_token: accessTokenFor(user), refresh_token: await issueRefreshToken(user.id) };
}

export async function logout(rawToken?: string): Promise<void> {
  if (!rawToken) return;
  const parts = rawToken.split('.');
  const jwt = parts.slice(0, 3).join('.');
  try {
    const payload = verifyRefreshToken(jwt);
    await prisma.refreshToken.updateMany({
      where: { id: payload.jti, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  } catch {
    // invalid token — nothing to do
  }
}

export async function requestPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !user.passwordHash) return;
  const raw = crypto.randomBytes(32).toString('hex');
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash: hashToken(raw), expiresAt: minutesFromNow(env.passwordResetExpiresMinutes) },
  });
  await sendPasswordResetEmail(user.email, raw);
}

export async function resetPassword(input: { resetToken: string; newPassword: string }): Promise<void> {
  const record = await prisma.passwordResetToken.findFirst({
    where: { tokenHash: hashToken(input.resetToken), usedAt: null },
  });
  if (!record || record.expiresAt < new Date()) throw BadRequest('Invalid or expired reset token');

  const passwordHash = await argon2.hash(input.newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.refreshToken.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
}

export async function getMe(userId: string): Promise<any> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw Unauthorized('User not found');
  return serializeUser(user);
}

export async function reissueAccessToken(userId: string): Promise<{ access_token: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw Unauthorized('User not found');
  return { access_token: accessTokenFor(user) };
}

export async function verifyPin(userId: string, pin: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw Unauthorized('User not found');
  const prefs = (user.preferences ?? {}) as any;
  const hash = prefs?.security?.pin;
  if (!hash) return false;
  try {
    return await argon2.verify(String(hash), String(pin));
  } catch {
    return false;
  }
}

export async function updateMe(userId: string, input: any): Promise<any> {
  const current = await prisma.user.findUnique({ where: { id: userId } });
  if (!current) throw Unauthorized('User not found');

  const data: any = {};
  if (input.full_name !== undefined) data.fullName = input.full_name;
  if (input.language !== undefined) data.language = input.language;
  if (input.theme !== undefined) data.theme = input.theme;
  // `profile`/`role` NUNCA são definidos pelo cliente — sempre derivados do e-mail autorizado
  const { role, profile } = roleForEmail(current.email);
  data.role = role;
  data.profile = profile;

  if (input.preferences !== undefined) {
    data.preferences = await mergePreferences(current.preferences, input.preferences);
  }

  const updated = await prisma.user.update({ where: { id: userId }, data });
  return serializeUser(updated);
}

async function mergePreferences(existing: any, incoming: any): Promise<any> {
  const base = (existing && typeof existing === 'object' ? existing : {}) as any;
  const merged: any = {
    notifications: { ...(base.notifications ?? {}), ...(incoming.notifications ?? {}) },
    security: { ...(base.security ?? {}), ...(incoming.security ?? {}) },
    privacy: { ...(base.privacy ?? {}), ...(incoming.privacy ?? {}) },
  };

  const incomingPin = incoming?.security?.pin;
  if (incomingPin !== undefined) {
    if (incomingPin === null || incomingPin === '') {
      merged.security.pin = null;
    } else if (incomingPin === '__set__') {
      merged.security.pin = base.security?.pin ?? null;
    } else {
      merged.security.pin = await argon2.hash(String(incomingPin));
    }
  }
  return merged;
}
