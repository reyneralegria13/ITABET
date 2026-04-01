import { Router } from 'express';
import { placeBet, getActiveBets, getBetById } from '../controllers/betController';
import { authenticate } from '../middleware/auth';
import { betLimiter } from '../middleware/security';

const router = Router();

router.use(authenticate);

router.post('/', betLimiter, placeBet);
router.get('/active', getActiveBets);
router.get('/:id', getBetById);

export default router;
