import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';
const API_KEY = process.env.ODDS_API_KEY;

interface OddsApiGame {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: Array<{
    key: string;
    title: string;
    markets: Array<{
      key: string;
      outcomes: Array<{ name: string; price: number }>;
    }>;
  }>;
}

// Map The Odds API sport keys to our slugs
const SPORT_MAP: Record<string, { name: string; slug: string }> = {
  'soccer_brazil_campeonato': { name: 'Futebol - Brasileirão', slug: 'brasileirao' },
  'soccer_uefa_champs_league': { name: 'Futebol - Champions League', slug: 'champions' },
  'soccer_brazil_copa_do_brasil': { name: 'Futebol - Copa do Brasil', slug: 'copa-brasil' },
  'basketball_nba': { name: 'Basquete - NBA', slug: 'nba' },
  'tennis_atp': { name: 'Tênis - ATP', slug: 'atp' },
  'americanfootball_nfl': { name: 'Futebol Americano - NFL', slug: 'nfl' },
  'mma_mixed_martial_arts': { name: 'MMA', slug: 'mma' },
};

async function fetchFromOddsApi(endpoint: string): Promise<any> {
  const url = `${ODDS_API_BASE}${endpoint}&apiKey=${API_KEY}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Odds API error: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

export async function fetchUpcomingGames(): Promise<void> {
  if (!API_KEY) {
    logger.warn('ODDS_API_KEY não configurado. Usando dados de demonstração.');
    await seedDemoGames();
    return;
  }

  try {
    for (const [sportKey, sportInfo] of Object.entries(SPORT_MAP)) {
      try {
        const games: OddsApiGame[] = await fetchFromOddsApi(
          `/sports/${sportKey}/odds?regions=eu&markets=h2h&oddsFormat=decimal`
        );

        // Ensure sport exists
        const sport = await prisma.sport.upsert({
          where: { slug: sportInfo.slug },
          create: { name: sportInfo.name, slug: sportInfo.slug },
          update: { name: sportInfo.name },
        });

        for (const g of games.slice(0, 10)) { // limit per sport
          const bookmaker = g.bookmakers[0];
          if (!bookmaker) continue;

          const h2h = bookmaker.markets.find((m) => m.key === 'h2h');
          if (!h2h) continue;

          const homeOutcome = h2h.outcomes.find((o) => o.name === g.home_team);
          const awayOutcome = h2h.outcomes.find((o) => o.name === g.away_team);
          const drawOutcome = h2h.outcomes.find((o) => o.name === 'Draw');

          // Upsert teams
          const [homeTeam, awayTeam] = await Promise.all([
            prisma.team.upsert({
              where: { id: g.home_team },
              create: { id: g.home_team, name: g.home_team },
              update: {},
            }).catch(() => prisma.team.create({ data: { name: g.home_team } })),
            prisma.team.upsert({
              where: { id: g.away_team },
              create: { id: g.away_team, name: g.away_team },
              update: {},
            }).catch(() => prisma.team.create({ data: { name: g.away_team } })),
          ]);

          // Upsert game
          await prisma.game.upsert({
            where: { externalId: g.id },
            create: {
              externalId: g.id,
              sportId: sport.id,
              homeTeamId: homeTeam.id,
              awayTeamId: awayTeam.id,
              startTime: new Date(g.commence_time),
              homeOdds: homeOutcome?.price,
              drawOdds: drawOutcome?.price,
              awayOdds: awayOutcome?.price,
              markets: {
                create: {
                  name: '1X2',
                  selections: {
                    create: [
                      { name: 'Home', odds: homeOutcome?.price || 2.0 },
                      ...(drawOutcome ? [{ name: 'Draw', odds: drawOutcome.price }] : []),
                      { name: 'Away', odds: awayOutcome?.price || 2.0 },
                    ],
                  },
                },
              },
            },
            update: {
              homeOdds: homeOutcome?.price,
              drawOdds: drawOutcome?.price,
              awayOdds: awayOutcome?.price,
              startTime: new Date(g.commence_time),
            },
          });
        }

        logger.info(`Synced ${games.length} games for ${sportInfo.name}`);
      } catch (err) {
        logger.error(`Failed to sync ${sportKey}:`, err);
      }
    }
  } catch (err) {
    logger.error('Failed to fetch upcoming games:', err);
    throw err;
  }
}

export async function fetchLiveOdds(): Promise<void> {
  if (!API_KEY) return;

  try {
    for (const [sportKey] of Object.entries(SPORT_MAP)) {
      try {
        const games: OddsApiGame[] = await fetchFromOddsApi(
          `/sports/${sportKey}/scores?daysFrom=1`
        );

        for (const g of games) {
          if (g.bookmakers?.length) {
            await prisma.game.updateMany({
              where: { externalId: g.id },
              data: { status: 'LIVE' },
            });
          }
        }
      } catch {
        // Silent fail per sport
      }
    }
  } catch (err) {
    logger.error('Failed to fetch live odds:', err);
  }
}

// Demo data for when API key is not configured
async function seedDemoGames(): Promise<void> {
  const existing = await prisma.game.count();
  if (existing > 0) return;

  logger.info('Seeding demo games...');

  const sport = await prisma.sport.upsert({
    where: { slug: 'futebol' },
    create: { name: 'Futebol', slug: 'futebol', icon: '⚽' },
    update: {},
  });

  const teams = [
    'Flamengo', 'Palmeiras', 'Corinthians', 'São Paulo', 'Santos',
    'Vasco', 'Botafogo', 'Fluminense', 'Grêmio', 'Internacional',
  ];

  for (const name of teams) {
    await prisma.team.upsert({
      where: { id: name.toLowerCase() },
      create: { id: name.toLowerCase(), name },
      update: {},
    }).catch(() => {});
  }

  const games = [
    { home: 'Flamengo', away: 'Palmeiras', hOdds: 2.10, dOdds: 3.20, aOdds: 3.50, hours: 2 },
    { home: 'Corinthians', away: 'São Paulo', hOdds: 2.40, dOdds: 3.10, aOdds: 2.80, hours: 4 },
    { home: 'Santos', away: 'Vasco', hOdds: 1.90, dOdds: 3.40, aOdds: 4.00, hours: 24 },
    { home: 'Botafogo', away: 'Fluminense', hOdds: 2.20, dOdds: 3.00, aOdds: 3.20, hours: 48 },
    { home: 'Grêmio', away: 'Internacional', hOdds: 2.60, dOdds: 3.00, aOdds: 2.60, hours: 72 },
  ];

  for (const g of games) {
    const homeTeam = await prisma.team.findFirst({ where: { name: g.home } });
    const awayTeam = await prisma.team.findFirst({ where: { name: g.away } });
    if (!homeTeam || !awayTeam) continue;

    await prisma.game.create({
      data: {
        sportId: sport.id,
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        startTime: new Date(Date.now() + g.hours * 3600 * 1000),
        homeOdds: g.hOdds,
        drawOdds: g.dOdds,
        awayOdds: g.aOdds,
        league: 'Brasileirão Série A',
        country: 'Brasil',
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

  logger.info('Demo games seeded successfully.');
}
