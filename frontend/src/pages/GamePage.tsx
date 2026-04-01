import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import { useBetSlipStore } from '@/stores/betSlipStore';
import { subscribeToGame, unsubscribeFromGame, getSocket } from '@/lib/socket';
import { Clock, Zap, Trophy, Users, BarChart2, Activity, Star } from 'lucide-react';

type DetailTab = 'odds' | 'stats' | 'events' | 'lineups' | 'h2h' | 'players';

// ===================== STAT BAR =====================
function StatBar({ label, home, away }: { label: string; home: number | string | null; away: number | string | null }) {
  const h = parseFloat(String(home ?? 0)) || 0;
  const a = parseFloat(String(away ?? 0)) || 0;
  const total = h + a || 1;
  const homePct = Math.round((h / total) * 100);
  const awayPct = 100 - homePct;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{home ?? 0}</span>
        <span>{label}</span>
        <span className="font-medium text-foreground">{away ?? 0}</span>
      </div>
      <div className="flex h-1.5 rounded-full overflow-hidden bg-secondary">
        <div className="bg-brand-500 transition-all" style={{ width: `${homePct}%` }} />
        <div className="bg-red-500 transition-all" style={{ width: `${awayPct}%` }} />
      </div>
    </div>
  );
}

// ===================== EVENTS TIMELINE =====================
function EventTimeline({ events, homeTeam, awayTeam }: { events: any[]; homeTeam: string; awayTeam: string }) {
  if (!events.length) return (
    <p className="text-center text-muted-foreground py-8 text-sm">Nenhum evento ainda.</p>
  );

  return (
    <div className="space-y-2">
      {events.map((ev, i) => {
        const isHome = ev.team === homeTeam;
        return (
          <div key={i} className={cn('flex items-center gap-3', isHome ? 'flex-row' : 'flex-row-reverse')}>
            {/* Minute */}
            <div className="w-10 shrink-0 text-center">
              <span className="text-xs font-mono font-bold text-brand-400 bg-brand-900/50 rounded px-1.5 py-0.5">
                {ev.minute}'
              </span>
            </div>

            {/* Content */}
            <div className={cn(
              'flex-1 flex items-center gap-2 bg-secondary border border-border rounded-lg px-3 py-2',
              isHome ? '' : 'flex-row-reverse'
            )}>
              <span className="text-lg">{ev.icon}</span>
              <div className={cn('flex-1', !isHome && 'text-right')}>
                <p className="text-sm font-medium">{ev.player}</p>
                {ev.assist && <p className="text-xs text-muted-foreground">Assistência: {ev.assist}</p>}
                <p className="text-xs text-muted-foreground">{ev.detail}</p>
              </div>
            </div>

            {/* Spacer for alignment */}
            <div className="w-10 shrink-0" />
          </div>
        );
      })}
    </div>
  );
}

