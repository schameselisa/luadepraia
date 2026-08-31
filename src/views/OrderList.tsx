import { useEffect, useState } from 'react';
import {
  ChevronDown,
  MessageCircle,
  Package,
  Moon,
} from 'lucide-react';
import type { Order, OrderStatus } from '@/types';
import { ORDER_STATUS_LABELS, formatCurrency, formatDate } from '@/types';
import { fetchOrders } from '@/lib/data';
import { useRouter } from '@/store/Router';
import { useCustomerAuth } from '@/store/CustomerAuthContext';
import { PageHeader } from '@/components/PageHeader';
import { STORE_WHATSAPP_NUMBER, buildWhatsAppUrl } from '@/lib/storeConfig';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-sky-100 text-sky-700',
  preparing: 'bg-sky-100 text-sky-700',
  ready: 'bg-violet-100 text-violet-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-rose-100 text-rose-700',
  new: 'bg-amber-100 text-amber-700',
  received: 'bg-sky-100 text-sky-700',
  shipped: 'bg-violet-100 text-violet-700',
  delivered: 'bg-emerald-100 text-emerald-700',
};

const LEGACY_LABELS: Record<string, string> = {
  new: 'Aguardando confirmação',
  received: 'Pedido confirmado',
  shipped: 'Pronto para retirada',
  delivered: 'Concluído',
};

function statusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status as OrderStatus] ?? LEGACY_LABELS[status] ?? status;
}

function statusStyle(status: string): string {
  return STATUS_STYLES[status] ?? 'bg-sand-100 text-gray-500';
}

const TRACKING_STEPS = [
  { label: 'Pedido enviado', key: 'pending' },
  { label: 'Confirmação pelo WhatsApp', key: 'confirmed' },
  { label: 'Pagamento', key: 'preparing' },
  { label: 'Retirada combinada', key: 'completed' },
];

function getTrackingStep(status: string): number {
  if (status === 'cancelled') return -1;
  const map: Record<string, number> = {
    pending: 0,
    new: 0,
    confirmed: 1,
    received: 1,
    preparing: 2,
    ready: 2,
    completed: 3,
    delivered: 3,
  };
  return map[status] ?? 0;
}

function buildOrderWhatsAppMessage(order: Order): string {
  return (
    `Oi! Sou a ${order.customer_name} 😊\n\n` +
    `Estou entrando em contato sobre meu pedido ${order.number} na Lua de Praia 🌙\n\n` +
    `Total: ${formatCurrency(order.total)}\n\n` +
    `Gostaria de falar sobre esse pedido. 💙`
  );
}

