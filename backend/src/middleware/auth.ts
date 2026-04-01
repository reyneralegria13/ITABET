import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, JwtPayload } from '../utils/jwt';
import { prisma } from '../lib/prisma';
import { AppError } from './errorHandler';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload & { dbUser?: any };
    }
  }
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError('Token de acesso necessário.', 401);
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyAccessToken(token);

    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, role: true, status: true },
    });

    if (!user) throw new AppError('Usuário não encontrado.', 401);
    if (user.status !== 'ACTIVE') throw new AppError('Conta suspensa ou banida.', 403);

    req.user = { ...payload, dbUser: user };
    next();
  } catch (err: any) {
    if (err.name === 'JsonWebTokenError') {
      return next(new AppError('Token inválido.', 401));
    }
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Token expirado. Faça login novamente.', 401));
    }
    next(err);
  }
}

export function authorize(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Não autenticado.', 401));
    if (!roles.includes(req.user.role)) {
      return next(new AppError('Sem permissão para acessar este recurso.', 403));
    }
    next();
  };
}

// Optional auth — doesn't fail if no token
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      req.user = verifyAccessToken(token);
    }
  } catch {
    // Silently ignore
  }
  next();
}
