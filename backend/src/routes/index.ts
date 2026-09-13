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

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/users', usersRoutes);
router.use('/doses', doseRoutes);
router.use('/push', pushRoutes);

// Recursos genéricos por último (rota curinga /:resource).
router.use('/', resourceRoutes);

export default router;
