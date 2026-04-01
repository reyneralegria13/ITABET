import { Request, Response, NextFunction } from 'express';
import { rateLimit } from 'express-rate-limit';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

// Sanitize to prevent XSS / injection
export function sanitizeInput(req: Request, _res: Response, next: NextFunction) {
  const sanitize = (obj: any): any => {
    if (typeof obj === 'string') {
      // Remove script tags and dangerous chars
      return obj
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .trim();
    }
    if (typeof obj === 'object' && obj !== null) {
      for (const key of Object.keys(obj)) {
        // Prevent NoSQL injection style attacks ($ keys)
        if (key.startsWith('$') || key.includes('.')) {
          delete obj[key];
        } else {
          obj[key] = sanitize(obj[key]);
        }
      }
    }
    return obj;
  };

  req.body = sanitize(req.body);
  req.query = sanitize(req.query) as any;
  next();
}

// Auth-specific rate limiter (stricter)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
  keyGenerator: (req) => req.ip || 'unknown',
});

// Payment rate limiter
export const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: { error: 'Limite de transações atingido. Aguarde 1 hora.' },
});

// Bet rate limiter
export const betLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 30,
  message: { error: 'Muitas apostas em sequência. Aguarde 1 minuto.' },
});

// Log suspicious activity
export async function logAudit(
  userId: string | null,
  action: string,
  resource: string,
  resourceId: string | null,
  details: object,
  req: Request
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId ?? undefined,
        action,
        resource,
        resourceId,
        details: JSON.stringify(details),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });
  } catch (err) {
    logger.error('Failed to write audit log:', err);
  }
}

// Validate that request comes from expected origin
export function validateOrigin(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin || req.headers.referer;
  const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';

  if (origin && !origin.startsWith(allowedOrigin)) {
    logger.warn(`Blocked request from unexpected origin: ${origin}`);
    return res.status(403).json({ error: 'Origin não permitida.' });
  }
  next();
}
