import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes';
import resourceRoutes from '../modules/resources/resource.routes';
import doseRoutes from '../modules/doses/dose.routes';
import adminRoutes from '../modules/admin/admin.routes';
import usersRoutes from '../modules/users/users.routes';
import pushRoutes from '../modules/push/push.routes';

const router = Router();

// Configurações públicas do app (compat. com base44.app.getPublicSettings()).
router.get('/app/public-settings', (_req, res) => {
  res.json({
    id: 'nerva',
    public_settings: {
      name: 'Nerva',
      requiresAuth: true,
      languages: ['en', 'pt', 'es', 'it', 'fr', 'ko', 'ja'],
    },
  });
});

router.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Diagnóstico de fuso horário — útil para verificar APP_TIMEZONE no Railway
router.get('/tz-check', (_req, res) => {
  const tz = process.env.APP_TIMEZONE || 'UTC';
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  res.json({
    APP_TIMEZONE: tz,
    utc_now: now.toISOString(),
    local_now: `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`,
  });
});

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/users', usersRoutes);
router.use('/doses', doseRoutes);
router.use('/push', pushRoutes);

// Recursos genéricos por último (rota curinga /:resource).
router.use('/', resourceRoutes);

export default router;
