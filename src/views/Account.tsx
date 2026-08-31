import { useState } from 'react';
import { Eye, EyeOff, Loader2, LogOut, User, Mail, Phone, Lock, KeyRound, Check, Store } from 'lucide-react';
import { useCustomerAuth } from '@/store/CustomerAuthContext';
import { useAdminAuth } from '@/store/AdminAuthContext';
import { useRouter } from '@/store/Router';
import { PageHeader } from '@/components/PageHeader';

export function Account() {
  const { user, profile, loading, signUp, signIn, signOut, updateProfile, changePassword } = useCustomerAuth();
  const { isAdmin } = useAdminAuth();
  const { navigate, navigateAdmin } = useRouter();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-sky-500" />
      </div>
    );
  }

  if (!user) {
    return <AuthForms onSignedIn={() => {
      // Admin redirect is handled by the onAuthStateChange listener in
      // CustomerAuthContext which fires immediately after signIn resolves.
    }} />;
  }

  return (
    <ProfileView
      profile={profile}
      email={user.email ?? ''}
      isAdmin={isAdmin}
      onGoAdmin={() => navigateAdmin({ name: 'dashboard' })}
      onSignOut={() => signOut().then(() => navigate({ name: 'home' }))}
      onUpdate={updateProfile}
      onChangePassword={changePassword}
    />
  );
}

