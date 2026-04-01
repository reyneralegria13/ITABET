/**
 * API-Football Live Data Service
 * Docs: https://www.api-football.com/documentation-v3
 * Free tier: 100 req/day via RapidAPI
 * Get key at: https://rapidapi.com/api-sports/api/api-football
 */

import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { getIO } from '../socket';

const BASE_URL = 'https://v3.football.api-sports.io';
const RAPIDAPI_HOST = 'v3.football.api-sports.io';
const API_KEY = process.env.API_FOOTBALL_KEY;

// League IDs for API-Football
const LEAGUE_IDS = {
  brasileirao_a:   71,
  brasileirao_b:   72,
  copa_brasil:     73,
  libertadores:    13,
  sul_americana:   11,
  champions:        2,
  premier_league:  39,
  laliga:          140,
  bundesliga:       78,
  serie_a:         135,
  ligue1:           61,
};

// ===================== TYPES =====================

interface APIFootballFixture {
  fixture: {
    id:        number;
    date:      string;
    status:    { long: string; short: string; elapsed: number | null };
    venue:     { name: string; city: string };
  };
  league: {
    id:      number;
    name:    string;
    country: string;
    logo:    string;
    round:   string;
  };
  teams: {
    home: { id: number; name: string; logo: string; winner: boolean | null };
    away: { id: number; name: string; logo: string; winner: boolean | null };
  };
  goals: { home: number | null; away: number | null };
  score: {
    halftime:  { home: number | null; away: number | null };
    fulltime:  { home: number | null; away: number | null };
    extratime: { home: number | null; away: number | null };
    penalty:   { home: number | null; away: number | null };
  };
}

interface APIFootballStats {
  team: { id: number; name: string };
  statistics: Array<{ type: string; value: string | number | null }>;
}

interface APIFootballEvent {
  time:    { elapsed: number; extra: number | null };
  team:    { id: number; name: string };
  player:  { id: number; name: string };
  assist:  { id: number | null; name: string | null };
  type:    string; // "Goal" | "Card" | "subst" | "Var"
  detail:  string; // "Normal Goal" | "Yellow Card" | "Red Card" | "Substitution 1" etc.
  comments: string | null;
}

interface APIFootballLineup {
  team:         { id: number; name: string; logo: string; colors: any };
  coach:        { id: number; name: string; photo: string };
  formation:    string;
  startXI:      Array<{ player: { id: number; name: string; number: number; pos: string; grid: string } }>;
  substitutes:  Array<{ player: { id: number; name: string; number: number; pos: string; grid: string | null } }>;
}

// ===================== FETCH HELPERS =====================

async function apiFetch(path: string): Promise<any> {
  if (!API_KEY) throw new Error('API_FOOTBALL_KEY not configured');

  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'x-rapidapi-key':  API_KEY,
      'x-rapidapi-host': RAPIDAPI_HOST,
    },
  });

  if (!res.ok) throw new Error(`API-Football ${res.status}: ${path}`);

  const json = await res.json() as any;

  if (json.errors && Object.keys(json.errors).length > 0) {
    throw new Error(`API-Football error: ${JSON.stringify(json.errors)}`);
  }

  return json.response;
}

// ===================== PUBLIC FUNCTIONS =====================

/**
 * Fetch upcoming fixtures for Brazilian leagues and store them.
 * Call once daily (stays within free-tier limits).
 */
export async function syncUpcomingFixtures(): Promise<number> {
  if (!API_KEY) {
    logger.warn('API_FOOTBALL_KEY not set — skipping live fixture sync');
    return 0;
  }

  let synced = 0;
  const leagueIds = Object.values(LEAGUE_IDS);
  const season = new Date().getFullYear();

  for (const leagueId of leagueIds) {
    try {
      const fixtures: APIFootballFixture[] = await apiFetch(
        `/fixtures?league=${leagueId}&season=${season}&status=NS&next=10`
      );

      for (const f of fixtures) {
        await upsertFixture(f);
        synced++;
      }

      // Respect rate limit
      await sleep(200);
    } catch (err) {
      logger.error(`syncUpcomingFixtures league ${leagueId}:`, err);
    }
  }

  logger.info(`Synced ${synced} upcoming fixtures from API-Football`);
  return synced;
}

/**
 * Fetch ALL live fixtures right now. Broadcast via Socket.IO.
 * Call every 60 seconds during match hours.
 */
