import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import GameCard from '@/components/betting/GameCard';
import { Trophy, Zap, Shield, Star, ArrowRight } from 'lucide-react';

export default function HomePage() {
  const { data: liveGames } = useQuery({
    queryKey: ['live-games'],
    queryFn: async () => (await api.get('/games/live')).data.games,
    refetchInterval: 30_000,
  });

  const { data: upcomingData } = useQuery({
    queryKey: ['upcoming-games', ''],
    queryFn: async () => (await api.get('/games/upcoming?limit=6')).data,
  });

  return (
    <div className="space-y-10">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-brand-950 to-dark-800 border border-brand-800/50 rounded-2xl p-8 md:p-12">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-brand-500/10 border border-brand-500/30 rounded-full px-3 py-1 text-brand-400 text-sm font-medium mb-4">
            <span className="live-dot" /> Apostas ao vivo disponíveis
          </div>
          <h1 className="text-4xl md:text-5xl font-black mb-4 leading-tight">
            Aposte nos melhores<br />
            <span className="text-brand-400">esportes do mundo</span>
          </h1>
          <p className="text-muted-foreground text-lg mb-6">
            Odds competitivas, pagamentos rápidos via PIX e a emoção do futebol ao vivo.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/register"
              className="bg-brand-600 hover:bg-brand-500 text-white px-6 py-3 rounded-xl font-semibold transition-colors flex items-center gap-2">
              Criar Conta Grátis <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/sports"
              className="bg-secondary border border-border text-foreground px-6 py-3 rounded-xl font-semibold transition-colors hover:border-brand-600">
              Ver Jogos
            </Link>
          </div>
        </div>

        {/* Decorative */}
        <div className="absolute right-0 top-0 w-64 h-full opacity-10 pointer-events-none flex items-center justify-center text-8xl">
          ⚽🏀🎾
        </div>
      </div>

      {/* Features */}
      <div className="grid sm:grid-cols-3 gap-4">
        {[
          { icon: Zap, title: 'Apostas Ao Vivo', desc: 'Odds em tempo real com atualizações ao vivo', color: 'text-red-400' },
          { icon: Shield, title: '100% Seguro', desc: 'Plataforma com criptografia SSL e proteção avançada', color: 'text-brand-400' },
          { icon: Star, title: 'Bônus de Boas-vindas', desc: '100% no primeiro depósito até R$ 500', color: 'text-gold-400' },
        ].map(({ icon: Icon, title, desc, color }) => (
          <div key={title} className="bg-card border border-border rounded-xl p-5 flex gap-4">
            <div className={`w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0 ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-sm">{title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Live games */}
      {liveGames && liveGames.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span className="live-dot" /> Ao Vivo
            </h2>
            <Link to="/live" className="text-brand-400 text-sm hover:underline flex items-center gap-1">
              Ver todos <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {liveGames.slice(0, 4).map((game: any) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        </section>
      )}

      {/* Upcoming games */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Trophy className="w-5 h-5 text-brand-400" /> Próximos Jogos
          </h2>
          <Link to="/sports" className="text-brand-400 text-sm hover:underline flex items-center gap-1">
            Ver todos <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {upcomingData?.games?.slice(0, 6).map((game: any) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      </section>

      {/* Promo banner */}
      <div className="bg-gradient-to-r from-gold-600/10 to-gold-400/10 border border-gold-500/20 rounded-2xl p-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-gold-400 font-bold text-lg">🎁 Bônus de Boas-vindas</p>
          <p className="text-muted-foreground text-sm mt-1">
            Deposite R$ 50 e ganhe R$ 50 de bônus. Use o código <strong className="text-gold-400">BEMBVINDO100</strong>
          </p>
        </div>
        <Link to="/register"
          className="shrink-0 bg-gold-500 hover:bg-gold-400 text-black px-5 py-2.5 rounded-xl font-bold text-sm transition-colors">
          Resgatar
        </Link>
      </div>
    </div>
  );
}