// ===================== LINEUP PITCH =====================
function LineupDisplay({ lineup }: { lineup: any }) {
  if (!lineup) return <p className="text-center text-muted-foreground py-8 text-sm">Escalação não disponível.</p>;

  // Parse grid positions like "1:1", "2:1" (col:row)
  const rows: Record<number, any[]> = {};
  for (const p of lineup.startXI) {
    const [col, row] = (p.grid || '1:1').split(':').map(Number);
    if (!rows[row]) rows[row] = [];
    rows[row].push({ ...p, col });
  }

  const sortedRows = Object.entries(rows)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([, players]) => players.sort((a: any, b: any) => a.col - b.col));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold">{lineup.team}</span>
        <span className="text-muted-foreground">Formação: <strong>{lineup.formation}</strong></span>
        <span className="text-muted-foreground text-xs">Técnico: {lineup.coach}</span>
      </div>

      {/* Pitch visualization */}
      <div className="bg-green-900/30 border border-green-800/40 rounded-xl p-4 space-y-3">
        {sortedRows.map((rowPlayers, i) => (
          <div key={i} className="flex justify-around">
            {rowPlayers.map((p: any) => (
              <div key={p.name} className="flex flex-col items-center gap-1 w-16">
                <div className="w-9 h-9 rounded-full bg-brand-700 border-2 border-brand-500
                                flex items-center justify-center text-xs font-bold">
                  {p.number}
                </div>
                <p className="text-xs text-center leading-tight truncate w-full text-center">
                  {p.name.split(' ').pop()}
                </p>
                <span className="text-xs text-muted-foreground">{p.pos}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Substitutes */}
      {lineup.substitutes?.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Suplentes</p>
          <div className="grid grid-cols-3 gap-2">
            {lineup.substitutes.map((p: any) => (
              <div key={p.name} className="flex items-center gap-2 bg-secondary rounded-lg px-2 py-1.5">
                <span className="text-xs font-bold text-muted-foreground w-5">{p.number}</span>
                <span className="text-xs truncate">{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ===================== H2H TABLE =====================
function H2HTable({ games, homeTeam, awayTeam }: { games: any[]; homeTeam: string; awayTeam: string }) {
  if (!games.length) return <p className="text-center text-muted-foreground py-8 text-sm">Sem histórico de confrontos.</p>;

  return (
    <div className="space-y-3">
      <div className="flex gap-4 text-xs text-center">
        {['Vitórias ' + homeTeam, 'Empates', 'Vitórias ' + awayTeam].map((label, i) => {
          const wins = games.filter(g =>
            i === 0 ? g.winner === homeTeam :
            i === 1 ? g.winner === 'Empate' :
            g.winner === awayTeam
          ).length;
          return (
            <div key={label} className={cn('flex-1 py-3 rounded-lg border', i === 0 ? 'border-brand-600 bg-brand-900/20' : i === 2 ? 'border-red-600 bg-red-900/20' : 'border-border bg-secondary')}>
              <p className="text-xl font-black">{wins}</p>
              <p className="text-muted-foreground mt-0.5 leading-tight">{label}</p>
            </div>
          );
        })}
      </div>

      <div className="space-y-2">
        {games.map((g, i) => (
          <div key={i} className="flex items-center gap-3 bg-secondary rounded-lg px-4 py-3 text-sm">
            <span className="text-muted-foreground text-xs w-20 shrink-0">{new Date(g.date).toLocaleDateString('pt-BR')}</span>
            <span className="flex-1 text-right font-medium truncate">{g.homeTeam}</span>
            <span className="font-black text-base px-3 py-1 bg-background rounded-lg shrink-0">
              {g.homeScore} — {g.awayScore}
            </span>
            <span className="flex-1 font-medium truncate">{g.awayTeam}</span>
            <span className={cn('text-xs px-2 py-0.5 rounded-full shrink-0',
              g.winner === homeTeam ? 'bg-brand-500/20 text-brand-400' :
              g.winner === awayTeam ? 'bg-red-500/20 text-red-400' :
              'bg-secondary text-muted-foreground'
            )}>
              {g.winner === 'Empate' ? 'X' : g.winner === homeTeam ? 'C' : 'V'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===================== PLAYER STATS TABLE =====================
function PlayerStatsTable({ players }: { players: any[] }) {
  const [team, setTeam] = useState<string>('');
  const teams = [...new Set(players.map(p => p.team))];
  const filtered = team ? players.filter(p => p.team === team) : players;

  const topByRating = [...filtered].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 11);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button onClick={() => setTeam('')}
          className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
            !team ? 'bg-brand-600 text-white' : 'bg-secondary text-muted-foreground')}>
          Todos
        </button>
        {teams.map(t => (
          <button key={t} onClick={() => setTeam(t)}
            className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              team === t ? 'bg-brand-600 text-white' : 'bg-secondary text-muted-foreground')}>
            {t}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground border-b border-border">
              <th className="text-left py-2 px-3">Jogador</th>
              <th className="text-center py-2 px-2">Nota</th>
              <th className="text-center py-2 px-2">⚽</th>
              <th className="text-center py-2 px-2">🅰️</th>
              <th className="text-center py-2 px-2">Chutes</th>
              <th className="text-center py-2 px-2">Passes</th>
              <th className="text-center py-2 px-2">🟨</th>
              <th className="text-center py-2 px-2">🟥</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {topByRating.map((p, i) => (
              <tr key={i} className="hover:bg-secondary/30 transition-colors">
                <td className="py-2 px-3">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-muted-foreground">{p.team}</p>
                </td>
                <td className="text-center py-2 px-2">
                  {p.rating ? (
                    <span className={cn('font-bold px-1.5 py-0.5 rounded',
                      Number(p.rating) >= 7.5 ? 'text-green-400 bg-green-400/10' :
                      Number(p.rating) >= 6   ? 'text-yellow-400 bg-yellow-400/10' :
                      'text-red-400 bg-red-400/10'
                    )}>
                      {Number(p.rating).toFixed(1)}
                    </span>
                  ) : '—'}
                </td>
                <td className="text-center py-2 px-2">{p.goals || 0}</td>
                <td className="text-center py-2 px-2">{p.assists || 0}</td>
                <td className="text-center py-2 px-2">{p.shots || 0}</td>
                <td className="text-center py-2 px-2">{p.passes || 0}</td>
                <td className="text-center py-2 px-2">{p.yellow || 0}</td>
                <td className="text-center py-2 px-2">{p.red || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ===================== MAIN PAGE =====================

export default function GamePage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<DetailTab>('odds');

  const { data: gameData, isLoading, refetch } = useQuery({
    queryKey: ['game', id],
    queryFn:  async () => (await api.get(`/games/${id}`)).data.game,
    refetchInterval: 60_000,
  });

  const { data: details, isLoading: detailsLoading } = useQuery({
    queryKey: ['game-details', id],
    queryFn:  async () => (await api.get(`/games/${id}/details`)).data,
    enabled:  !!id,
    refetchInterval: gameData?.status === 'LIVE' ? 60_000 : false,
    staleTime: 30_000,
  });

  const { toggleSelection, hasSelection } = useBetSlipStore();

  useEffect(() => {
    if (!id) return;
    subscribeToGame(id);
    const socket = getSocket();

    socket.on('game:update', (update: any) => {
      if (update.id === id) refetch();
    });

    socket.on('game:event', (event: any) => {
      // Invalidate details to refresh events
      refetch();
    });

    return () => {
      unsubscribeFromGame(id);
      socket.off('game:update');
      socket.off('game:event');
    };
  }, [id]);

  if (isLoading) return (
    <div className="max-w-3xl mx-auto space-y-4 animate-pulse">
      <div className="h-48 bg-card border border-border rounded-xl" />
      <div className="h-64 bg-card border border-border rounded-xl" />
    </div>
  );

  if (!gameData) return <div className="text-center py-20 text-muted-foreground">Jogo não encontrado.</div>;

  const game = gameData;
  const isLive     = game.status === 'LIVE';
  const isFinished = game.status === 'FINISHED';

  const TABS: { id: DetailTab; label: string; icon: any }[] = [
    { id: 'odds',    label: 'Odds',        icon: Trophy },
    { id: 'stats',   label: 'Estatísticas', icon: BarChart2 },
    { id: 'events',  label: 'Eventos',     icon: Activity },
    { id: 'lineups', label: 'Escalações',  icon: Users },
    { id: 'h2h',     label: 'H2H',         icon: Zap },
    { id: 'players', label: 'Jogadores',   icon: Star },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-4">

      {/* ── SCOREBOARD ── */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <p className="text-sm text-muted-foreground">{game.sport?.name} — {game.league}</p>
          {isLive ? (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 bg-red-500/10 text-red-400 text-sm font-semibold px-3 py-1 rounded-full border border-red-500/20">
                <Zap className="w-3.5 h-3.5" />
                AO VIVO{game.minute ? ` — ${game.minute}'` : ''}
                {game.period ? ` · ${game.period}` : ''}
              </span>
            </div>
          ) : isFinished ? (
            <span className="bg-secondary text-muted-foreground text-sm px-3 py-1 rounded-full">Encerrado</span>
          ) : (
            <span className="flex items-center gap-1.5 text-muted-foreground text-sm">
              <Clock className="w-3.5 h-3.5" /> {formatDate(game.startTime)}
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 items-center gap-4">
          {/* Home */}
          <div className="text-center">
            {game.homeTeam.logo
              ? <img src={game.homeTeam.logo} alt={game.homeTeam.name} className="w-14 h-14 mx-auto mb-2 object-contain" />
              : <div className="w-14 h-14 mx-auto mb-2 rounded-full bg-secondary flex items-center justify-center text-2xl">🏆</div>
            }
            <p className="font-bold">{game.homeTeam.name}</p>
            <p className="text-xs text-muted-foreground">Casa</p>
          </div>

          {/* Score */}
          <div className="text-center">
            {isLive || isFinished ? (
              <div>
                <div className="flex items-center justify-center gap-4">
                  <span className="text-5xl font-black">{game.homeScore ?? 0}</span>
                  <span className="text-3xl text-muted-foreground">:</span>
                  <span className="text-5xl font-black">{game.awayScore ?? 0}</span>
                </div>
                {isLive && game.minute && (
                  <p className="text-red-400 text-sm font-semibold mt-1">{game.minute}'</p>
                )}
                {/* Halftime score */}
                {details?.stats?.length > 0 && isLive && (
                  <p className="text-xs text-muted-foreground mt-1">Intervalo: — </p>
                )}
              </div>
            ) : (
              <div>
                <p className="text-3xl font-bold text-muted-foreground">VS</p>
                <p className="text-xs text-muted-foreground mt-1">{formatDate(game.startTime)}</p>
              </div>
            )}
          </div>

          {/* Away */}
          <div className="text-center">
            {game.awayTeam.logo
              ? <img src={game.awayTeam.logo} alt={game.awayTeam.name} className="w-14 h-14 mx-auto mb-2 object-contain" />
              : <div className="w-14 h-14 mx-auto mb-2 rounded-full bg-secondary flex items-center justify-center text-2xl">🏆</div>
            }
            <p className="font-bold">{game.awayTeam.name}</p>
            <p className="text-xs text-muted-foreground">Visitante</p>
          </div>
        </div>

        {/* Quick event feed (latest 3) */}
        {isLive && details?.events?.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border flex flex-wrap gap-2">
            {details.events.slice(-3).reverse().map((ev: any, i: number) => (
              <span key={i} className="text-xs bg-secondary rounded-full px-2.5 py-1">
                {ev.icon} {ev.minute}' {ev.player}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── TABS ── */}
      <div className="flex gap-1 overflow-x-auto bg-secondary rounded-xl p-1">
        {TABS.map(({ id: tabId, label, icon: Icon }) => (
          <button key={tabId} onClick={() => setTab(tabId)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium shrink-0 transition-colors',
              tab === tabId ? 'bg-background text-foreground shadow' : 'text-muted-foreground hover:text-foreground'
            )}>
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB CONTENT ── */}
      <div className="bg-card border border-border rounded-xl p-5">
        {/* ODDS */}
        {tab === 'odds' && (
          <div>
            {isFinished ? (
              <div className="text-center py-6">
                <Trophy className="w-10 h-10 text-gold-400 mx-auto mb-2" />
                <p className="font-semibold">Jogo encerrado</p>
                <p className="text-muted-foreground text-sm mt-1">
                  {game.homeTeam.name} {game.homeScore} × {game.awayScore} {game.awayTeam.name}
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {game.markets?.map((market: any) => (
                  <div key={market.id}>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">{market.name}</p>
                    <div className="grid grid-cols-3 gap-3">
                      {market.selections.map((sel: any) => (
                        <button key={sel.id}
                          onClick={() => toggleSelection({
                            selectionId: sel.id,
                            selectionName: sel.name,
                            marketName: market.name,
                            odds: sel.odds,
                            gameId: game.id,
                            homeTeam: game.homeTeam.name,
                            awayTeam: game.awayTeam.name,
                          })}
                          className={cn('odds-btn py-4', hasSelection(sel.id) && 'selected')}>
                          <span className="text-sm text-muted-foreground mb-1">{sel.name}</span>
                          <span className="text-2xl font-black">{sel.odds.toFixed(2)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STATS */}
        {tab === 'stats' && (
          <div>
            {detailsLoading ? (
              <div className="space-y-4 animate-pulse">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-6 bg-secondary rounded" />
                ))}
              </div>
            ) : !details?.stats?.length ? (
              <div className="text-center py-8">
                <BarChart2 className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">
                  {process.env.NODE_ENV !== 'test' && !details
                    ? 'Configure API_FOOTBALL_KEY para estatísticas ao vivo.'
                    : 'Estatísticas não disponíveis ainda.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between text-xs font-semibold text-muted-foreground mb-4">
                  <span>{details.stats[0]?.team}</span>
                  <span>Estatística</span>
                  <span>{details.stats[1]?.team}</span>
                </div>
                {[
                  ['shots_on_goal',    'Chutes no gol'],
                  ['shots_off_goal',   'Chutes fora'],
                  ['total_shots',      'Total de chutes'],
                  ['ball_possession',  'Posse de bola (%)'],
                  ['corner_kicks',     'Escanteios'],
                  ['offsides',         'Impedimentos'],
                  ['fouls',            'Faltas'],
                  ['yellow_cards',     'Cartões amarelos'],
                  ['red_cards',        'Cartões vermelhos'],
                  ['goalkeeper_saves', 'Defesas'],
                  ['total_passes',     'Passes totais'],
                  ['passes_accurate',  'Passes certos'],
                ].map(([key, label]) => {
                  const h = details.stats[0]?.stats?.[key];
                  const a = details.stats[1]?.stats?.[key];
                  if (h == null && a == null) return null;
                  return <StatBar key={key} label={label} home={h} away={a} />;
                }).filter(Boolean)}
              </div>
            )}
          </div>
        )}

        {/* EVENTS */}
        {tab === 'events' && (
          detailsLoading
            ? <div className="space-y-3 animate-pulse">{Array.from({length:5}).map((_,i)=><div key={i} className="h-12 bg-secondary rounded-lg"/>)}</div>
            : <EventTimeline
                events={details?.events ?? []}
                homeTeam={game.homeTeam.name}
                awayTeam={game.awayTeam.name}
              />
        )}

        {/* LINEUPS */}
        {tab === 'lineups' && (
          <div>
            {detailsLoading ? (
              <div className="space-y-3 animate-pulse">
                <div className="h-64 bg-secondary rounded-xl" />
              </div>
            ) : !details?.lineups?.length ? (
              <p className="text-center text-muted-foreground py-8 text-sm">
                Escalações não divulgadas ainda.
              </p>
            ) : (
              <div className="space-y-6">
                {details.lineups.map((lineup: any, i: number) => (
                  <LineupDisplay key={i} lineup={lineup} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* H2H */}
        {tab === 'h2h' && (
          detailsLoading
            ? <div className="h-48 bg-secondary rounded-xl animate-pulse" />
            : <H2HTable
                games={details?.h2h ?? []}
                homeTeam={game.homeTeam.name}
                awayTeam={game.awayTeam.name}
              />
        )}

        {/* PLAYER STATS */}
        {tab === 'players' && (
          detailsLoading
            ? <div className="h-64 bg-secondary rounded-xl animate-pulse" />
            : !details?.playerStats?.length
              ? <p className="text-center text-muted-foreground py-8 text-sm">Estatísticas de jogadores não disponíveis.</p>
              : <PlayerStatsTable players={details.playerStats} />
        )}
      </div>
    </div>
  );
}
