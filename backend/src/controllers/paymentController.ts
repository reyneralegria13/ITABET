import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import Stripe from 'stripe';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { logAudit } from '../middleware/security';
import { logger } from '../utils/logger';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16' as any,
});

const depositSchema = z.object({
  amount: z.number().min(20, 'Depósito mínimo: R$ 20,00').max(50000, 'Depósito máximo: R$ 50.000'),
  paymentMethod: z.enum(['CREDIT_CARD', 'PIX', 'BANK_TRANSFER']),
  paymentMethodId: z.string().optional(), // Stripe payment method ID
});

const withdrawSchema = z.object({
  amount: z.number().min(30, 'Saque mínimo: R$ 30,00').max(10000, 'Saque máximo: R$ 10.000'),
  pixKey: z.string().min(5, 'Chave PIX inválida'),
  pixKeyType: z.enum(['CPF', 'EMAIL', 'PHONE', 'RANDOM']),
});

// ===== DEPOSIT =====
export async function createDeposit(req: Request, res: Response, next: NextFunction) {
  try {
    const { amount, paymentMethod, paymentMethodId } = depositSchema.parse(req.body);
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true, lastName: true },
    });
    if (!user) throw new AppError('Usuário não encontrado.', 404);

    // Create pending transaction
    const transaction = await prisma.transaction.create({
      data: {
        userId,
        type: 'DEPOSIT',
        status: 'PENDING',
        amount,
        netAmount: amount,
        paymentMethod,
        description: `Depósito via ${paymentMethod}`,
      },
    });

    if (paymentMethod === 'CREDIT_CARD' && paymentMethodId) {
      // Process via Stripe
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(amount * 100), // centavos
          currency: 'brl',
          payment_method: paymentMethodId,
          confirm: true,
          automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
          metadata: {
            userId,
            transactionId: transaction.id,
          },
          description: `ITABET Depósito - ${user.firstName} ${user.lastName}`,
        });

        if (paymentIntent.status === 'succeeded') {
          await prisma.$transaction([
            prisma.transaction.update({
              where: { id: transaction.id },
              data: {
                status: 'COMPLETED',
                paymentId: paymentIntent.id,
                processedAt: new Date(),
              },
            }),
            prisma.user.update({
              where: { id: userId },
              data: { balance: { increment: amount } },
            }),
          ]);

          await logAudit(userId, 'DEPOSIT_COMPLETED', 'transactions', transaction.id, { amount }, req);

          const updatedUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { balance: true },
          });

          return res.json({
            message: 'Depósito realizado com sucesso!',
            transaction: { id: transaction.id, amount, status: 'COMPLETED' },
            balance: updatedUser?.balance,
          });
        }

        throw new AppError('Pagamento não confirmado. Tente novamente.', 400);
      } catch (stripeErr: any) {
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: { status: 'FAILED' },
        });
        throw new AppError(stripeErr.message || 'Erro no processamento do cartão.', 400);
      }
    }

    if (paymentMethod === 'PIX') {
      // Generate PIX QR Code (simulated - in production use a PIX provider)
      const pixCode = `00020126580014BR.GOV.BCB.PIX0136${userId}5204000053039865802BR5913ITABET6009SAO PAULO62290525${transaction.id}6304`;
      const qrCodeBase64 = Buffer.from(pixCode).toString('base64');

      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          pixKey: process.env.PIX_KEY || 'itabet@pagamentos.com',
          pixQrCode: qrCodeBase64,
        },
      });

      return res.json({
        message: 'PIX gerado! Escaneie o QR Code para completar o depósito.',
        transaction: {
          id: transaction.id,
          amount,
          status: 'PENDING',
          pix: {
            key: process.env.PIX_KEY || 'itabet@pagamentos.com',
            qrCode: qrCodeBase64,
            code: pixCode,
            expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min
          },
        },
      });
    }

    res.json({
      message: 'Solicitação de depósito criada.',
      transaction: { id: transaction.id, amount, status: 'PENDING' },
    });
  } catch (err) {
    next(err);
  }
}

// ===== WITHDRAW =====
export async function requestWithdrawal(req: Request, res: Response, next: NextFunction) {
  try {
    const { amount, pixKey, pixKeyType } = withdrawSchema.parse(req.body);
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true, status: true },
    });

    if (!user) throw new AppError('Usuário não encontrado.', 404);
    if (user.balance < amount) throw new AppError('Saldo insuficiente.', 400);

    // Check for pending withdrawals
    const pendingWithdrawals = await prisma.transaction.count({
      where: { userId, type: 'WITHDRAWAL', status: 'PENDING' },
    });

    if (pendingWithdrawals >= 3) {
      throw new AppError('Você já tem saques pendentes. Aguarde a aprovação.', 400);
    }

    // Deduct balance and create transaction
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { balance: { decrement: amount } },
      }),
      prisma.transaction.create({
        data: {
          userId,
          type: 'WITHDRAWAL',
          status: 'PENDING',
          amount,
          netAmount: amount,
          paymentMethod: 'PIX',
          pixKey,
          description: `Saque PIX - ${pixKeyType}: ${pixKey}`,
          metadata: JSON.stringify({ pixKeyType }),
        },
      }),
    ]);

    await logAudit(userId, 'WITHDRAWAL_REQUESTED', 'transactions', null, { amount, pixKeyType }, req);

    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true },
    });

    res.json({
      message: 'Solicitação de saque enviada! Será processada em até 24 horas.',
      balance: updatedUser?.balance,
    });
  } catch (err) {
    next(err);
  }
}

// ===== STRIPE WEBHOOK =====
export async function stripeWebhook(req: Request, res: Response, next: NextFunction) {
  const sig = req.headers['stripe-signature'] as string;

  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const { transactionId, userId } = pi.metadata;

        if (transactionId && userId) {
          const tx = await prisma.transaction.findUnique({ where: { id: transactionId } });
          if (tx && tx.status === 'PENDING') {
            await prisma.$transaction([
              prisma.transaction.update({
                where: { id: transactionId },
                data: { status: 'COMPLETED', paymentId: pi.id, processedAt: new Date() },
              }),
              prisma.user.update({
                where: { id: userId },
                data: { balance: { increment: tx.amount } },
              }),
            ]);
          }
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const { transactionId } = pi.metadata;
        if (transactionId) {
          await prisma.transaction.update({
            where: { id: transactionId },
            data: { status: 'FAILED' },
          });
        }
        break;
      }
    }

    res.json({ received: true });
  } catch (err: any) {
    logger.error('Stripe webhook error:', err);
    res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }
}

// ===== BALANCE =====
export async function getBalance(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { balance: true, bonusBalance: true },
    });
    if (!user) throw new AppError('Usuário não encontrado.', 404);
    res.json({ balance: user.balance, bonusBalance: user.bonusBalance });
  } catch (err) { next(err); }
}
