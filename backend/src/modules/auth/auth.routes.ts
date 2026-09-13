import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as ctrl from './auth.controller';
import {
  forgotPasswordSchema,
  googleTokenSchema,
  loginSchema,
  registerSchema,
  resendOtpSchema,
  resetPasswordSchema,
  updateMeSchema,
  verifyOtpSchema,
  verifyPinSchema,
} from './auth.schema';

const router = Router();

router.post('/register', validate(registerSchema), asyncHandler(ctrl.register));
router.post('/verify-otp', validate(verifyOtpSchema), asyncHandler(ctrl.verifyOtp));
router.post('/resend-otp', validate(resendOtpSchema), asyncHandler(ctrl.resendOtp));
router.post('/login', validate(loginSchema), asyncHandler(ctrl.login));
router.post('/google', validate(googleTokenSchema), asyncHandler(ctrl.googleToken));
router.get('/google', asyncHandler(ctrl.googleRedirect));
router.get('/google/callback', asyncHandler(ctrl.googleCallback));
router.post('/refresh', asyncHandler(ctrl.refresh));
router.post('/logout', asyncHandler(ctrl.logout));
router.post('/forgot-password', validate(forgotPasswordSchema), asyncHandler(ctrl.forgotPassword));
router.post('/reset-password', validate(resetPasswordSchema), asyncHandler(ctrl.resetPassword));
router.get('/me', requireAuth, asyncHandler(ctrl.me));
router.patch('/me', requireAuth, validate(updateMeSchema), asyncHandler(ctrl.updateMe));
router.post('/verify-pin', requireAuth, validate(verifyPinSchema), asyncHandler(ctrl.verifyPin));

export default router;
