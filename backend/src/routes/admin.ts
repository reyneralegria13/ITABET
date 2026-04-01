import { Router } from 'express';
import {
  getDashboardStats, listUsers, updateUserStatus,
  getPendingWithdrawals, processWithdrawal, settleBets,
} from '../controllers/adminController';
import { authenticate, authorize } from '../middleware/auth';
import { syncGames } from '../controllers/gameController';

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN', 'SUPER_ADMIN'));

router.get('/stats', getDashboardStats);
router.get('/users', listUsers);
router.patch('/users/:userId/status', updateUserStatus);
router.get('/withdrawals/pending', getPendingWithdrawals);
router.patch('/withdrawals/:txId', processWithdrawal);
router.post('/games/settle', settleBets);
router.post('/games/sync', syncGames);

export default router;
