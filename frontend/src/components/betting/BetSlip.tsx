import { useState } from 'react';
import { X, Trash2, ChevronDown, ChevronUp, Ticket } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useBetSlipStore } from '@/stores/betSlipStore';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const QUICK_STAKES = [5, 10, 25, 50, 100, 200];

export default function BetSlip() {
  const {
    selections, stake, useBonus, isOpen,
    removeSelection, clearAll, setStake, setUseBonus, setOpen,
    getTotalOdds, getPotentialWin,
  } = useBetSlipStore();

  const { user, isAuthenticated } = useAuthStore();
  const [isMinimized, setIsMinimized] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const placeBetMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/bets', {
        selections: selections.map((s) => ({ selectionId: s.selectionId })),
        stake,
        useBonus,
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success('Aposta realizada com sucesso! 🎉');
      clearAll();
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ['active-bets'] });
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Erro ao fazer aposta');
    },
  });

  if (!isOpen) return null;

  const totalOdds = getTotalOdds();
  const potentialWin = getPotentialWin();
  const balance = useBonus ? (user?.bonusBalance || 0) : (user?.balance || 0);
  const canBet = isAuthenticated && stake > 0 && stake <= balance && selections.length > 0;

  return (
    <div className="h-full bg-card border-l border-border flex flex-col pt-16">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Ticket className="w-4 h-4 text-brand-400" />
          <span className="font-semibold text-sm">Aposta Slip</span>
          {selections.length > 0 && (
            <span className="bg-brand-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {selections.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {selections.length > 0 && (
            <button onClick={clearAll} className="p-1.5 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={() => setIsMinimized(!isMinimized)} className="p-1.5 hover:bg-secondary rounded text-muted-foreground">
            {isMinimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button onClick={() => setOpen(false)} className="p-1.5 hover:bg-secondary rounded text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <div className="flex-1 overflow-y-auto flex flex-col">
          {/* Selections */}
          <div className="flex-1 p-3 space-y-2">
            {selections.length === 0 ? (
              <div className="text-center py-12">
                <Ticket className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">Selecione odds para apostar</p>
                <p className="text-xs text-muted-foreground mt-1">Clique nas odds dos jogos</p>
              </div>
            ) : (
              selections.map((sel) => (
                <div key={sel.selectionId}
                  className="bg-secondary border border-border rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground truncate">
                        {sel.homeTeam} vs {sel.awayTeam}
                      </p>
                      <p className="text-sm font-medium mt-0.5">{sel.selectionName}</p>
                      <p className="text-xs text-muted-foreground">{sel.marketName}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-brand-400 font-bold text-sm">{sel.odds.toFixed(2)}</span>
                      <button onClick={() => removeSelection(sel.selectionId)}
                        className="text-muted-foreground hover:text-destructive transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {selections.length > 0 && (
            <div className="p-3 border-t border-border space-y-3">
              {/* Odds summary */}
              <div className="bg-secondary rounded-lg p-3 space-y-1.5">
                {selections.length > 1 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Odds totais</span>
                    <span className="font-bold text-brand-400">{totalOdds.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tipo</span>
                  <span className="font-medium">{selections.length === 1 ? 'Simples' : 'Múltipla'}</span>
                </div>
              </div>

              {/* Stake */}
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-muted-foreground">Valor da aposta</span>
                  {isAuthenticated && (
                    <span className="text-xs text-muted-foreground">
                      Saldo: {formatCurrency(balance)}
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  value={stake}
                  onChange={(e) => setStake(Math.max(1, Number(e.target.value)))}
                  min={1}
                  max={50000}
                  className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm
                             font-bold text-center focus:outline-none focus:border-brand-500"
                />

                {/* Quick stakes */}
                <div className="grid grid-cols-3 gap-1.5 mt-2">
                  {QUICK_STAKES.map((s) => (
                    <button key={s} onClick={() => setStake(s)}
                      className={cn('text-xs py-1.5 rounded border transition-colors',
                        stake === s
                          ? 'bg-brand-600 border-brand-500 text-white'
                          : 'bg-secondary border-border hover:border-brand-600')}>
                      R${s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Use bonus toggle */}
              {isAuthenticated && (user?.bonusBalance || 0) > 0 && (
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-muted-foreground">Usar saldo de bônus</span>
                  <button
                    onClick={() => setUseBonus(!useBonus)}
                    className={cn('w-10 h-5 rounded-full transition-colors relative',
                      useBonus ? 'bg-brand-600' : 'bg-secondary border border-border')}
                  >
                    <span className={cn('absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all',
                      useBonus ? 'left-5' : 'left-0.5')} />
                  </button>
                </label>
              )}

              {/* Potential win */}
              <div className="bg-brand-950 border border-brand-800 rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-brand-300">Ganho potencial</span>
                  <span className="text-lg font-black text-brand-400">{formatCurrency(potentialWin)}</span>
                </div>
              </div>

              {/* Place bet button */}
              {!isAuthenticated ? (
                <button
                  onClick={() => navigate('/login')}
                  className="w-full bg-brand-600 hover:bg-brand-500 text-white py-3 rounded-lg font-semibold text-sm transition-colors">
                  Fazer Login para Apostar
                </button>
              ) : (
                <button
                  onClick={() => placeBetMutation.mutate()}
                  disabled={!canBet || placeBetMutation.isPending}
                  className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed
                             text-white py-3 rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {placeBetMutation.isPending ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>Confirmar Aposta — {formatCurrency(stake)}</>
                  )}
                </button>
              )}

              {stake > balance && isAuthenticated && (
                <p className="text-xs text-destructive text-center">Saldo insuficiente</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
