import { useQuery } from '@tanstack/react-query';
import { TrendingUp, Wallet, Trophy, Clock, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { formatCurrency, formatDate, getBetStatusColor } from '@/lib/utils';
import GameCard from '@/components/betting/GameCard';

export default function DashboardPage() {
  const { user } = useAuthStore();

  const { data: activeBets } = useQuery({
    queryKey: ['active-bets'],
    queryFn: async () => (await api.get('/bets/active')).data.bets,
  });

  const { data: gamesData } = useQuery({
    queryKey: ['upcoming-games'],
    queryFn: async () => (await api.get('/games/upcoming?limit=4')).data,
  });

  const { data: transactions } = useQuery({
    queryKey: ['transactions'],
    queryFn: async () => (await api.get('/users/transactions?limit=5')).data.transactions,
  });

  const pendingBets = activeBets?.filter((b: any) => b.status === 'PENDING') || [];
  const totalPotential = pendingBets.reduce((s: number, b: any) => s + b.potentialWin, 0);

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Olá, {user?.firstName}! 👋</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Bem-vindo ao seu painel</p>
        </div>
        <Link to="/wallet"
          className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
          + Depositar
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Saldo</span>
            <Wallet className="w-4 h-4 text-brand-400" />
          </div>
          <p className="text-2xl font-bold text-brand-400">{formatCurrency(user?.balance || 0)}</p>
          {(user?.bonusBalance || 0) > 0 && (
            <p className="text-xs text-gold-400">+ {formatCurrency(user?.bonusBalance || 0)} bônus</p>
          )}
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Apostas Ativas</span>
            <Clock className="w-4 h-4 text-yellow-400" />
          </div>
          <p className="text-2xl font-bold">{pendingBets.length}</p>
          <p className="text-xs text-muted-foreground">Em andamento</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Potencial Ganho</span>
            <TrendingUp className="w-4 h-4 text-green-400" />
          </div>
          <p className="text-2xl font-bold text-green-400">{formatCurrency(totalPotential)}</p>
          <p className="text-xs text-muted-foreground">Se ganhar tudo</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Nível</span>
            <Trophy className="w-4 h-4 text-gold-400" />
          </div>
          <p className="text-2xl font-bold text-gold-400">{user?.role === 'VIP' ? 'VIP' : 'Standard'}</p>
          <p className="text-xs text-muted-foreground">Status da conta</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Active Bets */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Apostas Ativas</h2>
            <Link to="/bets" className="text-brand-400 text-sm hover:underline">Ver todas</Link>
          </div>

          {pendingBets.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhuma aposta ativa</p>
              <Link to="/sports" className="text-brand-400 text-sm mt-2 inline-block hover:underline">
                Ver jogos disponíveis
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingBets.slice(0, 3).map((bet: any) => (
                <div key={bet.id} className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground font-mono">#{bet.id.slice(0, 8)}</span>
                    <span className={`text-xs font-semibold ${getBetStatusColor(bet.status)}`}>
                      {bet.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {bet.game.homeTeam.name} vs {bet.game.awayTeam.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Odds: {bet.totalOdds.toFixed(2)} | Stake: {formatCurrency(bet.stake)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-green-400">{formatCurrency(bet.potentialWin)}</p>
                      <p className="text-xs text-muted-foreground">potencial</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Upcoming Games */}
          <div className="flex items-center justify-between mt-4">
            <h2 className="font-semibold">Próximos Jogos</h2>
            <Link to="/sports" className="text-brand-400 text-sm hover:underline">Ver todos</Link>
          </div>
          <div className="space-y-3">
            {gamesData?.games?.slice(0, 3).map((game: any) => (
              <GameCard key={game.id} game={game} compact />
            ))}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Transações Recentes</h2>
            <Link to="/wallet" className="text-brand-400 text-sm hover:underline">Ver todas</Link>
          </div>

          <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
            {!transactions || transactions.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">
                Nenhuma transação
              </div>
            ) : (
              transactions.map((tx: any) => (
                <div key={tx.id} className="flex items-center gap-3 p-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                    ${tx.type === 'DEPOSIT' || tx.type === 'BET_WIN' ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                    {tx.type === 'DEPOSIT' || tx.type === 'BET_WIN'
                      ? <ArrowDownRight className="w-4 h-4 text-green-400" />
                      : <ArrowUpRight className="w-4 h-4 text-red-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{tx.description || tx.type}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(tx.createdAt)}</p>
                  </div>
                  <p className={`text-sm font-bold flex-shrink-0 ${tx.netAmount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {tx.netAmount >= 0 ? '+' : ''}{formatCurrency(Math.abs(tx.netAmount))}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
