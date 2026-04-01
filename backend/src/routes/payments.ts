import { Router, raw } from 'express';
import {
  createDeposit, requestWithdrawal, stripeWebhook, getBalance,
} from '../controllers/paymentController';
import { authenticate } from '../middleware/auth';
import { paymentLimiter } from '../middleware/security';

const router = Router();

// Stripe webhook needs raw body
router.post('/webhook/stripe', raw({ type: 'application/json' }), stripeWebhook);

router.use(authenticate);

router.get('/balance', getBalance);
router.post('/deposit', paymentLimiter, createDeposit);
router.post('/withdraw', paymentLimiter, requestWithdrawal);

export default router;
