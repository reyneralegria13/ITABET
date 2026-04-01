import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatCurrency, formatDate, getBetStatusColor } from '@/lib/utils';
import { useState } from 'react';
import { Trophy, Clock, CheckCircle, XCircle } from 'lucide-react';

const STATUS_FILTERS = [
  { value: '', label: 'Todas' },
  { value: 'PENDING', label: 'Ativas' },
  { value: 'WON', label: 'Ganhas' },
  { value: 'LOST', label: 'Perdidas' },
];

export default function BetHistoryPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['bet-history', page],
    queryFn: async () => (await api.get(`/users/bets?page=${page}&limit=15`)).data,
  });

  const filteredBets = statusFilter
    ? data?.bets?.filter((b: any) => b.status === statusFilter)
    : data?.bets;

  const stats = data?.bets
    ? {
        total: data.bets.length,
        won: data.bets.filter((b: any) => b.status === 'WON').length,
        totalWin: data.bets.filter((b: any) => b.status === 'WON').reduce((s: number, b: any) => s + (b.actualWin || 0), 0),
        totalStake: data.bets.reduce((s: number, b: any) => s + b.stake, 0),
      }
    : null;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Histórico de Apostas</h1>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total apostas', value: stats.total, icon: Trophy },
            { label: 'Ganhas', value: stats.won, icon: CheckCircle, className: 'text-green-400' },
            { label: 'Total apostado', value: formatCurrency(stats.totalStake), icon: Clock },
            { label: 'Total ganho', value: formatCurrency(stats.totalWin), icon: CheckCircle, className: 'text-green-400' },
          ].map(({ label, value, icon: Icon, className }) => (
            <div key={label} className="stat-card">
              <Icon className={`w-4 h-4 ${className || 'text-brand-400'}`} />
              <p className={`text-xl font-bold ${className || ''}`}>{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2">
        {STATUS_FILTERS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setStatusFilter(value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === value ? 'bg-brand-600 text-white' : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Bets list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 bg-card border border-border rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !filteredBets?.length ? (
        <div className="text-center py-16">
          <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhuma aposta encontrada.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredBets.map((bet: any) => (
            <div key={bet.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <p className="font-mono text-xs text-muted-foreground">#{bet.id.slice(0, 12)}</p>
                  <p className="font-medium mt-0.5">
                    {bet.game.homeTeam.name} vs {bet.game.awayTeam.name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{formatDate(bet.createdAt)}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className={`text-sm font-bold ${getBetStatusColor(bet.status)}`}>
                    {bet.status === 'PENDING' ? 'Ativa' : bet.status === 'WON' ? 'Ganha' : bet.status === 'LOST' ? 'Perdida' : bet.status}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Apostado</p>
                    <p className="font-semibold">{formatCurrency(bet.stake)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Odds</p>
                    <p className="font-semibold text-brand-400">{bet.totalOdds.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Potencial</p>
                    <p className="font-semibold">{formatCurrency(bet.potentialWin)}</p>
                  </div>
                </div>
                {bet.status === 'WON' && bet.actualWin && (
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Ganho</p>
                    <p className="font-bold text-green-400 text-lg">{formatCurrency(bet.actualWin)}</p>
                  </div>
                )}
              </div>

              {/* Selections */}
              <div className="mt-3 pt-3 border-t border-border space-y-1">
                {bet.selections?.map((bs: any) => (
                  <div key={bs.id} className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{bs.selection.market.name}: <strong className="text-foreground">{bs.selection.name}</strong></span>
                    <span className="font-mono">{bs.oddsAtTime.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {data?.pagination && data.pagination.pages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: data.pagination.pages }, (_, i) => i + 1).map((p) => (
            <button key={p} onClick={() => setPage(p)}
              className={`w-8 h-8 rounded-lg text-sm transition-colors ${
                page === p ? 'bg-brand-600 text-white' : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}>
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
