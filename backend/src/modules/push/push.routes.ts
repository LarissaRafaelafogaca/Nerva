import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import * as ctrl from './push.controller';
import { subscribeSchema, unsubscribeSchema } from './push.schema';

const router = Router();

// A chave pública pode ser lida sem autenticação (é pública por definição).
router.get('/public-key', asyncHandler(ctrl.getPublicKey));

router.use(requireAuth);
router.post('/subscribe', validate(subscribeSchema), asyncHandler(ctrl.subscribe));
router.post('/unsubscribe', validate(unsubscribeSchema), asyncHandler(ctrl.unsubscribe));
router.post('/test', asyncHandler(ctrl.test));

export default router;
