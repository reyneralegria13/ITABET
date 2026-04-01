import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../lib/prisma';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  tokenVersion?: number;
}

export function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: (process.env.JWT_EXPIRES_IN || '15m') as any,
    issuer: 'itabet',
    audience: 'itabet-client',
  });
}

export function generateRefreshToken(): string {
  return uuidv4() + '-' + uuidv4();
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, process.env.JWT_SECRET!, {
    issuer: 'itabet',
    audience: 'itabet-client',
  }) as JwtPayload;
}

export async function createRefreshToken(
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<string> {
  const token = generateRefreshToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

  await prisma.refreshToken.create({
    data: {
      token,
      userId,
      expiresAt,
      ipAddress,
      userAgent,
    },
  });

  return token;
}

export async function rotateRefreshToken(
  oldToken: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ accessToken: string; refreshToken: string } | null> {
  const stored = await prisma.refreshToken.findUnique({
    where: { token: oldToken },
    include: { user: true },
  });

  if (!stored || stored.isRevoked || stored.expiresAt < new Date()) {
    // Potential token reuse — revoke all tokens for this user
    if (stored) {
      await prisma.refreshToken.updateMany({
        where: { userId: stored.userId },
        data: { isRevoked: true },
      });
    }
    return null;
  }

  // Revoke old token
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { isRevoked: true },
  });

  // Issue new tokens
  const newRefreshToken = await createRefreshToken(stored.userId, ipAddress, userAgent);
  const accessToken = generateAccessToken({
    userId: stored.user.id,
    email: stored.user.email,
    role: stored.user.role,
  });

  return { accessToken, refreshToken: newRefreshToken };
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId },
    data: { isRevoked: true },
  });
}
