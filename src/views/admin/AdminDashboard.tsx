import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  DollarSign,
  Package,
  PackageCheck,
  PackageX,
  Clock,
  ChefHat,
  TrendingUp,
  Receipt,
  Percent,
  ShoppingBag,
  Info,
  Warehouse,
  Coins,
} from 'lucide-react';
import type { Order } from '@/types';
import { ORDER_STATUS_LABELS, formatCurrency, formatDate } from '@/types';
import { adminFetchStats, adminFetchOrders, adminFetchStockFinancials, type DashboardStats, type StockFinancials } from '@/lib/admin';
import { AdminLayout } from './AdminLayout';
import { useRouter } from '@/store/Router';

const STATUS_STYLES: Record<Order['status'], string> = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-sky-100 text-sky-700',
  preparing: 'bg-sky-100 text-sky-700',
  ready: 'bg-violet-100 text-violet-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-rose-100 text-rose-700',
};

export function AdminDashboard() {
  const { navigateAdmin } = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [stockFin, setStockFin] = useState<StockFinancials | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [stockLoading, setStockLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([adminFetchStats(), adminFetchOrders()])
      .then(([s, o]) => {
        if (cancelled) return;
        setStats(s);
        setRecentOrders(o.slice(0, 5));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch stock financials (separate, with optional date filter)
  useEffect(() => {
    let cancelled = false;
    setStockLoading(true);
    adminFetchStockFinancials(dateFrom || undefined, dateTo || undefined)
      .then((data) => {
        if (!cancelled) setStockFin(data);
      })
      .catch(() => {
        if (!cancelled) setStockFin({ invested: 0, potential: 0, profit: 0 });
      })
      .finally(() => {
        if (!cancelled) setStockLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dateFrom, dateTo]);

  const goToProducts = (filter?: string) => {
    const url = filter ? `/admin/produtos?filtro=${filter}` : '/admin/produtos';
    window.history.pushState({}, '', url);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const goToOrders = (filter?: string) => {
    const url = filter ? `/admin/pedidos?status=${filter}` : '/admin/pedidos';
    window.history.pushState({}, '', url);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <AdminLayout current="dashboard">
      <div className="fade-in">
        <h1 className="font-display text-2xl font-semibold text-navy-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Visão geral da loja em tempo real.</p>

        {/* Operational stat cards */}
        <h2 className="mt-6 mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Operacional</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <StatCard
            icon={<Package className="h-5 w-5" />}
            label="Produtos cadastrados"
            value={loading ? '—' : String(stats?.totalProducts ?? 0)}
            onClick={() => goToProducts()}
          />
          <StatCard
            icon={<PackageCheck className="h-5 w-5" />}
            label="Produtos ativos"
            value={loading ? '—' : String(stats?.activeProducts ?? 0)}
            onClick={() => goToProducts('ativos')}
          />
          <StatCard
            icon={<PackageX className="h-5 w-5" />}
            label="Sem estoque"
            value={loading ? '—' : String(stats?.outOfStock ?? 0)}
            variant={stats && stats.outOfStock > 0 ? 'warning' : 'default'}
            onClick={() => goToProducts('sem-estoque')}
          />
          <StatCard
            icon={<AlertTriangle className="h-5 w-5" />}
            label="Estoque baixo"
            value={loading ? '—' : String(stats?.lowStock ?? 0)}
            variant={stats && stats.lowStock > 0 ? 'warning' : 'default'}
            onClick={() => goToProducts('estoque-baixo')}
          />
          <StatCard
            icon={<Clock className="h-5 w-5" />}
            label="Aguardando confirmação"
            value={loading ? '—' : String(stats?.receivedOrders ?? 0)}
            onClick={() => goToOrders('pending')}
          />
          <StatCard
            icon={<ChefHat className="h-5 w-5" />}
            label="Em separação"
            value={loading ? '—' : String(stats?.preparingOrders ?? 0)}
            onClick={() => goToOrders('preparing')}
          />
        </div>

        {/* Open orders value — operational, NOT financial */}
        <button
          onClick={() => goToOrders()}
          className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-sand-200 bg-white p-4 text-left shadow-soft transition hover:border-sky-200 hover:shadow-card"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <ShoppingBag className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs text-gray-500">Valor dos pedidos em aberto</p>
            <p className="font-display text-xl font-semibold text-navy-900">
              {loading ? '—' : formatCurrency(stats?.openOrdersValue ?? 0)}
            </p>
          </div>
        </button>

        {/* Stock financial view */}
        <h2 className="mt-6 mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Estoque atual
        </h2>
        <div className="rounded-2xl border border-sand-200 bg-white p-4 shadow-soft">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <label className="flex items-center gap-1.5 text-xs text-gray-500">
              Data inicial
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-lg border border-sand-200 bg-white px-2 py-1 text-xs text-navy-900 focus:border-sky-300 focus:outline-none"
              />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-gray-500">
              Data final
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-lg border border-sand-200 bg-white px-2 py-1 text-xs text-navy-900 focus:border-sky-300 focus:outline-none"
              />
            </label>
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(''); setDateTo(''); }}
                className="text-xs text-sky-600 hover:underline"
              >
                Limpar
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FinCard
              icon={<Coins className="h-5 w-5" />}
              label="Valor investido no estoque"
              value={stockLoading ? '—' : formatCurrency(stockFin?.invested ?? 0)}
              subtitle="Custo de aquisição × estoque atual"
            />
            <FinCard
              icon={<Warehouse className="h-5 w-5" />}
              label="Potencial de venda do estoque"
              value={stockLoading ? '—' : formatCurrency(stockFin?.potential ?? 0)}
              subtitle="Preço de venda × estoque atual"
            />
            <FinCard
              icon={<TrendingUp className="h-5 w-5" />}
              label="Lucro bruto potencial"
              value={stockLoading ? '—' : formatCurrency(stockFin?.profit ?? 0)}
              highlight={stockFin ? stockFin.profit >= 0 : false}
              subtitle="Potencial − investido"
            />
          </div>
        </div>

        {/* Financial indicators */}
        <h2 className="mt-6 mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Indicadores financeiros
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <FinCard
            icon={<DollarSign className="h-5 w-5" />}
            label="Faturamento realizado"
            value={loading ? '—' : formatCurrency(stats?.completedRevenue ?? 0)}
            subtitle="Pedidos concluídos"
          />
          <FinCard
            icon={<Receipt className="h-5 w-5" />}
            label="Custo dos produtos vendidos"
            value={loading ? '—' : formatCurrency(stats?.completedCOGS ?? 0)}
          />
          <FinCard
            icon={<TrendingUp className="h-5 w-5" />}
            label="Lucro bruto estimado"
            value={loading ? '—' : formatCurrency(stats?.completedProfit ?? 0)}
            highlight={stats ? stats.completedProfit >= 0 : false}
          />
          <FinCard
            icon={<Percent className="h-5 w-5" />}
            label="Margem bruta média"
            value={loading ? '—' : `${(stats?.completedMargin ?? 0).toFixed(1)}%`}
          />
          <FinCard
            icon={<ShoppingBag className="h-5 w-5" />}
            label="Ticket médio"
            value={loading ? '—' : formatCurrency(stats?.avgTicket ?? 0)}
            subtitle={`${stats?.completedOrderCount ?? 0} pedido(s) concluído(s)`}
          />
        </div>

        {/* Incomplete cost warning */}
        {stats?.hasOrdersWithUnknownCost && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <Info className="h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-xs text-amber-700">
              Existem pedidos concluídos com produtos sem custo cadastrado. O custo e o lucro
              mostrados acima podem estar subestimados. Cadastre o custo de aquisição nos produtos
              para obter valores completos.
            </p>
          </div>
        )}

        {/* Recent orders */}
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-navy-900">Pedidos recentes</h2>
            <button
              onClick={() => goToOrders()}
              className="text-xs text-sky-600 hover:underline"
            >
              Ver todos
            </button>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-sand-100" />
              ))}
            </div>
          ) : recentOrders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-sand-300 bg-white/60 p-8 text-center text-sm text-gray-500">
              Nenhum pedido ainda.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-sand-200 bg-white">
              {/* Desktop table */}
              <table className="hidden w-full text-sm sm:table">
                <thead>
                  <tr className="border-b border-sand-200 text-left text-xs text-gray-500">
                    <th className="px-4 py-3 font-medium">Pedido</th>
                    <th className="px-4 py-3 font-medium">Cliente</th>
                    <th className="px-4 py-3 font-medium">Data</th>
                    <th className="px-4 py-3 text-right font-medium">Total</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => navigateAdmin({ name: 'order-detail', id: order.id })}
                      className="cursor-pointer border-b border-sand-100 transition last:border-0 hover:bg-sand-50"
                    >
                      <td className="px-4 py-3 font-medium text-navy-900">{order.number}</td>
                      <td className="px-4 py-3 text-gray-600">{order.customer_name}</td>
                      <td className="px-4 py-3 text-gray-500">{formatDate(order.created_at)}</td>
                      <td className="px-4 py-3 text-right font-medium text-navy-900">
                        {formatCurrency(Number(order.total))}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[order.status]}`}
                        >
                          {ORDER_STATUS_LABELS[order.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Mobile cards */}
              <div className="divide-y divide-sand-100 sm:hidden">
                {recentOrders.map((order) => (
                  <button
                    key={order.id}
                    onClick={() => navigateAdmin({ name: 'order-detail', id: order.id })}
                    className="flex w-full items-center justify-between px-4 py-3 text-left"
                  >
                    <div>
                      <p className="text-sm font-medium text-navy-900">{order.number}</p>
                      <p className="text-xs text-gray-500">
                        {order.customer_name} · {formatDate(order.created_at)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-navy-900">
                        {formatCurrency(Number(order.total))}
                      </p>
                      <span
                        className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLES[order.status]}`}
                      >
                        {ORDER_STATUS_LABELS[order.status]}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

