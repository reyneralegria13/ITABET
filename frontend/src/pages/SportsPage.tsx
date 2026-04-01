import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import GameCard from '@/components/betting/GameCard';
import { Search, Filter } from 'lucide-react';
import { useState } from 'react';

export default function SportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const sportSlug = searchParams.get('s') || '';
  const [search, setSearch] = useState('');

  const { data: sportsData } = useQuery({
    queryKey: ['sports'],
    queryFn: async () => (await api.get('/games/sports')).data.sports,
    staleTime: 300_000,
  });

  const { data: gamesData, isLoading } = useQuery({
    queryKey: ['games', 'upcoming', sportSlug],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '50' });
      if (sportSlug) params.set('sport', sportSlug);
      return (await api.get(`/games/upcoming?${params}`)).data;
    },
    staleTime: 30_000,
  });

  const filteredGames = gamesData?.games?.filter((g: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      g.homeTeam.name.toLowerCase().includes(s) ||
      g.awayTeam.name.toLowerCase().includes(s) ||
      g.league?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <h1 className="text-2xl font-bold">Apostas Esportivas</h1>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar time ou liga..."
            className="w-full bg-secondary border border-border rounded-lg pl-9 pr-4 py-2 text-sm
                       focus:outline-none focus:border-brand-500 transition-colors"
          />
        </div>
      </div>

      {/* Sport tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setSearchParams({})}
          className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            !sportSlug ? 'bg-brand-600 text-white' : 'bg-secondary text-muted-foreground hover:text-foreground'
          }`}
        >
          Todos
        </button>
        {sportsData?.map((sport: any) => (
          <button
            key={sport.id}
            onClick={() => setSearchParams({ s: sport.slug })}
            className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
              sportSlug === sport.slug ? 'bg-brand-600 text-white' : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>{sport.icon}</span>
            {sport.name}
          </button>
        ))}
      </div>

      {/* Games grid */}
      {isLoading ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-5 animate-pulse h-44" />
          ))}
        </div>
      ) : filteredGames?.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground">Nenhum jogo encontrado.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {filteredGames?.map((game: any) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      )}
    </div>
  );
}
