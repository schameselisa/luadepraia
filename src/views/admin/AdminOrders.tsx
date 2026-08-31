import { useEffect, useState } from 'react';
import { Package } from 'lucide-react';
import type { Order, OrderStatus } from '@/types';
import { ORDER_STATUS_LABELS, formatCurrency, formatDate } from '@/types';
import { adminFetchOrders } from '@/lib/admin';
import { useRouter } from '@/store/Router';
import { AdminLayout } from './AdminLayout';

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-sky-100 text-sky-700',
  preparing: 'bg-sky-100 text-sky-700',
  ready: 'bg-violet-100 text-violet-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-rose-100 text-rose-700',
};

function readStatusFilterFromUrl(): OrderStatus | 'all' {
  if (typeof window === 'undefined') return 'all';
  const s = new URLSearchParams(window.location.search).get('status');
  const valid: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'];
  if (s && valid.includes(s as OrderStatus)) return s as OrderStatus;
  return 'all';
}

export function AdminOrders() {
  const { navigateAdmin } = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<OrderStatus | 'all'>(readStatusFilterFromUrl);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminFetchOrders()
      .then((data) => {
        if (!cancelled) setOrders(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered =
    filter === 'all' ? orders : orders.filter((o) => o.status === filter);

  return (
    <AdminLayout current="orders">
      <div className="fade-in">
        <h1 className="font-display text-2xl font-semibold text-navy-900">Pedidos</h1>
        <p className="mt-1 text-sm text-gray-500">Todos os pedidos da loja.</p>

        {/* Filter chips */}
        <div className="mt-4 flex flex-wrap gap-2">
          <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
            Todos
          </FilterChip>
          {(Object.keys(ORDER_STATUS_LABELS) as OrderStatus[]).map((s) => (
            <FilterChip key={s} active={filter === s} onClick={() => setFilter(s)}>
              {ORDER_STATUS_LABELS[s]}
            </FilterChip>
          ))}
        </div>

        {/* Orders */}
        <div className="mt-4 space-y-2">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-sand-100" />
            ))
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-sand-300 bg-white/60 p-10 text-center text-sm text-gray-500">
              Nenhum pedido neste filtro.
            </div>
          ) : (
            filtered.map((order) => {
              const itemCount = order.order_items?.length ?? 0;
              const totalQty = order.order_items?.reduce((s, i) => s + i.quantity, 0) ?? 0;
              return (
                <button
                  key={order.id}
                  onClick={() => navigateAdmin({ name: 'order-detail', id: order.id })}
                  className="flex w-full items-center gap-3 rounded-2xl border border-sand-200 bg-white p-4 text-left transition hover:shadow-soft"
                >
                  {/* Item count badge */}
                  <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sand-100 text-gray-400">
                    <Package className="h-5 w-5" strokeWidth={1.6} />
                    {totalQty > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-500 px-1 text-[10px] font-medium text-white">
                        {totalQty}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-navy-900">{order.number}</h3>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${STATUS_STYLES[order.status]}`}
                      >
                        {ORDER_STATUS_LABELS[order.status]}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {order.customer_name} · {formatDate(order.created_at)}
                      {itemCount > 0 && ` · ${itemCount} ${itemCount === 1 ? 'item' : 'itens'}`}
                    </p>
                  </div>
                  <span className="font-medium text-navy-900">
                    {formatCurrency(Number(order.total))}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'rounded-full border px-3 py-1.5 text-xs font-medium transition',
        active
          ? 'border-sky-300 bg-sky-100 text-sky-700'
          : 'border-sand-200 bg-white text-gray-500 hover:border-sky-200',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
