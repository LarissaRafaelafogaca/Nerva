import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../../config/env';

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!env.smtp.host) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.password } : undefined,
    });
  }
  return transporter;
}

// Envia e-mail. Se SMTP não estiver configurado (dev), apenas registra no console
// SEM expor dados sensíveis em produção.
export async function sendMail(to: string, subject: string, text: string): Promise<void> {
  const t = getTransporter();
  if (!t) {
    if (!env.isProd) {
      // eslint-disable-next-line no-console
      console.log(`[MAIL:dev] to=${to} subject="${subject}"\n${text}`);
    }
    return;
  }
  await t.sendMail({ from: env.smtp.from, to, subject, text });
}

export async function sendOtpEmail(to: string, code: string): Promise<void> {
  await sendMail(
    to,
    'Nerva — código de verificação',
    `Seu código de verificação é: ${code}\nEle expira em ${env.otpExpiresMinutes} minutos.`,
  );
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const link = `${env.frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;
  await sendMail(
    to,
    'Nerva — redefinição de senha',
    `Para redefinir sua senha, acesse: ${link}\nO link expira em ${env.passwordResetExpiresMinutes} minutos. Se você não solicitou, ignore este e-mail.`,
  );
}
