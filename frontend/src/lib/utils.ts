import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatOdds(odds: number): string {
  return odds.toFixed(2);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function formatTime(date: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function timeUntilGame(startTime: string | Date): string {
  const diff = new Date(startTime).getTime() - Date.now();
  if (diff <= 0) return 'Ao vivo';
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d`;
  }
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}min`;
}

export function getBetStatusColor(status: string): string {
  const map: Record<string, string> = {
    PENDING: 'text-yellow-400',
    WON: 'text-green-400',
    LOST: 'text-red-400',
    VOID: 'text-gray-400',
    CASHOUT: 'text-blue-400',
  };
  return map[status] || 'text-gray-400';
}

export function getTransactionTypeLabel(type: string): string {
  const map: Record<string, string> = {
    DEPOSIT: 'Depósito',
    WITHDRAWAL: 'Saque',
    BET_STAKE: 'Aposta',
    BET_WIN: 'Prêmio',
    BET_REFUND: 'Reembolso',
    BONUS_CREDIT: 'Bônus',
    BONUS_DEBIT: 'Uso de Bônus',
  };
  return map[type] || type;
}