function StatCard({
  icon,
  label,
  value,
  variant = 'default',
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  variant?: 'default' | 'warning';
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'rounded-2xl border bg-white p-4 text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-card focus:outline-none focus:ring-2 focus:ring-sky-200',
        variant === 'warning' ? 'border-amber-200' : 'border-sand-200 hover:border-sky-200',
      ].join(' ')}
    >
      <div className="flex items-center gap-2">
        <span
          className={[
            'flex h-8 w-8 items-center justify-center rounded-lg',
            variant === 'warning'
              ? 'bg-amber-100 text-amber-600'
              : 'bg-sky-100 text-sky-600',
          ].join(' ')}
        >
          {icon}
        </span>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
      <p className="mt-2 font-display text-2xl font-semibold text-navy-900">{value}</p>
    </button>
  );
}

function FinCard({
  icon,
  label,
  value,
  subtitle,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={[
        'rounded-2xl border p-4 shadow-soft',
        highlight ? 'border-emerald-200 bg-emerald-50/40' : 'border-sand-200 bg-white',
      ].join(' ')}
    >
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-100 text-navy-600">
          {icon}
        </span>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
      <p className="mt-2 font-display text-xl font-semibold text-navy-900">{value}</p>
      {subtitle && <p className="mt-0.5 text-[10px] text-gray-400">{subtitle}</p>}
    </div>
  );
}