function AuthForms({ onSignedIn }: { onSignedIn: () => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { signIn, signUp } = useCustomerAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'signup' && password !== confirmPassword) {
      setError('As senhas não coincidem. Digite novamente.');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'login') {
        await signIn(email.trim(), password);
      } else {
        await signUp(email.trim(), password, fullName.trim(), phone.trim());
      }
      onSignedIn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      // Never distinguish "this e-mail already has an account" from any other
      // sign-up failure: a different response for an existing address turns this
      // form into a way of testing whether someone is a customer. Messages about
      // the quality of the input are fine, because they reveal nothing about
      // whether the account exists.
      if (msg.includes('Password should be') || msg.includes('password')) {
        setError('A senha precisa ter pelo menos 6 caracteres.');
      } else if (msg.includes('email') && msg.includes('invalid')) {
        setError('O e-mail informado não é válido.');
      } else if (mode === 'login') {
        setError('E-mail ou senha incorretos.');
      } else {
        setError(
          'Não foi possível concluir o cadastro com esses dados. Se você já tem uma conta, use a aba "Entrar".'
        );
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fade-in mx-auto max-w-md">
      <PageHeader title="Minha conta" subtitle="Entre ou crie sua conta para acompanhar seus pedidos." />

      <div className="rounded-2xl border border-sand-200 bg-white p-6 shadow-soft">
        <div className="mb-5 flex gap-1 rounded-full bg-sand-100 p-1">
          <button
            onClick={() => { setMode('login'); setError(null); }}
            className={`flex-1 rounded-full py-2 text-sm font-medium transition ${
              mode === 'login' ? 'bg-white text-navy-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            Entrar
          </button>
          <button
            onClick={() => { setMode('signup'); setError(null); }}
            className={`flex-1 rounded-full py-2 text-sm font-medium transition ${
              mode === 'signup' ? 'bg-white text-navy-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            Criar conta
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'signup' && (
            <>
              <Field label="Nome" icon={<User className="h-4 w-4" />}>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Seu nome"
                  required
                  className="w-full rounded-xl border border-sand-200 bg-white px-4 py-3 pl-10 text-sm focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
                />
              </Field>
              <Field label="WhatsApp" icon={<Phone className="h-4 w-4" />}>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(00) 00000-0000"
                  required
                  inputMode="tel"
                  className="w-full rounded-xl border border-sand-200 bg-white px-4 py-3 pl-10 text-sm focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
                />
              </Field>
            </>
          )}
          <Field label="E-mail" icon={<Mail className="h-4 w-4" />}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              className="w-full rounded-xl border border-sand-200 bg-white px-4 py-3 pl-10 text-sm focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
          </Field>
          <Field label="Senha" icon={<Lock className="h-4 w-4" />}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="w-full rounded-xl border border-sand-200 bg-white px-4 py-3 pl-10 pr-10 text-sm focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
            <PasswordToggle
              visible={showPassword}
              onToggle={() => setShowPassword((v) => !v)}
            />
          </Field>
          {mode === 'signup' && (
            <Field label="Confirmar senha" icon={<Lock className="h-4 w-4" />}>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full rounded-xl border border-sand-200 bg-white px-4 py-3 pl-10 pr-10 text-sm focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
              />
              <PasswordToggle
                visible={showConfirmPassword}
                onToggle={() => setShowConfirmPassword((v) => !v)}
              />
            </Field>
          )}

          {error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-navy-700 px-5 py-3.5 text-sm font-medium text-white transition hover:bg-navy-800 disabled:opacity-60"
          >
            {busy ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar minha conta'}
          </button>
        </form>
      </div>
    </div>
  );
}

function ProfileView({
  profile,
  email,
  isAdmin,
  onGoAdmin,
  onSignOut,
  onUpdate,
  onChangePassword,
}: {
  profile: { fullName: string; phone: string; email: string } | null;
  email: string;
  isAdmin: boolean;
  onGoAdmin: () => void;
  onSignOut: () => void;
  onUpdate: (fullName: string, phone: string) => Promise<void>;
  onChangePassword: (newPassword: string) => Promise<void>;
}) {
  const [fullName, setFullName] = useState(profile?.fullName ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await onUpdate(fullName.trim(), phone.trim());
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError('Não foi possível salvar suas informações. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);

    if (newPassword.length < 6) {
      setPwError('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPwError('As senhas não coincidem. Digite novamente.');
      return;
    }

    setPwBusy(true);
    try {
      await onChangePassword(newPassword);
      setPwSaved(true);
      setNewPassword('');
      setConfirmNewPassword('');
      setShowPasswordForm(false);
      setTimeout(() => setPwSaved(false), 3000);
    } catch {
      setPwError('Não foi possível alterar a senha. Tente novamente.');
    } finally {
      setPwBusy(false);
    }
  };

  return (
    <div className="fade-in mx-auto max-w-md">
      <PageHeader title="Minha conta" subtitle="Gerencie seus dados pessoais." />

      <div className="rounded-2xl border border-sand-200 bg-white p-6 shadow-soft">
        <form onSubmit={handleSave} className="space-y-3">
          <Field label="Nome" icon={<User className="h-4 w-4" />}>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Seu nome"
              className="w-full rounded-xl border border-sand-200 bg-white px-4 py-3 pl-10 text-sm focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
          </Field>
          <Field label="WhatsApp" icon={<Phone className="h-4 w-4" />}>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(00) 00000-0000"
              inputMode="tel"
              className="w-full rounded-xl border border-sand-200 bg-white px-4 py-3 pl-10 text-sm focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
          </Field>
          <Field label="E-mail" icon={<Mail className="h-4 w-4" />}>
            <input
              value={email}
              readOnly
              className="w-full cursor-not-allowed rounded-xl border border-sand-200 bg-sand-50 px-4 py-3 pl-10 text-sm text-gray-500"
            />
          </Field>

          {error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>
          )}
          {saved && (
            <p className="rounded-lg bg-aqua-50 px-3 py-2 text-xs text-aqua-700">Dados salvos!</p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-full bg-navy-700 px-5 py-3.5 text-sm font-medium text-white transition hover:bg-navy-800 disabled:opacity-60"
          >
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </form>

        {/* Change password */}
        <div className="mt-4 border-t border-sand-200 pt-4">
          {pwSaved && (
            <p className="mb-3 flex items-center gap-2 rounded-lg bg-aqua-50 px-3 py-2 text-xs text-aqua-700">
              <Check className="h-3.5 w-3.5" /> Senha alterada com sucesso!
            </p>
          )}
          {!showPasswordForm ? (
            <button
              onClick={() => setShowPasswordForm(true)}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-sand-200 px-5 py-3 text-sm text-navy-700 transition hover:border-sky-200 hover:text-sky-600"
            >
              <KeyRound className="h-4 w-4" /> Alterar senha
            </button>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-3">
              <Field label="Nova senha" icon={<Lock className="h-4 w-4" />}>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full rounded-xl border border-sand-200 bg-white px-4 py-3 pl-10 pr-10 text-sm focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
                />
                <PasswordToggle
                  visible={showNewPassword}
                  onToggle={() => setShowNewPassword((v) => !v)}
                />
              </Field>
              <Field label="Confirmar nova senha" icon={<Lock className="h-4 w-4" />}>
                <input
                  type={showConfirmNewPassword ? 'text' : 'password'}
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full rounded-xl border border-sand-200 bg-white px-4 py-3 pl-10 pr-10 text-sm focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
                />
                <PasswordToggle
                  visible={showConfirmNewPassword}
                  onToggle={() => setShowConfirmNewPassword((v) => !v)}
                />
              </Field>

              {pwError && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{pwError}</p>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordForm(false);
                    setNewPassword('');
                    setConfirmNewPassword('');
                    setPwError(null);
                  }}
                  className="flex-1 rounded-full border border-sand-200 px-4 py-2.5 text-sm text-navy-800 transition hover:bg-sand-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={pwBusy}
                  className="flex-1 rounded-full bg-navy-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-navy-800 disabled:opacity-60"
                >
                  {pwBusy ? 'Alterando...' : 'Confirmar nova senha'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Admin access — only visible to admin users */}
        {isAdmin && (
          <button
            onClick={onGoAdmin}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-5 py-3 text-sm font-medium text-sky-700 transition hover:bg-sky-100"
          >
            <Store className="h-4 w-4" /> Gestão da loja
          </button>
        )}

        {/* Logout */}
        <button
          onClick={onSignOut}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-sand-200 px-5 py-3 text-sm text-gray-500 transition hover:border-rose-200 hover:text-rose-600"
        >
          <LogOut className="h-4 w-4" /> Sair da conta
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-gray-500">{label}</span>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          {icon}
        </span>
        {children}
      </div>
    </label>
  );
}

function PasswordToggle({
  visible,
  onToggle,
}: {
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-400 transition hover:text-navy-700"
    >
      {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );
}
