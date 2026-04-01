import { Outlet, Link } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-900/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-brand-800/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <Link to="/" className="flex items-center justify-center gap-1 mb-8">
          <span className="text-brand-500 font-black text-3xl">ITA</span>
          <span className="text-gold-400 font-black text-3xl">BET</span>
        </Link>

        <div className="bg-card border border-border rounded-2xl shadow-2xl p-8">
          <Outlet />
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Ao se registrar, você concorda com nossos{' '}
          <a href="#" className="text-brand-400 hover:underline">Termos de Uso</a>
          {' '}e{' '}
          <a href="#" className="text-brand-400 hover:underline">Política de Privacidade</a>.
          <br />Plataforma para maiores de 18 anos.
        </p>
      </div>
    </div>
  );
}
