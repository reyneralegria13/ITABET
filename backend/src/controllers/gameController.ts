import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { fetchLiveOdds, fetchUpcomingGames } from '../services/oddsService';
import { getFixtureDetails, getH2H, getPlayerStats, syncUpcomingFixtures } from '../services/liveDataService';

export async function getLiveGames(req: Request, res: Response, next: NextFunction) {
  try {
    const games = await prisma.game.findMany({
      where: { status: 'LIVE' },
      include: {
        homeTeam: true,
        awayTeam: true,
        sport:    true,
        markets: {
          where:   { isActive: true },
          include: { selections: { where: { isActive: true } } },
        },
      },
      orderBy: { startTime: 'asc' },
    });
    res.json({ games });
  } catch (err) { next(err); }
}

export async function getUpcomingGames(req: Request, res: Response, next: NextFunction) {
  try {
    const sportSlug = req.query.sport as string | undefined;
    const page  = parseInt(req.query.page  as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const skip  = (page - 1) * limit;

    const where: any = {
      status: 'SCHEDULED',
      startTime: { gte: new Date() },
    };

    if (sportSlug) where.sport = { slug: sportSlug };

    const [games, total] = await Promise.all([
      prisma.game.findMany({
        where,
        include: {
          homeTeam: true,
          awayTeam: true,
          sport:    true,
          markets: {
            where:   { isActive: true },
            include: { selections: { where: { isActive: true } } },
          },
        },
        orderBy: { startTime: 'asc' },
        skip,
        take: limit,
      }),
      prisma.game.count({ where }),
    ]);

    res.json({ games, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
}

export async function getGameById(req: Request, res: Response, next: NextFunction) {
  try {
    const game = await prisma.game.findUnique({
      where:   { id: req.params.id },
      include: {
        homeTeam: true,
        awayTeam: true,
        sport:    true,
        markets: {
          where:   { isActive: true },
          include: { selections: { where: { isActive: true } } },
        },
      },
    });
    if (!game) throw new AppError('Jogo não encontrado.', 404);
    res.json({ game });
  } catch (err) { next(err); }
}

/**
 * Returns live stats + events + lineups for a game.
 * Calls API-Football if key is configured; returns null fields otherwise.
 */
export async function getGameDetails(req: Request, res: Response, next: NextFunction) {
  try {
    const game = await prisma.game.findUnique({
      where:   { id: req.params.id },
      include: { homeTeam: true, awayTeam: true },
    });
    if (!game) throw new AppError('Jogo não encontrado.', 404);

    // Fetch live details from API-Football if available
    const details = game.externalId
      ? await getFixtureDetails(game.externalId)
      : null;

    // Fetch H2H using team external IDs (stored as "apif_<id>")
    const homeExtId = game.homeTeam.id.replace('apif_', '');
    const awayExtId = game.awayTeam.id.replace('apif_', '');
    const h2h = (homeExtId !== game.homeTeam.id && awayExtId !== game.awayTeam.id)
      ? await getH2H(homeExtId, awayExtId)
      : [];

    // Player stats (only for live/finished games to save quota)
    const playerStats = (game.externalId && game.status !== 'SCHEDULED')
      ? await getPlayerStats(game.externalId)
      : [];

    res.json({
      stats:       details?.stats       ?? [],
      events:      details?.events      ?? [],
      lineups:     details?.lineups     ?? [],
      h2h,
      playerStats,
    });
  } catch (err) { next(err); }
}

export async function getSports(req: Request, res: Response, next: NextFunction) {
  try {
    const sports = await prisma.sport.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: { games: { where: { status: { in: ['SCHEDULED', 'LIVE'] } } } },
        },
      },
    });
    res.json({ sports });
  } catch (err) { next(err); }
}

export async function syncGames(req: Request, res: Response, next: NextFunction) {
  try {
    if (process.env.API_FOOTBALL_KEY) {
      const count = await syncUpcomingFixtures();
      res.json({ message: `${count} jogos sincronizados via API-Football.` });
    } else {
      await fetchUpcomingGames();
      await fetchLiveOdds();
      res.json({ message: 'Jogos de demonstração sincronizados.' });
    }
  } catch (err) { next(err); }
}
