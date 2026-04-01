import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

// ===== DASHBOARD STATS =====
export async function getDashboardStats(req: Request, res: Response, next: NextFunction) {
  try {
    const [
      totalUsers,
      activeUsers,
      totalBets,
      pendingBets,
      totalDeposits,
      pendingWithdrawals,
      liveGames,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.bet.count(),
      prisma.bet.count({ where: { status: 'PENDING' } }),
      prisma.transaction.aggregate({
        where: { type: 'DEPOSIT', status: 'COMPLETED' },
        _sum: { amount: true },
      }),
      prisma.transaction.count({ where: { type: 'WITHDRAWAL', status: 'PENDING' } }),
      prisma.game.count({ where: { status: 'LIVE' } }),
    ]);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [todayBets, todayDeposits, todayNewUsers] = await Promise.all([
      prisma.bet.aggregate({
        where: { createdAt: { gte: todayStart } },
        _sum: { stake: true },
        _count: true,
      }),
      prisma.transaction.aggregate({
        where: { type: 'DEPOSIT', status: 'COMPLETED', createdAt: { gte: todayStart } },
        _sum: { amount: true },
      }),
      prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
    ]);

    res.json({
      totals: {
        users: totalUsers,
        activeUsers,
        bets: totalBets,
        pendingBets,
        depositsAmount: totalDeposits._sum.amount || 0,
        pendingWithdrawals,
        liveGames,
      },
      today: {
        betsCount: todayBets._count,
        betsAmount: todayBets._sum.stake || 0,
        depositsAmount: todayDeposits._sum.amount || 0,
        newUsers: todayNewUsers,
      },
    });
  } catch (err) { next(err); }
}

// ===== USER MANAGEMENT =====
export async function listUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;
    const search = req.query.search as string | undefined;

    const where: any = {};
    if (search) {
      where.OR = [
        { email: { contains: search } },
        { username: { contains: search } },
        { firstName: { contains: search } },
        { lastName: { contains: search } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true, email: true, username: true, firstName: true, lastName: true,
          role: true, status: true, balance: true, bonusBalance: true,
          createdAt: true, lastLoginAt: true,
          _count: { select: { bets: true, transactions: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ users, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
}

const updateUserStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'BANNED']),
  reason: z.string().optional(),
});

export async function updateUserStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { status, reason } = updateUserStatusSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.params.userId },
      data: { status: status as any },
      select: { id: true, email: true, status: true },
    });
    res.json({ message: `Usuário ${status === 'ACTIVE' ? 'ativado' : status === 'SUSPENDED' ? 'suspenso' : 'banido'}.`, user });
  } catch (err) { next(err); }
}

// ===== WITHDRAWAL MANAGEMENT =====
export async function getPendingWithdrawals(req: Request, res: Response, next: NextFunction) {
  try {
    const withdrawals = await prisma.transaction.findMany({
      where: { type: 'WITHDRAWAL', status: 'PENDING' },
      include: {
        user: { select: { id: true, email: true, username: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ withdrawals });
  } catch (err) { next(err); }
}

const processWithdrawalSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  reason: z.string().optional(),
});

export async function processWithdrawal(req: Request, res: Response, next: NextFunction) {
  try {
    const { action, reason } = processWithdrawalSchema.parse(req.body);
    const tx = await prisma.transaction.findUnique({ where: { id: req.params.txId } });

    if (!tx) throw new AppError('Transação não encontrada.', 404);
    if (tx.type !== 'WITHDRAWAL' || tx.status !== 'PENDING') {
      throw new AppError('Transação inválida para processamento.', 400);
    }

    if (action === 'APPROVE') {
      await prisma.transaction.update({
        where: { id: tx.id },
        data: { status: 'COMPLETED', processedAt: new Date() },
      });
      res.json({ message: 'Saque aprovado.' });
    } else {
      // Refund balance
      await prisma.$transaction([
        prisma.transaction.update({
          where: { id: tx.id },
          data: { status: 'CANCELLED', description: `Rejeitado: ${reason || 'Sem motivo'}` },
        }),
        prisma.user.update({
          where: { id: tx.userId },
          data: { balance: { increment: tx.amount } },
        }),
      ]);
      res.json({ message: 'Saque rejeitado e valor estornado.' });
    }
  } catch (err) { next(err); }
}

// ===== BET SETTLEMENT =====
export async function settleBets(req: Request, res: Response, next: NextFunction) {
  try {
    const { gameId, homeScore, awayScore } = z.object({
      gameId: z.string().uuid(),
      homeScore: z.number().int().min(0),
      awayScore: z.number().int().min(0),
    }).parse(req.body);

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        markets: { include: { selections: true } },
        bets: { include: { selections: { include: { selection: true } } } },
      },
    });

    if (!game) throw new AppError('Jogo não encontrado.', 404);

    // Determine results for each selection
    for (const market of game.markets) {
      for (const sel of market.selections) {
        let result: 'WIN' | 'LOSE' | 'VOID' = 'LOSE';

        if (market.name === '1X2') {
          if (sel.name === 'Home' && homeScore > awayScore) result = 'WIN';
          else if (sel.name === 'Draw' && homeScore === awayScore) result = 'WIN';
          else if (sel.name === 'Away' && awayScore > homeScore) result = 'WIN';
        }

        await prisma.selection.update({
          where: { id: sel.id },
          data: { result },
        });
      }
    }

    // Update game
    await prisma.game.update({
      where: { id: gameId },
      data: { status: 'FINISHED', homeScore, awayScore },
    });

    // Settle bets
    for (const bet of game.bets) {
      if (bet.status !== 'PENDING') continue;

      const allWon = bet.selections.every((bs) => bs.selection.result === 'WIN');
      const anyVoid = bet.selections.some((bs) => bs.selection.result === 'VOID');
      const status = anyVoid ? 'VOID' : allWon ? 'WON' : 'LOST';
      const actualWin = allWon ? bet.potentialWin : anyVoid ? bet.stake : 0;

      await prisma.$transaction([
        prisma.bet.update({
          where: { id: bet.id },
          data: { status: status as any, actualWin, settledAt: new Date() },
        }),
        ...(actualWin > 0
          ? [
              prisma.user.update({
                where: { id: bet.userId },
                data: { balance: { increment: actualWin } },
              }),
              prisma.transaction.create({
                data: {
                  userId: bet.userId,
                  type: status === 'VOID' ? 'BET_REFUND' : 'BET_WIN',
                  status: 'COMPLETED',
                  amount: actualWin,
                  netAmount: actualWin,
                  description: `${status === 'VOID' ? 'Reembolso' : 'Prêmio'} - aposta #${bet.id.slice(0, 8)}`,
                },
              }),
            ]
          : []),
      ]);
    }

    res.json({ message: `Jogo encerrado. ${game.bets.length} apostas liquidadas.` });
  } catch (err) { next(err); }
}
