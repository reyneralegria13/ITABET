import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { formatCurrency, formatDate, getTransactionTypeLabel } from '@/lib/utils';
import { Wallet, ArrowDownLeft, ArrowUpRight, CreditCard, QrCode, Building } from 'lucide-react';
import toast from 'react-hot-toast';

type Tab = 'overview' | 'deposit' | 'withdraw';
type DepositMethod = 'PIX' | 'CREDIT_CARD' | 'BANK_TRANSFER';

const QUICK_AMOUNTS = [50, 100, 200, 500, 1000];

export default function WalletPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [depositMethod, setDepositMethod] = useState<DepositMethod>('PIX');
  const [amount, setAmount] = useState(100);
  const [pixKey, setPixKey] = useState('');
  const [pixKeyType, setPixKeyType] = useState('CPF');
  const { user, updateBalance } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: transactions, isLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn: async () => (await api.get('/users/transactions?limit=20')).data.transactions,
  });

  const depositMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/payments/deposit', {
        amount,
        paymentMethod: depositMethod,
      });
      return res.data;
    },
    onSuccess: (data) => {
      if (depositMethod === 'PIX') {
        toast.success('PIX gerado! Escaneie o QR Code.');
      } else {
        toast.success('Depósito realizado!');
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Erro ao processar depósito');
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/payments/withdraw', {
        amount,
        pixKey,
        pixKeyType,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Solicitação de saque enviada!');
      setTab('overview');
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Erro ao solicitar saque');
    },
  });

  const pixResult = depositMutation.data?.transaction?.pix;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold">Carteira</h1>

      {/* Balance card */}
      <div className="bg-gradient-to-br from-brand-900 to-brand-950 border border-brand-700 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-brand-300 text-sm">Saldo disponível</p>
            <p className="text-3xl font-black text-brand-400">{formatCurrency(user?.balance || 0)}</p>
          </div>
        </div>
        {(user?.bonusBalance || 0) > 0 && (
          <div className="flex items-center gap-2 bg-gold-500/10 border border-gold-500/20 rounded-lg px-3 py-2">
            <span className="text-gold-400 text-sm font-medium">
              Bônus: {formatCurrency(user?.bonusBalance || 0)}
            </span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary rounded-xl p-1">
        {(['overview', 'deposit', 'withdraw'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t ? 'bg-background text-foreground shadow' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'overview' ? 'Histórico' : t === 'deposit' ? 'Depositar' : 'Sacar'}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="divide-y divide-border">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-4 animate-pulse flex gap-3">
                  <div className="w-8 h-8 bg-secondary rounded-full" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 bg-secondary rounded w-1/2" />
                    <div className="h-3 bg-secondary rounded w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : !transactions?.length ? (
            <div className="p-10 text-center text-muted-foreground text-sm">
              Nenhuma transação ainda.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {transactions.map((tx: any) => {
                const isIncoming = ['DEPOSIT', 'BET_WIN', 'BET_REFUND', 'BONUS_CREDIT'].includes(tx.type);
                return (
                  <div key={tx.id} className="flex items-center gap-3 p-4">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${isIncoming ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                      {isIncoming
                        ? <ArrowDownLeft className="w-4 h-4 text-green-400" />
                        : <ArrowUpRight className="w-4 h-4 text-red-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{getTransactionTypeLabel(tx.type)}</p>
                      <p className="text-xs text-muted-foreground truncate">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(tx.createdAt)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`font-bold text-sm ${isIncoming ? 'text-green-400' : 'text-red-400'}`}>
                        {isIncoming ? '+' : '-'}{formatCurrency(tx.amount)}
                      </p>
                      <p className={`text-xs ${tx.status === 'COMPLETED' ? 'text-green-400/70' : tx.status === 'PENDING' ? 'text-yellow-400/70' : 'text-red-400/70'}`}>
                        {tx.status === 'COMPLETED' ? 'Concluído' : tx.status === 'PENDING' ? 'Pendente' : 'Falhou'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Deposit */}
      {tab === 'deposit' && (
        <div className="space-y-4">
          {/* Method selector */}
          <div className="grid grid-cols-3 gap-3">
            {([
              { id: 'PIX', icon: QrCode, label: 'PIX' },
              { id: 'CREDIT_CARD', icon: CreditCard, label: 'Cartão' },
              { id: 'BANK_TRANSFER', icon: Building, label: 'TED/DOC' },
            ] as const).map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setDepositMethod(id)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors ${
                  depositMethod === id
                    ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                    : 'border-border bg-card text-muted-foreground hover:border-brand-600'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">{label}</span>
              </button>
            ))}
          </div>

          {/* Amount */}
          <div>
            <label className="text-sm font-medium mb-2 block">Valor do depósito</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Math.max(20, Number(e.target.value)))}
                min={20}
                max={50000}
                className="w-full bg-secondary border border-border rounded-lg pl-10 pr-4 py-3 text-sm
                           focus:outline-none focus:border-brand-500 font-bold"
              />
            </div>
            <div className="flex gap-2 mt-2">
              {QUICK_AMOUNTS.map((a) => (
                <button key={a} onClick={() => setAmount(a)}
                  className={`flex-1 py-1.5 rounded-lg text-xs border transition-colors ${
                    amount === a ? 'bg-brand-600 border-brand-500 text-white' : 'bg-secondary border-border hover:border-brand-600'
                  }`}>
                  R${a}
                </button>
              ))}
            </div>
          </div>

          {/* PIX QR Code result */}
          {pixResult && (
            <div className="bg-secondary border border-border rounded-xl p-5 text-center space-y-3">
              <p className="font-semibold text-brand-400">PIX Gerado!</p>
              <div className="bg-white rounded-lg p-4 max-w-[200px] mx-auto">
                <div className="w-full aspect-square bg-gray-200 flex items-center justify-center text-gray-500 text-xs">
                  QR Code
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Chave PIX</p>
                <p className="font-mono text-sm mt-0.5">{pixResult.key}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Válido por 30 minutos. Após o pagamento, o saldo será creditado automaticamente.
              </p>
            </div>
          )}

          {!pixResult && (
            <button
              onClick={() => depositMutation.mutate()}
              disabled={depositMutation.isPending || amount < 20}
              className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white
                         py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {depositMutation.isPending ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>Depositar {formatCurrency(amount)}</>
              )}
            </button>
          )}

          <p className="text-xs text-muted-foreground text-center">
            Depósito mínimo: R$ 20,00 • Máximo: R$ 50.000
          </p>
        </div>
      )}

      {/* Withdraw */}
      {tab === 'withdraw' && (
        <div className="space-y-4">
          <div className="bg-secondary/50 border border-border rounded-xl p-4 text-sm text-muted-foreground">
            Saques são processados em até 24 horas via PIX.
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Tipo de Chave PIX</label>
            <select
              value={pixKeyType}
              onChange={(e) => setPixKeyType(e.target.value)}
              className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-sm
                         focus:outline-none focus:border-brand-500"
            >
              <option value="CPF">CPF</option>
              <option value="EMAIL">Email</option>
              <option value="PHONE">Telefone</option>
              <option value="RANDOM">Chave Aleatória</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Chave PIX</label>
            <input
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
              placeholder={pixKeyType === 'CPF' ? '12345678901' : pixKeyType === 'EMAIL' ? 'seu@email.com' : 'Sua chave'}
              className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-sm
                         focus:outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Valor do saque</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Math.max(30, Number(e.target.value)))}
                min={30}
                max={Math.min(10000, user?.balance || 0)}
                className="w-full bg-secondary border border-border rounded-lg pl-10 pr-4 py-3 text-sm
                           focus:outline-none focus:border-brand-500 font-bold"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Disponível: {formatCurrency(user?.balance || 0)} • Mínimo: R$ 30 • Máximo: R$ 10.000
            </p>
          </div>

          <button
            onClick={() => withdrawMutation.mutate()}
            disabled={withdrawMutation.isPending || !pixKey || amount < 30 || amount > (user?.balance || 0)}
            className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white
                       py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {withdrawMutation.isPending ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>Solicitar Saque de {formatCurrency(amount)}</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
