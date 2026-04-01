import { Gift, Star, Zap, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';

const PROMOTIONS = [
  {
    id: 1,
    icon: '🎁',
    title: 'Bônus de Boas-vindas 100%',
    description: 'Deposite e ganhe 100% de bônus até R$ 500. Válido para novos usuários.',
    type: 'WELCOME_BONUS',
    badge: 'Novo usuário',
    badgeColor: 'bg-brand-500/10 text-brand-400 border-brand-500/20',
    code: 'BEMBVINDO100',
    minDeposit: 50,
    wagering: '5x',
    cta: 'Criar conta',
    ctaLink: '/register',
  },
  {
    id: 2,
    icon: '⚡',
    title: 'Odds Turbinadas — Fin. de Semana',
    description: 'Todo fim de semana, odds 20% melhores nos jogos de futebol nacional.',
    type: 'ODDS_BOOST',
    badge: 'Fim de semana',
    badgeColor: 'bg-red-500/10 text-red-400 border-red-500/20',
    code: null,
    minDeposit: 10,
    wagering: null,
    cta: 'Apostar agora',
    ctaLink: '/sports',
  },
  {
    id: 3,
    icon: '💰',
    title: 'Cashback de 10% na segunda-feira',
    description: 'Perdeu no fim de semana? Recupere 10% do seu valor apostado na segunda.',
    type: 'CASHBACK',
    badge: 'Segunda-feira',
    badgeColor: 'bg-gold-500/10 text-gold-400 border-gold-500/20',
    code: 'CASHBACK10',
    minDeposit: 50,
    wagering: '1x',
    cta: 'Saber mais',
    ctaLink: '/sports',
  },
  {
    id: 4,
    icon: '🏆',
    title: 'Aposta Grátis — R$ 20',
    description: 'Aposte em qualquer jogo sem arriscar seu saldo. Válido para depósitos acima de R$ 100.',
    type: 'FREE_BET',
    badge: 'Free Bet',
    badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    code: 'FREEBET20',
    minDeposit: 100,
    wagering: '3x',
    cta: 'Resgatar',
    ctaLink: '/wallet',
  },
];

export default function PromotionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Promoções</h1>
        <p className="text-muted-foreground text-sm">Aproveite nossas ofertas exclusivas e maximize seus ganhos.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {PROMOTIONS.map((promo) => (
          <div key={promo.id}
            className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-4 hover:border-brand-600 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <span className="text-4xl">{promo.icon}</span>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${promo.badgeColor}`}>
                {promo.badge}
              </span>
            </div>

            <div>
              <h3 className="font-bold text-lg leading-tight">{promo.title}</h3>
              <p className="text-muted-foreground text-sm mt-1.5 leading-relaxed">{promo.description}</p>
            </div>

            <div className="flex gap-4 text-xs text-muted-foreground">
              {promo.minDeposit && (
                <div>
                  <p className="font-medium text-foreground">Mín. depósito</p>
                  <p>R$ {promo.minDeposit}</p>
                </div>
              )}
              {promo.wagering && (
                <div>
                  <p className="font-medium text-foreground">Rollover</p>
                  <p>{promo.wagering}</p>
                </div>
              )}
              {promo.code && (
                <div>
                  <p className="font-medium text-foreground">Código</p>
                  <p className="font-mono text-brand-400">{promo.code}</p>
                </div>
              )}
            </div>

            <Link to={promo.ctaLink}
              className="w-full bg-brand-600 hover:bg-brand-500 text-white py-2.5 rounded-xl
                         text-sm font-semibold text-center transition-colors mt-auto">
              {promo.cta}
            </Link>
          </div>
        ))}
      </div>

      <div className="bg-secondary/50 border border-border rounded-xl p-4 text-xs text-muted-foreground">
        <p><strong className="text-foreground">Regras gerais:</strong> Promoções sujeitas a termos e condições.
        Rollover (apostas mínimas) pode ser exigido antes de saques. Válido apenas para contas verificadas.
        Plataforma destinada a maiores de 18 anos.</p>
      </div>
    </div>
  );
}
