import { useState } from 'react';
import { ArrowLeft, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useAdminAuth } from '@/store/AdminAuthContext';
import { useRouter } from '@/store/Router';
import { Logo } from '@/components/Logo';

export function AdminLogin() {
  const { signIn } = useAdminAuth();
  const { navigate, navigateAdmin } = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      navigateAdmin({ name: 'dashboard' });
    } catch {
      setError('E-mail ou senha incorretos. Verifique e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-sky-50 via-sand-50 to-white px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo imgClassName="h-10 w-auto" />
          <p className="mt-2 text-sm text-navy-700/60">Painel administrativo</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-sand-200 bg-white p-6 shadow-soft"
        >
          <h1 className="font-display text-xl font-semibold text-navy-900">Entrar no painel</h1>
          <p className="mt-1 text-xs text-navy-700/50">
            Use suas credenciais de administradora para continuar.
          </p>

          <div className="mt-5 space-y-3">
            <div>
              <label className="text-xs font-medium text-navy-700/70">E-mail</label>
              <div className="relative mt-1">
                <Mail
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-700/40"
                  strokeWidth={1.6}
                />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@luadepraia.com"
                  className="w-full rounded-xl border border-sand-200 bg-white py-2.5 pl-10 pr-3 text-sm text-navy-900 placeholder:text-navy-700/30 focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-navy-700/70">Senha</label>
              <div className="relative mt-1">
                <Lock
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-700/40"
                  strokeWidth={1.6}
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-sand-200 bg-white py-2.5 pl-10 pr-10 text-sm text-navy-900 placeholder:text-navy-700/30 focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-navy-700/40 transition hover:text-navy-700"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <p className="mt-4 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-700">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-5 w-full rounded-full bg-navy-700 px-5 py-3 text-sm font-medium text-white transition hover:bg-navy-800 disabled:opacity-60"
          >
            {loading ? 'Entrando...' : 'Entrar no painel'}
          </button>
        </form>

        <button
          onClick={() => navigate({ name: 'home' })}
          className="mt-4 flex w-full items-center justify-center gap-2 text-xs text-navy-700/50 transition hover:text-navy-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para a loja
        </button>
      </div>
    </div>
  );
}
