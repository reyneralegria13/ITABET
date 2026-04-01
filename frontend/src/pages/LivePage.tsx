import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import GameCard from '@/components/betting/GameCard';
import { Zap, RefreshCw } from 'lucide-react';

export default function LivePage() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['live-games'],
    queryFn: async () => (await api.get('/games/live')).data.games,
    refetchInterval: 30_000,
    staleTime: 0,
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Ao Vivo</h1>
          <span className="live-dot" />
          {data && (
            <span className="text-sm text-muted-foreground">{data.length} jogos</span>
          )}
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      <div className="flex items-center gap-2 bg-red-500/5 border border-red-500/20 rounded-lg p-3 text-sm">
        <Zap className="w-4 h-4 text-red-400 shrink-0" />
        <p className="text-muted-foreground">Odds ao vivo. Atualização automática a cada 30 segundos.</p>
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-5 animate-pulse h-48" />
          ))}
        </div>
      ) : data?.length === 0 ? (
        <div className="text-center py-20">
          <Zap className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">Nenhum jogo ao vivo</h2>
          <p className="text-muted-foreground text-sm">Os jogos ao vivo aparecerão aqui automaticamente.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {data?.map((game: any) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      )}
    </div>
  );
}
