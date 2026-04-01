import { NavLink } from 'react-router-dom';
import { Home, Zap, Trophy, BarChart3, Gift, Star, Tv, Dumbbell } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

const MAIN_LINKS = [
  { to: '/', icon: Home, label: 'Início', end: true },
  { to: '/live', icon: Zap, label: 'Ao Vivo', badge: 'live' },
  { to: '/sports', icon: Trophy, label: 'Esportes' },
  { to: '/promotions', icon: Gift, label: 'Promoções' },
];

const SPORT_ICONS: Record<string, string> = {
  futebol: '⚽',
  basquete: '🏀',
  tenis: '🎾',
  nfl: '🏈',
  mma: '🥊',
  esports: '🎮',
};

export default function Sidebar() {
  const { data } = useQuery({
    queryKey: ['sports'],
    queryFn: async () => {
      const res = await api.get('/games/sports');
      return res.data.sports;
    },
    staleTime: 300_000,
  });

  return (
    <aside className="hidden lg:flex flex-col w-56 shrink-0 border-r border-border bg-card/50 min-h-full">
      <div className="p-3 flex flex-col gap-1">
        {MAIN_LINKS.map(({ to, icon: Icon, label, badge, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `nav-link text-sm font-medium ${isActive ? 'active' : ''}`
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
            {badge === 'live' && <span className="live-dot ml-auto" />}
          </NavLink>
        ))}

        {/* Sports list */}
        {data && data.length > 0 && (
          <>
            <div className="mt-4 mb-1 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Esportes
            </div>
            {data.map((sport: any) => (
              <NavLink
                key={sport.id}
                to={`/sports?s=${sport.slug}`}
                className={({ isActive }) =>
                  `nav-link text-sm ${isActive ? 'active' : ''}`
                }
              >
                <span className="text-base">{SPORT_ICONS[sport.slug] || '🏆'}</span>
                <span className="truncate">{sport.name}</span>
                {sport._count?.games > 0 && (
                  <span className="ml-auto text-xs text-muted-foreground bg-secondary rounded-full px-1.5 py-0.5">
                    {sport._count.games}
                  </span>
                )}
              </NavLink>
            ))}
          </>
        )}
      </div>

      {/* Responsible gambling footer */}
      <div className="mt-auto p-3 border-t border-border">
        <p className="text-xs text-muted-foreground text-center leading-relaxed">
          Jogue com responsabilidade.<br />
          +18 anos. Conteúdo educacional.
        </p>
      </div>
    </aside>
  );
}
