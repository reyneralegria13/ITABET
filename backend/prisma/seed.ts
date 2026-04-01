import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...');

  // Admin user
  const adminPassword = await bcrypt.hash('Admin@123456', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@itabet.com' },
    update: {},
    create: {
      email: 'admin@itabet.com',
      username: 'admin',
      password: adminPassword,
      firstName: 'Admin',
      lastName: 'ITABET',
      cpf: '00000000000',
      birthDate: new Date('1990-01-01'),
      role: 'SUPER_ADMIN',
      emailVerified: true,
      balance: 0,
    },
  });

  // Demo user
  const userPassword = await bcrypt.hash('User@123456', 12);
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@itabet.com' },
    update: {},
    create: {
      email: 'demo@itabet.com',
      username: 'demouser',
      password: userPassword,
      firstName: 'João',
      lastName: 'Silva',
      cpf: '12345678901',
      birthDate: new Date('1995-06-15'),
      emailVerified: true,
      balance: 500.00,
      bonusBalance: 100.00,
    },
  });

  // Sports
  const sports = [
    { name: 'Futebol', slug: 'futebol', icon: '⚽' },
    { name: 'Basquete', slug: 'basquete', icon: '🏀' },
    { name: 'Tênis', slug: 'tenis', icon: '🎾' },
    { name: 'Futebol Americano', slug: 'nfl', icon: '🏈' },
    { name: 'MMA', slug: 'mma', icon: '🥊' },
    { name: 'E-Sports', slug: 'esports', icon: '🎮' },
  ];

  for (const sport of sports) {
    await prisma.sport.upsert({
      where: { slug: sport.slug },
      update: {},
      create: sport,
    });
  }

  // Teams
  const teams = [
    'Flamengo', 'Palmeiras', 'Corinthians', 'São Paulo', 'Santos',
    'Vasco', 'Botafogo', 'Fluminense', 'Grêmio', 'Internacional',
    'Athletico-PR', 'Cruzeiro', 'Atlético-MG', 'Bahia', 'Fortaleza',
  ];

  const teamMap: Record<string, string> = {};
  for (const name of teams) {
    const team = await prisma.team.create({ data: { name } });
    teamMap[name] = team.id;
  }

  const futebol = await prisma.sport.findUnique({ where: { slug: 'futebol' } });
  if (!futebol) throw new Error('Sport not found');

  // Sample games
  const gamesData = [
    {
      home: 'Flamengo', away: 'Palmeiras',
      hOdds: 2.10, dOdds: 3.20, aOdds: 3.50,
      hours: 2, league: 'Brasileirão Série A', status: 'LIVE' as const,
      homeScore: 1, awayScore: 0, minute: 65,
    },
    {
      home: 'Corinthians', away: 'São Paulo',
      hOdds: 2.40, dOdds: 3.10, aOdds: 2.80,
      hours: 6, league: 'Brasileirão Série A', status: 'SCHEDULED' as const,
    },
    {
      home: 'Santos', away: 'Vasco',
      hOdds: 1.90, dOdds: 3.40, aOdds: 4.00,
      hours: 24, league: 'Brasileirão Série A', status: 'SCHEDULED' as const,
    },
    {
      home: 'Botafogo', away: 'Fluminense',
      hOdds: 2.20, dOdds: 3.00, aOdds: 3.20,
      hours: 48, league: 'Brasileirão Série A', status: 'SCHEDULED' as const,
    },
    {
      home: 'Grêmio', away: 'Internacional',
      hOdds: 2.60, dOdds: 3.00, aOdds: 2.60,
      hours: 72, league: 'Copa do Brasil', status: 'SCHEDULED' as const,
    },
    {
      home: 'Athletico-PR', away: 'Cruzeiro',
      hOdds: 2.30, dOdds: 3.15, aOdds: 3.00,
      hours: 96, league: 'Copa do Brasil', status: 'SCHEDULED' as const,
    },
    {
      home: 'Atlético-MG', away: 'Bahia',
      hOdds: 1.75, dOdds: 3.50, aOdds: 4.50,
      hours: 120, league: 'Brasileirão Série A', status: 'SCHEDULED' as const,
    },
  ];

  for (const g of gamesData) {
    const existing = await prisma.game.findFirst({
      where: {
        homeTeamId: teamMap[g.home],
        awayTeamId: teamMap[g.away],
      },
    });
    if (existing) continue;

    await prisma.game.create({
      data: {
        sportId: futebol.id,
        homeTeamId: teamMap[g.home],
        awayTeamId: teamMap[g.away],
        startTime: new Date(Date.now() + g.hours * 3600 * 1000),
        homeOdds: g.hOdds,
        drawOdds: g.dOdds,
        awayOdds: g.aOdds,
        league: g.league,
        country: 'Brasil',
        status: g.status,
        homeScore: g.homeScore ?? null,
        awayScore: g.awayScore ?? null,
        minute: (g as any).minute ?? null,
        markets: {
          create: {
            name: '1X2',
            selections: {
              create: [
                { name: 'Home', odds: g.hOdds },
                { name: 'Draw', odds: g.dOdds },
                { name: 'Away', odds: g.aOdds },
              ],
            },
          },
        },
      },
    });
  }

  // Welcome promotion
  await prisma.promotion.upsert({
    where: { code: 'BEMBVINDO100' },
    update: {},
    create: {
      title: 'Bônus de Boas-vindas 100%',
      description: 'Deposite e ganhe 100% de bônus até R$ 500. Válido para novos usuários.',
      type: 'WELCOME_BONUS',
      value: 100,
      minDeposit: 50,
      maxBonus: 500,
      wagering: 5,
      code: 'BEMBVINDO100',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2025-12-31'),
      maxUses: 10000,
    },
  });

  console.log('✅ Seed concluído!');
  console.log(`👤 Admin: admin@itabet.com / Admin@123456`);
  console.log(`👤 Demo: demo@itabet.com / User@123456`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
