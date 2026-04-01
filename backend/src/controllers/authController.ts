import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import {
  generateAccessToken,
  createRefreshToken,
  rotateRefreshToken,
  revokeAllUserTokens,
} from '../utils/jwt';
import { AppError } from '../middleware/errorHandler';
import { logAudit } from '../middleware/security';
import { logger } from '../utils/logger';

// ===== SCHEMAS =====
const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  username: z
    .string()
    .min(3, 'Username mínimo 3 caracteres')
    .max(20)
    .regex(/^[a-zA-Z0-9_]+$/, 'Username apenas letras, números e _'),
  password: z
    .string()
    .min(8, 'Senha mínimo 8 caracteres')
    .regex(/[A-Z]/, 'Senha deve ter ao menos uma letra maiúscula')
    .regex(/[0-9]/, 'Senha deve ter ao menos um número')
    .regex(/[^A-Za-z0-9]/, 'Senha deve ter ao menos um caractere especial'),
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  cpf: z.string().regex(/^\d{11}$/, 'CPF deve ter 11 dígitos (sem pontuação)'),
  phone: z.string().optional(),
  birthDate: z.string().refine((d) => {
    const date = new Date(d);
    const age = (Date.now() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    return age >= 18;
  }, 'Você deve ter ao menos 18 anos para se cadastrar'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// ===== HELPERS =====
function validateCPF(cpf: string): boolean {
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i]) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== parseInt(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i]) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  return rest === parseInt(cpf[10]);
}

// ===== CONTROLLERS =====

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const data = registerSchema.parse(req.body);

    if (!validateCPF(data.cpf)) {
      throw new AppError('CPF inválido.', 400);
    }

    // Check for existing user
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email: data.email }, { username: data.username }, { cpf: data.cpf }],
      },
    });

    if (existing) {
      if (existing.email === data.email) throw new AppError('Email já cadastrado.', 409);
      if (existing.username === data.username) throw new AppError('Username já em uso.', 409);
      if (existing.cpf === data.cpf) throw new AppError('CPF já cadastrado.', 409);
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        username: data.username,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        cpf: data.cpf,
        phone: data.phone,
        birthDate: new Date(data.birthDate),
      },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    await logAudit(user.id, 'REGISTER', 'users', user.id, { email: user.email }, req);

    logger.info(`New user registered: ${user.email}`);

    res.status(201).json({
      message: 'Conta criada com sucesso! Bem-vindo ao ITABET.',
      user,
    });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Timing-safe: always hash even if user doesn't exist
      await bcrypt.hash(password, 12);
      throw new AppError('Email ou senha incorretos.', 401);
    }

    // Check account lock
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new AppError(`Conta bloqueada. Tente novamente em ${minutes} minutos.`, 423);
    }

    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      const attempts = user.loginAttempts + 1;
      const updateData: any = { loginAttempts: attempts };

      // Lock after 5 failed attempts
      if (attempts >= 5) {
        updateData.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 min
        updateData.loginAttempts = 0;
      }

      await prisma.user.update({ where: { id: user.id }, data: updateData });
      await logAudit(user.id, 'LOGIN_FAILED', 'users', user.id, { attempts }, req);

      throw new AppError('Email ou senha incorretos.', 401);
    }

    if (user.status === 'BANNED') throw new AppError('Conta banida.', 403);
    if (user.status === 'SUSPENDED') throw new AppError('Conta suspensa. Entre em contato com o suporte.', 403);

    // Reset login attempts on success
    await prisma.user.update({
      where: { id: user.id },
      data: {
        loginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: req.ip,
      },
    });

    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshToken = await createRefreshToken(
      user.id,
      req.ip,
      req.headers['user-agent']
    );

    await logAudit(user.id, 'LOGIN_SUCCESS', 'users', user.id, {}, req);

    // Set refresh token as HTTP-only cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/api/auth/refresh',
    });

    res.json({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        balance: user.balance,
        bonusBalance: user.bonusBalance,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) throw new AppError('Refresh token não fornecido.', 401);

    const tokens = await rotateRefreshToken(token, req.ip, req.headers['user-agent']);

    if (!tokens) {
      res.clearCookie('refreshToken');
      throw new AppError('Sessão expirada. Faça login novamente.', 401);
    }

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/api/auth/refresh',
    });

    res.json({ accessToken: tokens.accessToken });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.refreshToken;

    if (token) {
      await prisma.refreshToken.updateMany({
        where: { token },
        data: { isRevoked: true },
      });
    }

    res.clearCookie('refreshToken');

    if (req.user) {
      await logAudit(req.user.userId, 'LOGOUT', 'users', req.user.userId, {}, req);
    }

    res.json({ message: 'Logout realizado com sucesso.' });
  } catch (err) {
    next(err);
  }
}

export async function logoutAll(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new AppError('Não autenticado.', 401);
    await revokeAllUserTokens(req.user.userId);
    res.clearCookie('refreshToken');
    res.json({ message: 'Todas as sessões encerradas.' });
  } catch (err) {
    next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new AppError('Não autenticado.', 401);

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        balance: true,
        bonusBalance: true,
        emailVerified: true,
        twoFactorEnabled: true,
        avatarUrl: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    if (!user) throw new AppError('Usuário não encontrado.', 404);

    res.json({ user });
  } catch (err) {
    next(err);
  }
}