export async function pollLiveFixtures(): Promise<void> {
  if (!API_KEY) return;

  try {
    const fixtures: APIFootballFixture[] = await apiFetch('/fixtures?live=all');

    if (!fixtures.length) {
      logger.debug('No live fixtures at this moment');
      return;
    }

    const io = getIO();
    const liveUpdates: any[] = [];

    for (const f of fixtures) {
      const fixtureId = String(f.fixture.id);
      const game = await prisma.game.findFirst({ where: { externalId: fixtureId } });

      if (!game) continue;

      const elapsed = f.fixture.status.elapsed;
      const period  = mapPeriod(f.fixture.status.short);

      // Update DB
      await prisma.game.update({
        where: { id: game.id },
        data:  {
          status:    'LIVE',
          homeScore: f.goals.home ?? 0,
          awayScore: f.goals.away ?? 0,
          minute:    elapsed,
          period,
        },
      });

      liveUpdates.push({
        id:        game.id,
        homeTeam:  f.teams.home.name,
        awayTeam:  f.teams.away.name,
        homeScore: f.goals.home ?? 0,
        awayScore: f.goals.away ?? 0,
        minute:    elapsed,
        period,
        sport:     'Futebol',
      });

      // Emit per-game update
      io.to(`game:${game.id}`).emit('game:update', {
        id:        game.id,
        homeScore: f.goals.home ?? 0,
        awayScore: f.goals.away ?? 0,
        minute:    elapsed,
        period,
        status:    'LIVE',
      });
    }

    // Emit live games list to all clients
    if (liveUpdates.length > 0) {
      io.emit('live:games', liveUpdates);
    }

    // Mark finished games
    await markFinishedGames(fixtures);

  } catch (err) {
    logger.error('pollLiveFixtures error:', err);
  }
}

/**
 * Get detailed stats + events + lineups for one fixture.
 * Returns data for immediate API response (not stored).
 */
export async function getFixtureDetails(externalId: string): Promise<{
  stats:    any[];
  events:   any[];
  lineups:  any[];
} | null> {
  if (!API_KEY) return null;

  try {
    const [statsRaw, eventsRaw, lineupsRaw] = await Promise.all([
      apiFetch(`/fixtures/statistics?fixture=${externalId}`),
      apiFetch(`/fixtures/events?fixture=${externalId}`),
      apiFetch(`/fixtures/lineups?fixture=${externalId}`),
    ]);

    const stats   = normalizeStats(statsRaw);
    const events  = normalizeEvents(eventsRaw);
    const lineups = normalizeLineups(lineupsRaw);

    return { stats, events, lineups };
  } catch (err) {
    logger.error(`getFixtureDetails ${externalId}:`, err);
    return null;
  }
}

/**
 * Get head-to-head stats for two teams.
 */
export async function getH2H(team1Id: string, team2Id: string): Promise<any[]> {
  if (!API_KEY) return [];
  try {
    const data = await apiFetch(`/fixtures/headtohead?h2h=${team1Id}-${team2Id}&last=5`);
    return (data as APIFootballFixture[]).map(f => ({
      date:      f.fixture.date,
      league:    f.league.name,
      homeTeam:  f.teams.home.name,
      awayTeam:  f.teams.away.name,
      homeScore: f.goals.home,
      awayScore: f.goals.away,
      winner:    f.teams.home.winner === true ? f.teams.home.name
                 : f.teams.away.winner === true ? f.teams.away.name
                 : 'Empate',
    }));
  } catch (err) {
    logger.error('getH2H error:', err);
    return [];
  }
}

/**
 * Get player stats for a fixture (top performers).
 */
export async function getPlayerStats(externalId: string): Promise<any[]> {
  if (!API_KEY) return [];
  try {
    const data = await apiFetch(`/fixtures/players?fixture=${externalId}`);
    return (data as any[]).flatMap((team: any) =>
      team.players.map((p: any) => ({
        team:    team.team.name,
        name:    p.player.name,
        photo:   p.player.photo,
        rating:  p.statistics[0]?.games?.rating ?? null,
        goals:   p.statistics[0]?.goals?.total ?? 0,
        assists: p.statistics[0]?.goals?.assists ?? 0,
        shots:   p.statistics[0]?.shots?.total ?? 0,
        passes:  p.statistics[0]?.passes?.total ?? 0,
        tackles: p.statistics[0]?.tackles?.total ?? 0,
        yellow:  p.statistics[0]?.cards?.yellow ?? 0,
        red:     p.statistics[0]?.cards?.red ?? 0,
      }))
    );
  } catch (err) {
    logger.error('getPlayerStats error:', err);
    return [];
  }
}

// ===================== PRIVATE HELPERS =====================

async function upsertFixture(f: APIFootballFixture): Promise<void> {
  const fixtureId = String(f.fixture.id);

  // Upsert sport
  const sport = await prisma.sport.upsert({
    where:  { slug: 'futebol' },
    create: { name: 'Futebol', slug: 'futebol', icon: '⚽' },
    update: {},
  });

  // Upsert teams
  const [homeTeam, awayTeam] = await Promise.all([
    prisma.team.upsert({
      where:  { id: `apif_${f.teams.home.id}` },
      create: { id: `apif_${f.teams.home.id}`, name: f.teams.home.name, logo: f.teams.home.logo, country: f.league.country },
      update: { name: f.teams.home.name, logo: f.teams.home.logo },
    }),
    prisma.team.upsert({
      where:  { id: `apif_${f.teams.away.id}` },
      create: { id: `apif_${f.teams.away.id}`, name: f.teams.away.name, logo: f.teams.away.logo, country: f.league.country },
      update: { name: f.teams.away.name, logo: f.teams.away.logo },
    }),
  ]);

  // Upsert game
  const existing = await prisma.game.findUnique({ where: { externalId: fixtureId } });

  if (!existing) {
    await prisma.game.create({
      data: {
        externalId:  fixtureId,
        sportId:     sport.id,
        homeTeamId:  homeTeam.id,
        awayTeamId:  awayTeam.id,
        startTime:   new Date(f.fixture.date),
        status:      mapStatus(f.fixture.status.short),
        homeScore:   f.goals.home ?? null,
        awayScore:   f.goals.away ?? null,
        league:      f.league.name,
        country:     f.league.country,
        markets: {
          create: {
            name: '1X2',
            selections: {
              create: [
                { name: 'Home', odds: 2.00 },
                { name: 'Draw', odds: 3.20 },
                { name: 'Away', odds: 3.50 },
              ],
            },
          },
        },
      },
    });
  } else {
    await prisma.game.update({
      where: { id: existing.id },
      data:  {
        status:    mapStatus(f.fixture.status.short),
        homeScore: f.goals.home ?? null,
        awayScore: f.goals.away ?? null,
        minute:    f.fixture.status.elapsed,
      },
    });
  }
}

