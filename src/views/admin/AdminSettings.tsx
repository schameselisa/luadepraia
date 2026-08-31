import { ExternalLink, Moon, Settings } from 'lucide-react';
import { useAdminAuth } from '@/store/AdminAuthContext';
import { useRouter } from '@/store/Router';
import { AdminLayout } from './AdminLayout';

export function AdminSettings() {
  const { user } = useAdminAuth();
  const { navigate } = useRouter();

  return (
    <AdminLayout current="settings">
      <div className="fade-in">
        <h1 className="font-display text-2xl font-semibold text-plum-900">Configurações</h1>
        <p className="mt-1 text-sm text-plum-700/50">
          Configurações da loja e da conta administrativa.
        </p>

        <div className="mt-5 space-y-4">
          {/* Store info */}
          <div className="rounded-2xl border border-sand-200 bg-white p-5 shadow-soft">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-blush-500" />
              <h2 className="font-display text-lg font-semibold text-plum-900">Loja</h2>
            </div>
            <div className="mt-3 space-y-2 text-sm">
              <Row label="Nome" value="Lua de Praia 🌙" />
              <Row label="Slogan" value="Acessórios em aço inoxidável" />
              <Row label="Moeda" value="Real (R$)" />
            </div>
            <button
              onClick={() => navigate({ name: 'home' })}
              className="mt-4 inline-flex items-center gap-2 text-sm text-blush-600 hover:underline"
            >
              Ver loja pública <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Admin account */}
          <div className="rounded-2xl border border-sand-200 bg-white p-5 shadow-soft">
            <div className="flex items-center gap-2">
              <Moon className="h-5 w-5 text-blush-500" />
              <h2 className="font-display text-lg font-semibold text-plum-900">Conta admin</h2>
            </div>
            <div className="mt-3 space-y-2 text-sm">
              <Row label="E-mail" value={user?.email ?? '—'} />
              <Row label="Papel" value="Administradora" />
            </div>
          </div>

          {/* Future features placeholder */}
          <div className="rounded-2xl border border-dashed border-sand-300 bg-white/60 p-5">
            <h2 className="font-display text-lg font-semibold text-plum-900">Em breve</h2>
            <p className="mt-1 text-sm text-plum-700/50">
              Cupons de desconto, integração com WhatsApp, pagamentos (Pix, cartão, Mercado Pago),
              frete, relatórios de vendas e controle financeiro.
            </p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-plum-700/50">{label}</span>
      <span className="font-medium text-plum-900">{value}</span>
    </div>
  );
}
