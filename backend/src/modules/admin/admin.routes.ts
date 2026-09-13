import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/rbac';
import { asyncHandler } from '../../utils/asyncHandler';
import * as service from './admin.service';

// Todos os endpoints administrativos exigem auth + RBAC admin.
const router = Router();

router.use(requireAuth, requireAdmin);

router.get(
  '/patients',
  asyncHandler(async (_req, res) => {
    res.json(await service.listPatients());
  }),
);

router.get(
  '/patients/:id',
  asyncHandler(async (req, res) => {
    res.json(await service.getPatientDetail(req.params.id));
  }),
);

router.get(
  '/epidemiology',
  asyncHandler(async (_req, res) => {
    res.json(await service.getEpidemiology());
  }),
);

export default router;
