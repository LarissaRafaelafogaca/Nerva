import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'Password must contain a letter and a number');

export const registerSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
  full_name: z.string().trim().min(1).max(200).optional(),
  profile: z.enum(['patient', 'admin']).optional(),
});

export const verifyOtpSchema = z.object({
  email: z.string().email(),
  otpCode: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
});

export const resendOtpSchema = z.object({
  email: z.string().email(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const googleTokenSchema = z.object({
  // Fluxo alternativo: token de ID do Google enviado pelo cliente (One Tap).
  credential: z.string().min(10),
  profile: z.enum(['patient', 'admin']).optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  resetToken: z.string().min(10),
  newPassword: passwordSchema,
});

export const verifyPinSchema = z.object({
  pin: z.string().regex(/^\d{4,8}$/, 'PIN inválido'),
});

const preferencesSchema = z
  .object({
    notifications: z
      .object({
        enabled: z.boolean().optional(),
        sound: z.boolean().optional(),
        vibration: z.boolean().optional(),
      })
      .partial()
      .optional(),
    security: z
      .object({
        pinLock: z.boolean().optional(),
        pin: z.string().nullable().optional(),
        biometrics: z.boolean().optional(),
      })
      .partial()
      .optional(),
    privacy: z
      .object({
        dataCollection: z.boolean().optional(),
        dataSharing: z.boolean().optional(),
      })
      .partial()
      .optional(),
  })
  .partial();

export const updateMeSchema = z
  .object({
    full_name: z.string().trim().min(1).max(200).optional(),
    profile: z.enum(['patient', 'admin']).optional(),
    language: z.string().min(2).max(5).optional(),
    theme: z.enum(['light', 'dark']).optional(),
    preferences: preferencesSchema.optional(),
  })
  .strict();