async function markFinishedGames(liveFixtures: APIFootballFixture[]): Promise<void> {
  // Find games in DB that are LIVE but not in the live list anymore
  const liveIds = liveFixtures.map(f => String(f.fixture.id));
  const dbLiveGames = await prisma.game.findMany({ where: { status: 'LIVE' } });

  for (const game of dbLiveGames) {
    if (game.externalId && !liveIds.includes(game.externalId)) {
      // Fetch final result
      try {
        const result: APIFootballFixture[] = await apiFetch(
          `/fixtures?id=${game.externalId}`
        );
        if (result[0]) {
          const f = result[0];
          const statusShort = f.fixture.status.short;
          if (['FT', 'AET', 'PEN'].includes(statusShort)) {
            await prisma.game.update({
              where: { id: game.id },
              data: {
                status:    'FINISHED',
                homeScore: f.goals.home ?? 0,
                awayScore: f.goals.away ?? 0,
                minute:    90,
              },
            });
          }
        }
      } catch { /* silent */ }
    }
  }
}

function normalizeStats(raw: APIFootballStats[]): any[] {
  return raw.map(team => ({
    team: team.team.name,
    stats: Object.fromEntries(
      team.statistics.map(s => [
        s.type.toLowerCase().replace(/\s+/g, '_'),
        s.value,
      ])
    ),
  }));
}

function normalizeEvents(raw: APIFootballEvent[]): any[] {
  return raw.map(e => ({
    minute:  e.time.elapsed + (e.time.extra ? `+${e.time.extra}` : ''),
    team:    e.team.name,
    player:  e.player.name,
    assist:  e.assist?.name ?? null,
    type:    e.type,
    detail:  e.detail,
    icon:    eventIcon(e.type, e.detail),
  }));
}

function normalizeLineups(raw: APIFootballLineup[]): any[] {
  return raw.map(t => ({
    team:      t.team.name,
    logo:      t.team.logo,
    coach:     t.coach.name,
    formation: t.formation,
    startXI:   t.startXI.map(p => ({
      number: p.player.number,
      name:   p.player.name,
      pos:    p.player.pos,
      grid:   p.player.grid,
    })),
    substitutes: t.substitutes.map(p => ({
      number: p.player.number,
      name:   p.player.name,
      pos:    p.player.pos,
    })),
  }));
}

function mapStatus(short: string): string {
  const map: Record<string, string> = {
    'NS':   'SCHEDULED',
    'TBD':  'SCHEDULED',
    '1H':   'LIVE',
    'HT':   'LIVE',
    '2H':   'LIVE',
    'ET':   'LIVE',
    'BT':   'LIVE',
    'P':    'LIVE',
    'SUSP': 'LIVE',
    'INT':  'LIVE',
    'LIVE': 'LIVE',
    'FT':   'FINISHED',
    'AET':  'FINISHED',
    'PEN':  'FINISHED',
    'PST':  'POSTPONED',
    'CANC': 'CANCELLED',
    'ABD':  'CANCELLED',
    'AWD':  'FINISHED',
    'WO':   'FINISHED',
  };
  return map[short] ?? 'SCHEDULED';
}

function mapPeriod(short: string): string {
  const map: Record<string, string> = {
    '1H': '1º Tempo',
    'HT': 'Intervalo',
    '2H': '2º Tempo',
    'ET': 'Prorrogação',
    'P':  'Pênaltis',
    'FT': 'Encerrado',
  };
  return map[short] ?? short;
}

function eventIcon(type: string, detail: string): string {
  if (type === 'Goal') {
    if (detail.includes('Penalty')) return '⚽🥅';
    if (detail.includes('Own')) return '⚽🤦';
    return '⚽';
  }
  if (type === 'Card') {
    if (detail === 'Yellow Card') return '🟨';
    if (detail === 'Red Card')    return '🟥';
    if (detail.includes('Yellow Red')) return '🟨🟥';
  }
  if (type === 'subst') return '🔄';
  if (type === 'Var')   return '📺';
  return '•';
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
