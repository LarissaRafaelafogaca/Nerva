import { env } from '../../config/env';

// Envia e-mail via Resend (se RESEND_API_KEY estiver configurado) ou loga no
// console em desenvolvimento. Nunca expõe dados sensíveis em produção.
async function sendMail(to: string, subject: string, text: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  if (apiKey) {
    // Usa o Resend (produção)
    const { Resend } = await import('resend');
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: process.env.MAIL_FROM || 'Nerva <onboarding@resend.dev>',
      to,
      subject,
      text,
    });
    return;
  }

  // Sem SMTP/Resend configurado: loga no console (desenvolvimento)
  if (!env.isProd) {
    // eslint-disable-next-line no-console
    console.log(`[MAIL:dev] to=${to} subject="${subject}"\n${text}`);
  }
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
