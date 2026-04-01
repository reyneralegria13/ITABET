import { Router } from 'express';
import { getLiveGames, getUpcomingGames, getGameById, getGameDetails, getSports } from '../controllers/gameController';

const router = Router();

router.get('/sports',       getSports);
router.get('/live',         getLiveGames);
router.get('/upcoming',     getUpcomingGames);
router.get('/:id',          getGameById);
router.get('/:id/details',  getGameDetails);  // stats + events + lineups + h2h

export default router;
