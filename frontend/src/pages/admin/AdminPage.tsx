import { Routes, Route, Link, NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  Users, BarChart3, CreditCard, Trophy, AlertTriangle,
  CheckCircle, XCircle, RefreshCw, Shield
} from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';

function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => (await api.get('/admin/stats')).data,
    refetchInterval: 60_000,
  });

  const syncMutation = useMutation({
    mutationFn: async () => api.post('/admin/games/sync'),
    onSuccess: () => toast.success('Jogos sincronizados!'),
    onError: () => toast.error('Erro ao sincronizar'),
  });

  if (isLoading) return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-24 bg-card border border-border rounded-xl" />
      ))}
    </div>
  );

  const stats = data?.totals;
  const today = data?.today;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Dashboard</h2>
        <button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}
          className="flex items-center gap-2 bg-secondary border border-border hover:border-brand-600
                     px-4 py-2 rounded-lg text-sm transition-colors">
          <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
          Sincronizar Jogos
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total usuários', value: stats?.users, sub: `${stats?.activeUsers} ativos`, icon: Users, color: 'text-brand-400' },
          { label: 'Total apostas', value: stats?.bets, sub: `${stats?.pendingBets} pendentes`, icon: Trophy, color: 'text-yellow-400' },
          { label: 'Total depositado', value: formatCurrency(stats?.depositsAmount || 0), sub: 'Acumulado', icon: CreditCard, color: 'text-green-400' },
          { label: 'Saques pendentes', value: stats?.pendingWithdrawals, sub: 'Aguardando aprovação', icon: AlertTriangle, color: 'text-red-400' },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="stat-card">
            <Icon className={`w-5 h-5 ${color}`} />
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xs text-muted-foreground/70">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {[
          { label: 'Apostas hoje', value: today?.betsCount, sub: formatCurrency(today?.betsAmount || 0) },
          { label: 'Depósitos hoje', value: formatCurrency(today?.depositsAmount || 0), sub: 'Total depositado hoje' },
          { label: 'Novos usuários', value: today?.newUsers, sub: 'Registrados hoje' },
        ].map(({ label, value, sub }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-5">
            <p className="text-muted-foreground text-sm">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            <p className="text-xs text-muted-foreground">{sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminUsers() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', page, search],
    queryFn: async () => (await api.get(`/admin/users?page=${page}&search=${search}`)).data,
  });

  const statusMutation = useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: string }) =>
      api.patch(`/admin/users/${userId}/status`, { status }),
    onSuccess: () => { toast.success('Status atualizado!'); qc.invalidateQueries({ queryKey: ['admin-users'] }); },
    onError: () => toast.error('Erro ao atualizar'),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Usuários</h2>
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Buscar usuário..."
          className="bg-secondary border border-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-brand-500 w-64" />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr className="text-muted-foreground text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">Usuário</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Saldo</th>
                  <th className="px-4 py-3 text-center">Apostas</th>
                  <th className="px-4 py-3 text-right">Cadastro</th>
                  <th className="px-4 py-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data?.users?.map((user: any) => (
                  <tr key={user.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium">{user.firstName} {user.lastName}</p>
                      <p className="text-muted-foreground text-xs">{user.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        user.status === 'ACTIVE' ? 'bg-green-500/10 text-green-400' :
                        user.status === 'SUSPENDED' ? 'bg-yellow-500/10 text-yellow-400' :
                        'bg-red-500/10 text-red-400'
                      }`}>{user.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(user.balance)}</td>
                    <td className="px-4 py-3 text-center">{user._count.bets}</td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-1">
                        {user.status !== 'ACTIVE' && (
                          <button onClick={() => statusMutation.mutate({ userId: user.id, status: 'ACTIVE' })}
                            className="p-1.5 text-green-400 hover:bg-green-500/10 rounded transition-colors" title="Ativar">
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        {user.status === 'ACTIVE' && (
                          <button onClick={() => statusMutation.mutate({ userId: user.id, status: 'SUSPENDED' })}
                            className="p-1.5 text-yellow-400 hover:bg-yellow-500/10 rounded transition-colors" title="Suspender">
                            <AlertTriangle className="w-4 h-4" />
                          </button>
                        )}
                        {user.status !== 'BANNED' && (
                          <button onClick={() => statusMutation.mutate({ userId: user.id, status: 'BANNED' })}
                            className="p-1.5 text-red-400 hover:bg-red-500/10 rounded transition-colors" title="Banir">
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminWithdrawals() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-withdrawals'],
    queryFn: async () => (await api.get('/admin/withdrawals/pending')).data.withdrawals,
  });

  const processMutation = useMutation({
    mutationFn: async ({ txId, action }: { txId: string; action: string }) =>
      api.patch(`/admin/withdrawals/${txId}`, { action }),
    onSuccess: (_, vars) => {
      toast.success(vars.action === 'APPROVE' ? 'Saque aprovado!' : 'Saque rejeitado.');
      qc.invalidateQueries({ queryKey: ['admin-withdrawals'] });
    },
    onError: () => toast.error('Erro ao processar saque'),
  });

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Saques Pendentes</h2>
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : !data?.length ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center text-muted-foreground">
          <CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-400" />
          Nenhum saque pendente!
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((tx: any) => (
            <div key={tx.id} className="bg-card border border-border rounded-xl p-5 flex items-center justify-between gap-4">
              <div className="flex-1">
                <p className="font-medium">{tx.user.firstName} {tx.user.lastName}</p>
                <p className="text-sm text-muted-foreground">{tx.user.email}</p>
                <p className="text-xs text-muted-foreground mt-1">{tx.description}</p>
                <p className="text-xs text-muted-foreground">{formatDate(tx.createdAt)}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold">{formatCurrency(tx.amount)}</p>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => processMutation.mutate({ txId: tx.id, action: 'APPROVE' })}
                    className="flex items-center gap-1 text-xs bg-green-500/10 text-green-400 border border-green-500/20 px-3 py-1.5 rounded-lg hover:bg-green-500/20 transition-colors">
                    <CheckCircle className="w-3 h-3" /> Aprovar
                  </button>
                  <button onClick={() => processMutation.mutate({ txId: tx.id, action: 'REJECT' })}
                    className="flex items-center gap-1 text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg hover:bg-red-500/20 transition-colors">
                    <XCircle className="w-3 h-3" /> Rejeitar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Main admin page with sub-routing
export default function AdminPage() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Shield className="w-6 h-6 text-gold-400" />
        <h1 className="text-2xl font-bold text-gold-400">Painel Administrativo</h1>
      </div>

      {/* Admin nav */}
      <div className="flex gap-1 bg-secondary rounded-xl p-1 w-fit">
        {[
          { to: '/admin', label: 'Dashboard', icon: BarChart3 },
          { to: '/admin/users', label: 'Usuários', icon: Users },
          { to: '/admin/withdrawals', label: 'Saques', icon: CreditCard },
        ].map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-background text-foreground shadow' : 'text-muted-foreground hover:text-foreground'
              }`
            }>
            <Icon className="w-3.5 h-3.5" />
            {label}
          </NavLink>
        ))}
      </div>

      <Routes>
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="withdrawals" element={<AdminWithdrawals />} />
      </Routes>
    </div>
  );
}
