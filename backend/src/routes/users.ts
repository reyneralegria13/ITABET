import { Router } from 'express';
import {
  getProfile, updateProfile, changePassword,
  getBetHistory, getTransactionHistory,
} from '../controllers/userController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/profile', getProfile);
router.patch('/profile', updateProfile);
router.patch('/change-password', changePassword);
router.get('/bets', getBetHistory);
router.get('/transactions', getTransactionHistory);

export default router;
