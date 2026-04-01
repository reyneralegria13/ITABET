import { Link, useNavigate } from 'react-router-dom';
import { Wallet, LogOut, User, ChevronDown, Shield, Menu } from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { formatCurrency } from '@/lib/utils';
import { useBetSlipStore } from '@/stores/betSlipStore';
import toast from 'react-hot-toast';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const { selections, setOpen, isOpen } = useBetSlipStore();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    toast.success('Até logo!');
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-50 bg-dark-900/95 backdrop-blur border-b border-border">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 font-black text-xl">
            <span className="text-brand-500 text-2xl">ITA</span>
            <span className="text-gold-400">BET</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            <Link to="/sports" className="nav-link text-sm font-medium">Esportes</Link>
            <Link to="/live" className="nav-link text-sm font-medium">
              <span className="live-dot mr-1" />
              Ao Vivo
            </Link>
            <Link to="/promotions" className="nav-link text-sm font-medium">Promoções</Link>
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {isAuthenticated && user ? (
              <>
                {/* Balance */}
                <Link
                  to="/wallet"
                  className="hidden sm:flex items-center gap-2 bg-secondary border border-border
                             rounded-lg px-3 py-2 text-sm hover:border-brand-600 transition-colors"
                >
                  <Wallet className="w-4 h-4 text-brand-400" />
                  <span className="font-semibold text-brand-300">
                    {formatCurrency(user.balance)}
                  </span>
                </Link>

                {/* Bet slip button */}
                <button
                  onClick={() => setOpen(!isOpen)}
                  className="relative bg-brand-600 hover:bg-brand-500 text-white
                             rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
                >
                  Aposta Slip
                  {selections.length > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-gold-500 text-black
                                     rounded-full w-5 h-5 text-xs font-bold flex items-center justify-center">
                      {selections.length}
                    </span>
                  )}
                </button>

                {/* User menu */}
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="flex items-center gap-2 nav-link"
                  >
                    <div className="w-8 h-8 rounded-full bg-brand-700 flex items-center justify-center text-sm font-bold">
                      {user.firstName[0]}{user.lastName[0]}
                    </div>
                    <ChevronDown className="w-4 h-4 hidden sm:block" />
                  </button>

                  {menuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-56 bg-card border border-border
                                    rounded-xl shadow-xl z-50 overflow-hidden">
                      <div className="px-4 py-3 border-b border-border">
                        <p className="font-semibold text-sm">{user.firstName} {user.lastName}</p>
                        <p className="text-muted-foreground text-xs mt-0.5">{user.email}</p>
                      </div>
                      <div className="p-1">
                        <Link to="/dashboard" onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-secondary transition-colors">
                          <User className="w-4 h-4" /> Minha Conta
                        </Link>
                        <Link to="/wallet" onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-secondary transition-colors">
                          <Wallet className="w-4 h-4" /> Carteira
                        </Link>
                        {(user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') && (
                          <Link to="/admin" onClick={() => setMenuOpen(false)}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-secondary text-gold-400 transition-colors">
                            <Shield className="w-4 h-4" /> Painel Admin
                          </Link>
                        )}
                        <button onClick={handleLogout}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                                     hover:bg-destructive/10 text-destructive transition-colors">
                          <LogOut className="w-4 h-4" /> Sair
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login"
                  className="px-4 py-2 text-sm font-medium text-foreground hover:text-brand-400 transition-colors">
                  Entrar
                </Link>
                <Link to="/register"
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-semibold transition-colors">
                  Cadastrar
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
