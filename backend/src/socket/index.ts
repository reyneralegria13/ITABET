import { Server as HTTPServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { pollLiveFixtures, syncUpcomingFixtures } from '../services/liveDataService';

let io: SocketServer;

export function initSocket(httpServer: HTTPServer) {
  io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Auth middleware for socket
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (token) {
        const payload = verifyAccessToken(token);
        (socket as any).user = payload;
      }
    } catch {
      // Unauthenticated connections can still receive public data
    }
    next();
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user;
    logger.debug(`Socket connected: ${socket.id} ${user ? `(user: ${user.userId})` : '(guest)'}`);

    if (user) {
      socket.join(`user:${user.userId}`);
    }

    socket.on('subscribe:game', (gameId: string) => {
      socket.join(`game:${gameId}`);
    });

    socket.on('unsubscribe:game', (gameId: string) => {
      socket.leave(`game:${gameId}`);
    });

    socket.on('subscribe:sport', (sportSlug: string) => {
      socket.join(`sport:${sportSlug}`);
    });

    socket.on('disconnect', (reason) => {
      logger.debug(`Socket disconnected: ${socket.id} (${reason})`);
    });
  });

  startScheduler();

  logger.info('Socket.IO initialized');
  return io;
}

export function getIO(): SocketServer {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}

// ===================== SCHEDULER =====================

function startScheduler() {
  // --- Live polling: every 60 seconds ---
  // Uses API-Football if key present, otherwise falls back to DB broadcast
  setInterval(async () => {
    try {
      if (process.env.API_FOOTBALL_KEY) {
        await pollLiveFixtures();   // fetches API, updates DB, emits via socket
      } else {
        await broadcastFromDB();    // read DB state and emit (demo mode)
      }
    } catch (err) {
      logger.error('Live poll error:', err);
    }
  }, 60_000);

  // --- Upcoming fixtures sync: once at startup + every 6 hours ---
  const syncFixtures = async () => {
    try {
      if (process.env.API_FOOTBALL_KEY) {
        await syncUpcomingFixtures();
      }
    } catch (err) {
      logger.error('Fixture sync error:', err);
    }
  };

  syncFixtures();
  setInterval(syncFixtures, 6 * 60 * 60 * 1000); // 6h
}

/** Fallback: read live games from DB and broadcast (used without API key) */
async function broadcastFromDB() {
  const liveGames = await prisma.game.findMany({
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
  });

  for (const game of liveGames) {
    io.to(`game:${game.id}`).emit('game:update', {
      id:        game.id,
      homeScore: game.homeScore,
      awayScore: game.awayScore,
      minute:    game.minute,
      period:    game.period,
      status:    game.status,
      markets:   game.markets,
    });
  }

  if (liveGames.length > 0) {
    io.emit('live:games', liveGames.map(g => ({
      id:        g.id,
      homeTeam:  g.homeTeam.name,
      awayTeam:  g.awayTeam.name,
      homeScore: g.homeScore,
      awayScore: g.awayScore,
      minute:    g.minute,
      period:    g.period,
      sport:     g.sport.name,
    })));
  }
}

// ===================== EMIT HELPERS =====================

export function emitBalanceUpdate(userId: string, balance: number, bonusBalance: number) {
  if (io) io.to(`user:${userId}`).emit('balance:update', { balance, bonusBalance });
}

export function emitBetResult(userId: string, betId: string, status: string, actualWin: number) {
  if (io) io.to(`user:${userId}`).emit('bet:result', { betId, status, actualWin });
}

export function emitLiveEvent(gameId: string, event: {
  minute: string | number;
  team: string;
  player: string;
  type: string;
  detail: string;
  icon: string;
}) {
  if (io) io.to(`game:${gameId}`).emit('game:event', event);
}