export function OrderList() {
  const { navigate } = useRouter();
  const { user } = useCustomerAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchOrders(user.id)
      .then((data) => {
        if (!cancelled) setOrders(data);
      })
      .catch(() => {
        if (!cancelled) setError('Não foi possível carregar seus pedidos agora.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return (
    <div className="fade-in">
      <PageHeader
        title="Meus pedidos"
        subtitle="Acompanhe o status de cada pedido feito na loja."
      />

      <div className="mb-6 overflow-hidden rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50/60 to-sand-50/60 p-4 shadow-soft sm:p-6">
        <div className="flex items-center gap-2">
          <Moon className="h-5 w-5 text-sky-500" strokeWidth={1.6} />
          <h2 className="font-display text-lg font-semibold text-navy-900">
            Como funciona seu pedido? 🌙
          </h2>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-gray-500 sm:mt-3">
          Depois que você envia o pedido, a Lua de Praia confirma as peças pelo WhatsApp. O
          pagamento e a retirada são combinados diretamente por lá.
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-gray-500 sm:mt-2">
          Você pode retirar pessoalmente ou, se preferir, solicitar Uber, 99, motoboy ou outro
          serviço de entrega para fazer a retirada.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-700">
          {error}
        </div>
      )}

      {!user ? (
        <div className="rounded-2xl border border-dashed border-sand-300 bg-white/60 p-10 text-center">
          <p className="text-sm text-gray-500">
            Entre na sua conta para acompanhar seus pedidos.
          </p>
          <button
            onClick={() => navigate({ name: 'account' })}
            className="mt-4 rounded-full bg-navy-700 px-4 py-2 text-sm text-white hover:bg-navy-800"
          >
            Entrar na minha conta
          </button>
        </div>
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-sand-100" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-sand-300 bg-white/60 p-10 text-center">
          <p className="text-sm text-gray-500">Você ainda não fez nenhum pedido.</p>
          <button
            onClick={() => navigate({ name: 'home' })}
            className="mt-4 rounded-full bg-navy-700 px-4 py-2 text-sm text-white hover:bg-navy-800"
          >
            Começar a comprar
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              expanded={expandedId === order.id}
              onToggle={() =>
                setExpandedId((prev) => (prev === order.id ? null : order.id))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderCard({
  order,
  expanded,
  onToggle,
}: {
  order: Order;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isCancelled = order.status === 'cancelled';
  const trackingStep = getTrackingStep(order.status);

  const waUrl = buildWhatsAppUrl(STORE_WHATSAPP_NUMBER, buildOrderWhatsAppMessage(order));

  return (
    <div className="overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-soft transition">
      {/* Summary row — clickable */}
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 p-4 text-left transition hover:bg-sand-50/50"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-600">
            <Package className="h-5 w-5" strokeWidth={1.6} />
          </span>
          <div>
            <p className="font-display text-lg text-navy-900">{order.number}</p>
            <p className="text-xs text-gray-500">{formatDate(order.created_at)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${statusStyle(order.status)}`}
          >
            {statusLabel(order.status)}
          </span>
          <span className="text-sm font-semibold text-navy-900">
            {formatCurrency(order.total)}
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 ${
              expanded ? 'rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-sand-200 px-4 pb-4 pt-3">
          {/* Tracking */}
          <div className="mb-4 rounded-xl bg-sand-50 p-3">
            {isCancelled ? (
              <p className="text-center text-sm font-medium text-rose-600">
                Pedido cancelado
              </p>
            ) : (
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-1">
                {TRACKING_STEPS.map((step, idx) => (
                  <div key={step.key} className="flex items-center gap-1.5">
                    <div className="flex items-center gap-2 rounded-xl bg-white px-2.5 py-1.5 sm:px-3 sm:py-2">
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold sm:h-6 sm:w-6 ${
                          idx <= trackingStep
                            ? 'bg-sky-500 text-white'
                            : 'bg-sand-200 text-gray-400'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <span
                        className={`text-xs font-medium ${
                          idx <= trackingStep ? 'text-navy-800' : 'text-gray-400'
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                    {idx < TRACKING_STEPS.length - 1 && (
                      <span className="hidden text-gray-300 sm:inline" aria-hidden="true">
                        →
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Items */}
          {order.order_items && order.order_items.length > 0 && (
            <div className="space-y-2.5">
              {order.order_items.map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-sand-100">
                    {item.product_image_url ? (
                      <img
                        src={item.product_image_url}
                        alt={item.product_name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Package className="h-5 w-5 text-gray-300" strokeWidth={1.6} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-navy-900">
                      {item.product_name}
                      {item.product_color && (
                        <span className="text-gray-400"> — {item.product_color}</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">
                      {item.product_size_label && (
                        <span className="font-medium text-navy-700">{item.product_size_label} · </span>
                      )}
                      {item.quantity}× {formatCurrency(item.unit_price)}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-navy-900">
                    {formatCurrency(item.subtotal)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Total */}
          <div className="mt-3 flex items-center justify-between border-t border-sand-200 pt-3">
            <span className="text-sm font-medium text-gray-500">Total</span>
            <span className="font-display text-lg font-semibold text-navy-900">
              {formatCurrency(order.total)}
            </span>
          </div>

          {/* WhatsApp */}
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#1DA851]"
          >
            <MessageCircle className="h-4 w-4" />
            Falar sobre este pedido no WhatsApp
          </a>
        </div>
      )}
    </div>
  );
}
