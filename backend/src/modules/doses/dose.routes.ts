import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import * as ctrl from './dose.controller';

const router = Router();

router.use(requireAuth);

router.get('/', asyncHandler(ctrl.today)); // GET /api/doses?date=YYYY-MM-DD
router.get('/adherence', asyncHandler(ctrl.adherence)); // ?days=30 | ?from=&to=
router.post('/:id/take', asyncHandler(ctrl.take));
router.post('/:id/skip', asyncHandler(ctrl.skip));

export default router;
