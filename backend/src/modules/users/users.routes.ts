import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/rbac';
import { asyncHandler } from '../../utils/asyncHandler';
import { prisma } from '../../config/database';
import { serializeUser } from '../../utils/serialize';

// O front-end usa base44.entities.User.list() apenas na tela de admin (Patients).
// Portanto listar usuários exige privilégio de admin.
const router = Router();

router.get(
  '/',
  requireAuth,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(users.map(serializeUser));
  }),
);

export default router;
