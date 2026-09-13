import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import * as ctrl from './resource.controller';

// Rotas genéricas para os recursos de domínio, compatíveis com o antigo SDK.
// :resource ∈ { medications, dose-logs, seizures, side-effects, sleep-records }
const router = Router();

router.use(requireAuth);

router.get('/:resource', asyncHandler(ctrl.list));
router.post('/:resource', asyncHandler(ctrl.create));
router.post('/:resource/bulk', asyncHandler(ctrl.bulkCreate));
router.patch('/:resource/bulk', asyncHandler(ctrl.bulkUpdate));
router.post('/:resource/delete-many', asyncHandler(ctrl.deleteMany));
router.patch('/:resource/:id', asyncHandler(ctrl.update));
router.delete('/:resource/:id', asyncHandler(ctrl.remove));

export default router;
