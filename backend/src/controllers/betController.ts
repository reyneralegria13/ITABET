import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { logAudit } from '../middleware/security';

const placeBetSchema = z.object({
  selections: z
    .array(
      z.object({
        selectionId: z.string().uuid(),
      })
    )
    .min(1)
    .max(20),
  stake: z.number().min(1, 'Aposta mínima: R$ 1,00').max(50000, 'Aposta máxima: R$ 50.000'),
  useBonus: z.boolean().default(false),
});

export async function placeBet(req: Request, res: Response, next: NextFunction) {
  try {
    const { selections, stake, useBonus } = placeBetSchema.parse(req.body);
    const userId = req.user!.userId;

    // Fetch user balance
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true, bonusBalance: true, status: true },
    });

    if (!user) throw new AppError('Usuário não encontrado.', 404);
    if (user.status !== 'ACTIVE') throw new AppError('Conta não está ativa.', 403);

    const availableBalance = useBonus ? user.bonusBalance : user.balance;
    if (availableBalance < stake) {
      throw new AppError('Saldo insuficiente.', 400);
    }

    // Fetch all selections with their market/game
    const selectionData = await prisma.selection.findMany({
      where: {
        id: { in: selections.map((s) => s.selectionId) },
        isActive: true,
      },
      include: {
        market: {
          include: {
            game: {
              select: { id: true, status: true, startTime: true },
            },
          },
        },
      },
    });

    if (selectionData.length !== selections.length) {
      throw new AppError('Uma ou mais seleções são inválidas ou inativas.', 400);
    }

    // Validate all games are available for betting
    for (const sel of selectionData) {
      if (sel.market.game.status === 'FINISHED' || sel.market.game.status === 'CANCELLED') {
        throw new AppError(`Jogo ${sel.market.game.id} já encerrado.`, 400);
      }
    }

    // Detect duplicate games in multiple bet
    const gameIds = selectionData.map((s) => s.market.game.id);
    const uniqueGames = new Set(gameIds);
    if (uniqueGames.size !== gameIds.length) {
      throw new AppError('Não é permitido apostas duplas no mesmo jogo.', 400);
    }

    // Calculate total odds
    const totalOdds = selectionData.reduce((acc, s) => acc * s.odds, 1);
    const potentialWin = parseFloat((stake * totalOdds).toFixed(2));
    const betType = selections.length === 1 ? 'SINGLE' : 'MULTIPLE';

    // Create bet and deduct balance atomically
    const bet = await prisma.$transaction(async (tx) => {
      // Deduct balance
      if (useBonus) {
        await tx.user.update({
          where: { id: userId },
          data: { bonusBalance: { decrement: stake } },
        });
      } else {
        await tx.user.update({
          where: { id: userId },
          data: { balance: { decrement: stake } },
        });
      }

      // Create transaction record
      await tx.transaction.create({
        data: {
          userId,
          type: 'BET_STAKE',
          status: 'COMPLETED',
          amount: stake,
          netAmount: -stake,
          description: `Aposta ${betType} - ${selectionData.map((s) => s.name).join(', ')}`,
        },
      });

      // Create bet
      const newBet = await tx.bet.create({
        data: {
          userId,
          gameId: selectionData[0].market.game.id,
          type: betType as any,
          stake,
          potentialWin,
          totalOdds,
          isBonus: useBonus,
          selections: {
            create: selectionData.map((sel) => ({
              selectionId: sel.id,
              oddsAtTime: sel.odds,
            })),
          },
        },
        include: {
          selections: {
            include: {
              selection: {
                include: {
                  market: { include: { game: { include: { homeTeam: true, awayTeam: true } } } },
                },
              },
            },
          },
        },
      });

      return newBet;
    });

    await logAudit(userId, 'BET_PLACED', 'bets', bet.id, { stake, totalOdds, potentialWin }, req);

    res.status(201).json({
      message: 'Aposta realizada com sucesso!',
      bet: {
        id: bet.id,
        type: bet.type,
        stake: bet.stake,
        totalOdds: bet.totalOdds,
        potentialWin: bet.potentialWin,
        status: bet.status,
        createdAt: bet.createdAt,
        selections: bet.selections.map((bs) => ({
          name: bs.selection.name,
          market: bs.selection.market.name,
          odds: bs.oddsAtTime,
          game: {
            homeTeam: bs.selection.market.game.homeTeam.name,
            awayTeam: bs.selection.market.game.awayTeam.name,
          },
        })),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getActiveBets(req: Request, res: Response, next: NextFunction) {
  try {
    const bets = await prisma.bet.findMany({
      where: { userId: req.user!.userId, status: 'PENDING' },
      include: {
        game: { include: { homeTeam: true, awayTeam: true, sport: true } },
        selections: { include: { selection: { include: { market: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ bets });
  } catch (err) { next(err); }
}

export async function getBetById(req: Request, res: Response, next: NextFunction) {
  try {
    const bet = await prisma.bet.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
      include: {
        game: { include: { homeTeam: true, awayTeam: true, sport: true } },
        selections: { include: { selection: { include: { market: true } } } },
      },
    });
    if (!bet) throw new AppError('Aposta não encontrada.', 404);
    res.json({ bet });
  } catch (err) { next(err); }
}
