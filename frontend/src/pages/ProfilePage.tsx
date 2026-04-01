import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { formatDate } from '@/lib/utils';
import { User, Lock, Shield } from 'lucide-react';
import toast from 'react-hot-toast';

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Obrigatório'),
  newPassword: z.string()
    .min(8, 'Mínimo 8 caracteres')
    .regex(/[A-Z]/, 'Uma maiúscula')
    .regex(/[0-9]/, 'Um número')
    .regex(/[^A-Za-z0-9]/, 'Um especial'),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: 'Senhas não coincidem', path: ['confirmPassword'],
});

export default function ProfilePage() {
  const { user, refreshUser } = useAuthStore();
  const [tab, setTab] = useState<'info' | 'password' | 'security'>('info');

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(passwordSchema),
  });

  const passwordMutation = useMutation({
    mutationFn: async (data: any) => api.patch('/users/change-password', data),
    onSuccess: () => { toast.success('Senha alterada!'); reset(); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erro'),
  });

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold">Meu Perfil</h1>

      {/* Avatar */}
      <div className="bg-card border border-border rounded-xl p-6 flex items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-brand-700 flex items-center justify-center text-2xl font-bold">
          {user.firstName[0]}{user.lastName[0]}
        </div>
        <div>
          <p className="text-xl font-bold">{user.firstName} {user.lastName}</p>
          <p className="text-muted-foreground text-sm">@{user.username}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              user.role === 'VIP' ? 'bg-gold-500/10 text-gold-400 border border-gold-500/20' :
              user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
              'bg-secondary text-muted-foreground border border-border'
            }`}>
              {user.role}
            </span>
            <span className="text-xs text-muted-foreground">Membro desde {formatDate(user.createdAt as any || new Date())}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary rounded-xl p-1">
        {[
          { id: 'info', label: 'Informações', icon: User },
          { id: 'password', label: 'Senha', icon: Lock },
          { id: 'security', label: 'Segurança', icon: Shield },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id as any)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === id ? 'bg-background text-foreground shadow' : 'text-muted-foreground hover:text-foreground'
            }`}>
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'info' && (
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          {[
            { label: 'Nome completo', value: `${user.firstName} ${user.lastName}` },
            { label: 'Email', value: user.email },
            { label: 'Username', value: `@${user.username}` },
            { label: 'Função', value: user.role },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between py-3 border-b border-border last:border-0">
              <span className="text-sm text-muted-foreground">{label}</span>
              <span className="text-sm font-medium">{value}</span>
            </div>
          ))}
        </div>
      )}

      {tab === 'password' && (
        <div className="bg-card border border-border rounded-xl p-6">
          <form onSubmit={handleSubmit((data) => passwordMutation.mutate(data))} className="space-y-4">
            {[
              { name: 'currentPassword', label: 'Senha atual', placeholder: '••••••••' },
              { name: 'newPassword', label: 'Nova senha', placeholder: 'Nova senha forte' },
              { name: 'confirmPassword', label: 'Confirmar nova senha', placeholder: 'Repita a nova senha' },
            ].map(({ name, label, placeholder }) => (
              <div key={name}>
                <label className="text-sm font-medium mb-1.5 block">{label}</label>
                <input {...register(name as any)} type="password" placeholder={placeholder}
                  className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm
                             focus:outline-none focus:border-brand-500 transition-colors" />
                {(errors as any)[name] && (
                  <p className="text-destructive text-xs mt-1">{(errors as any)[name]?.message}</p>
                )}
              </div>
            ))}
            <button type="submit" disabled={passwordMutation.isPending}
              className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white py-3 rounded-lg font-semibold transition-colors">
              {passwordMutation.isPending ? 'Alterando...' : 'Alterar Senha'}
            </button>
          </form>
        </div>
      )}

      {tab === 'security' && (
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Verificação em dois fatores (2FA)</p>
              <p className="text-xs text-muted-foreground mt-0.5">Adicione segurança extra à sua conta</p>
            </div>
            <span className="text-xs bg-secondary border border-border rounded-full px-2.5 py-1 text-muted-foreground">
              {user.twoFactorEnabled ? 'Ativo' : 'Inativo'}
            </span>
          </div>
          <div className="flex items-center justify-between py-3 border-t border-border">
            <div>
              <p className="font-medium text-sm">Sessões ativas</p>
              <p className="text-xs text-muted-foreground mt-0.5">Encerre todas as sessões ativas</p>
            </div>
            <button onClick={async () => {
              await api.post('/auth/logout-all');
              toast.success('Todas as sessões encerradas');
            }}
              className="text-xs text-destructive hover:underline">
              Encerrar todas
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
