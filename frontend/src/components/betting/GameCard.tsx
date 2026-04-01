import { Link } from 'react-router-dom';
import { Clock, Zap } from 'lucide-react';
import { useBetSlipStore } from '@/stores/betSlipStore';
import { formatTime, timeUntilGame, cn } from '@/lib/utils';

interface Props {
  game: any;
  compact?: boolean;
}

export default function GameCard({ game, compact = false }: Props) {
  const { toggleSelection, hasSelection } = useBetSlipStore();
  const isLive = game.status === 'LIVE';

  const handleOddsClick = (e: React.MouseEvent, selection: any, market: any) => {
    e.preventDefault();
    e.stopPropagation();
    toggleSelection({
      selectionId: selection.id,
      selectionName: selection.name,
      marketName: market.name,
      odds: selection.odds,
      gameId: game.id,
      homeTeam: game.homeTeam.name,
      awayTeam: game.awayTeam.name,
    });
  };

  const h2hMarket = game.markets?.find((m: any) => m.name === '1X2');

  if (compact) {
    return (
      <Link to={`/games/${game.id}`}
        className="block bg-card border border-border rounded-xl p-4 hover:border-brand-600 transition-colors">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {isLive ? (
              <span className="flex items-center gap-1.5 text-red-400 text-xs font-semibold">
                <span className="live-dot" /> AO VIVO {game.minute && `${game.minute}'`}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
                <Clock className="w-3 h-3" /> {timeUntilGame(game.startTime)}
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground">{game.league || game.sport?.name}</span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium truncate">{game.homeTeam.name}</p>
              {isLive && <span className="font-bold text-lg ml-2">{game.homeScore ?? 0}</span>}
            </div>
            <div className="flex items-center justify-between mt-1">
              <p className="text-sm font-medium truncate">{game.awayTeam.name}</p>
              {isLive && <span className="font-bold text-lg ml-2">{game.awayScore ?? 0}</span>}
            </div>
          </div>

          {h2hMarket && (
            <div className="flex gap-1.5 shrink-0">
              {h2hMarket.selections.map((sel: any) => (
                <button
                  key={sel.id}
                  onClick={(e) => handleOddsClick(e, sel, h2hMarket)}
                  className={cn('odds-btn min-w-[52px]', hasSelection(sel.id) && 'selected')}
                >
                  <span className="text-xs text-muted-foreground">{sel.name === 'Home' ? '1' : sel.name === 'Draw' ? 'X' : '2'}</span>
                  <span className="text-sm font-bold">{sel.odds.toFixed(2)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </Link>
    );
  }

  return (
    <Link to={`/games/${game.id}`}
      className="block bg-card border border-border rounded-xl p-5 hover:border-brand-600 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{game.sport?.name}</span>
          {game.league && (
            <>
              <span className="text-muted-foreground">•</span>
              <span className="text-sm text-muted-foreground">{game.league}</span>
            </>
          )}
        </div>
        {isLive ? (
          <span className="flex items-center gap-1.5 bg-red-500/10 text-red-400 text-xs font-semibold px-2.5 py-1 rounded-full border border-red-500/20">
            <span className="live-dot" /> AO VIVO {game.minute && `${game.minute}'`}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <Clock className="w-3 h-3" />
            {formatTime(game.startTime)}
          </span>
        )}
      </div>

      {/* Teams */}
      <div className="grid grid-cols-3 items-center gap-4 mb-5">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-secondary flex items-center justify-center text-xl">
            🏆
          </div>
          <p className="text-sm font-semibold">{game.homeTeam.name}</p>
        </div>

        <div className="text-center">
          {isLive ? (
            <div className="flex items-center justify-center gap-3">
              <span className="text-3xl font-black">{game.homeScore ?? 0}</span>
              <span className="text-muted-foreground">-</span>
              <span className="text-3xl font-black">{game.awayScore ?? 0}</span>
            </div>
          ) : (
            <div>
              <p className="text-lg font-bold text-muted-foreground">VS</p>
              <p className="text-xs text-muted-foreground mt-1">{formatTime(game.startTime)}</p>
            </div>
          )}
        </div>

        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-secondary flex items-center justify-center text-xl">
            🏆
          </div>
          <p className="text-sm font-semibold">{game.awayTeam.name}</p>
        </div>
      </div>

      {/* Markets */}
      {game.markets?.map((market: any) => (
        <div key={market.id} className="mt-3">
          <p className="text-xs text-muted-foreground mb-2">{market.name}</p>
          <div className="flex gap-2">
            {market.selections.map((sel: any) => (
              <button
                key={sel.id}
                onClick={(e) => handleOddsClick(e, sel, market)}
                className={cn('odds-btn flex-1', hasSelection(sel.id) && 'selected')}
              >
                <span className="text-xs text-muted-foreground">{sel.name}</span>
                <span className="text-base font-bold">{sel.odds.toFixed(2)}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </Link>
  );
}
