import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, UserPlus } from 'lucide-react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

const schema = z.object({
  firstName: z.string().min(2, 'Mínimo 2 caracteres').max(50),
  lastName: z.string().min(2, 'Mínimo 2 caracteres').max(50),
  email: z.string().email('Email inválido'),
  username: z.string().min(3, 'Mínimo 3 caracteres').max(20)
    .regex(/^[a-zA-Z0-9_]+$/, 'Apenas letras, números e _'),
  cpf: z.string().length(11, 'CPF deve ter 11 dígitos').regex(/^\d+$/, 'Apenas números'),
  birthDate: z.string().refine((d) => {
    const date = new Date(d);
    const age = (Date.now() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    return age >= 18;
  }, 'Você deve ter ao menos 18 anos'),
  password: z.string()
    .min(8, 'Mínimo 8 caracteres')
    .regex(/[A-Z]/, 'Uma letra maiúscula')
    .regex(/[0-9]/, 'Um número')
    .regex(/[^A-Za-z0-9]/, 'Um caractere especial'),
  confirmPassword: z.string(),
  terms: z.boolean().refine(Boolean, 'Aceite os termos'),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Senhas não coincidem',
  path: ['confirmPassword'],
});

type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      await api.post('/auth/register', {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        username: data.username,
        cpf: data.cpf,
        birthDate: data.birthDate,
        password: data.password,
      });
      toast.success('Conta criada! Faça login para continuar.');
      navigate('/login');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  };

  const Field = ({ name, label, ...props }: any) => (
    <div>
      <label className="text-sm font-medium mb-1.5 block">{label}</label>
      <input
        {...register(name)}
        {...props}
        className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm
                   focus:outline-none focus:border-brand-500 transition-colors"
      />
      {errors[name as keyof FormData] && (
        <p className="text-destructive text-xs mt-1">
          {(errors[name as keyof FormData] as any)?.message}
        </p>
      )}
    </div>
  );

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Criar conta</h1>
      <p className="text-muted-foreground text-sm mb-6">Comece a apostar hoje mesmo</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field name="firstName" label="Nome" placeholder="João" />
          <Field name="lastName" label="Sobrenome" placeholder="Silva" />
        </div>

        <Field name="email" label="Email" type="email" placeholder="seu@email.com" />
        <Field name="username" label="Username" placeholder="joaosilva123" />

        <div className="grid grid-cols-2 gap-3">
          <Field name="cpf" label="CPF (só números)" placeholder="12345678901" maxLength={11} />
          <Field name="birthDate" label="Data de Nascimento" type="date" />
        </div>

        <div>
          <label className="text-sm font-medium mb-1.5 block">Senha</label>
          <div className="relative">
            <input
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              placeholder="Senha forte"
              className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm
                         focus:outline-none focus:border-brand-500 transition-colors pr-11"
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && <p className="text-destructive text-xs mt-1">{errors.password.message}</p>}
          <p className="text-xs text-muted-foreground mt-1">Mín. 8 chars, maiúscula, número e especial</p>
        </div>

        <Field name="confirmPassword" label="Confirmar Senha"
          type={showPassword ? 'text' : 'password'} placeholder="Repita a senha" />

        <label className="flex items-start gap-2 cursor-pointer">
          <input {...register('terms')} type="checkbox" className="mt-0.5 accent-brand-500" />
          <span className="text-xs text-muted-foreground">
            Tenho 18 anos, li e aceito os{' '}
            <a href="#" className="text-brand-400 hover:underline">Termos de Uso</a>
            {' '}e{' '}
            <a href="#" className="text-brand-400 hover:underline">Política de Privacidade</a>
          </span>
        </label>
        {errors.terms && <p className="text-destructive text-xs">{errors.terms.message}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-50
                     text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 mt-2"
        >
          {loading ? (
            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <><UserPlus className="w-4 h-4" /> Criar Conta</>
          )}
        </button>
      </form>

      <p className="text-center text-sm text-muted-foreground mt-4">
        Já tem conta?{' '}
        <Link to="/login" className="text-brand-400 font-semibold hover:underline">Entrar</Link>
      </p>
    </div>
  );
}
