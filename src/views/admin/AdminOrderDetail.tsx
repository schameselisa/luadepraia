import { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, Mail, MessageCircle, Phone, User, Package, ChevronDown, Trash2, AlertTriangle } from 'lucide-react';
import type { Order, OrderStatus } from '@/types';
import {
  ORDER_STATUS_OPTIONS,
  ORDER_STATUS_LABELS,
  formatCurrency,
  formatDateTime,
} from '@/types';
import { adminFetchOrder, adminUpdateOrderStatus, adminDeleteOrder } from '@/lib/admin';
import { useRouter } from '@/store/Router';
import { buildWhatsAppUrl } from '@/lib/storeConfig';
import { AdminLayout } from './AdminLayout';

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-sky-100 text-sky-700',
  preparing: 'bg-blush-100 text-blush-700',
  ready: 'bg-violet-100 text-violet-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-rose-100 text-rose-700',
};

type Props = { orderId: string };

export function AdminOrderDetail({ orderId }: Props) {
  const { navigateAdmin } = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);

  const load = () => {
    setLoading(true);
    adminFetchOrder(orderId)
      .then((data) => setOrder(data))
      .catch(() => setError('Não foi possível carregar o pedido.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [orderId]);

  const handleStatusChange = async (newStatus: OrderStatus) => {
    if (!order || order.status === newStatus) return;
    setUpdating(true);
    setError(null);
    try {
      await adminUpdateOrderStatus(order.id, newStatus);
      load();
    } catch {
      setError('Não foi possível alterar o status.');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout current="orders">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-blush-500" />
        </div>
      </AdminLayout>
    );
  }

  if (!order) {
    return (
      <AdminLayout current="orders">
        <div className="rounded-2xl border border-blush-200 bg-blush-50 p-8 text-center">
          <p className="text-sm text-blush-700">{error ?? 'Pedido não encontrado.'}</p>
          <button
            onClick={() => navigateAdmin({ name: 'orders' })}
            className="mt-4 rounded-full bg-blush-500 px-4 py-2 text-sm text-white"
          >
            Voltar para pedidos
          </button>
        </div>
      </AdminLayout>
    );
  }

  const adminWaMessage =
    `Oi, ${order.customer_name}! Tudo bem? 💗\n\n` +
    `Aqui é da Lua de Praia 🌙\n\n` +
    `Recebemos seu pedido ${order.number}, no valor de ${formatCurrency(Number(order.total))}.\n\n` +
    `Vou confirmar as peças para você e por aqui combinamos o pagamento e a retirada.\n\n` +
    `Obrigada por escolher a Lua de Praia! ✨`;

  const customerWaUrl = order.customer_phone
    ? buildWhatsAppUrl(order.customer_phone, adminWaMessage)
    : null;

  return (
    <AdminLayout current="orders">
      <div className="fade-in">
        <button
          onClick={() => navigateAdmin({ name: 'orders' })}
          className="mb-4 inline-flex items-center gap-2 text-sm text-plum-700/60 transition hover:text-plum-900"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para pedidos
        </button>

        {/* Header with order number + status dropdown */}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-semibold text-plum-900">{order.number}</h1>
          <div className="relative inline-flex items-center">
            <select
              value={order.status}
              onChange={(e) => handleStatusChange(e.target.value as OrderStatus)}
              disabled={updating}
              className={`cursor-pointer appearance-none rounded-full border-0 py-1.5 pl-3 pr-9 text-xs font-medium transition disabled:opacity-60 ${STATUS_STYLES[order.status]}`}
            >
              {ORDER_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-60" />
          </div>
          {updating && (
            <Loader2 className="h-4 w-4 animate-spin text-blush-500" />
          )}
        </div>
        <p className="mt-1 text-sm text-plum-700/50">{formatDateTime(order.created_at)}</p>

        {error && (
          <p className="mt-3 rounded-lg bg-blush-50 px-3 py-2 text-xs text-blush-700">{error}</p>
        )}

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {/* Customer info */}
          <div className="rounded-2xl border border-sand-200 bg-white p-5 shadow-soft">
            <h2 className="font-display text-lg font-semibold text-plum-900">Cliente</h2>
            <div className="mt-3 space-y-2 text-sm">
              <InfoRow icon={<User className="h-4 w-4" />} label="Nome" value={order.customer_name} />
              {order.customer_email && (
                <InfoRow
                  icon={<Mail className="h-4 w-4" />}
                  label="E-mail"
                  value={order.customer_email}
                />
              )}
              {order.customer_phone && (
                <InfoRow
                  icon={<Phone className="h-4 w-4" />}
                  label="Telefone"
                  value={order.customer_phone}
                />
              )}
            </div>
            {customerWaUrl && (
              <a
                href={customerWaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 flex items-center justify-center gap-2 rounded-full bg-[#25D366] px-4 py-2.5 text-xs font-medium text-white transition hover:bg-[#1DA851]"
              >
                <MessageCircle className="h-4 w-4" />
                Chamar no WhatsApp
              </a>
            )}
          </div>

          {/* Items */}
          <div className="rounded-2xl border border-sand-200 bg-white p-5 shadow-soft lg:col-span-2">
            <h2 className="font-display text-lg font-semibold text-plum-900">Produtos</h2>
            <div className="mt-3 space-y-3">
              {order.order_items?.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-3 rounded-xl border border-sand-100 bg-sand-50/50 p-3"
                >
                  {/* Image */}
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-sand-100 sm:h-20 sm:w-20">
                    {item.product_image_url ? (
                      <img
                        src={item.product_image_url}
                        alt={item.product_name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-plum-700/30">
                        <Package className="h-6 w-6" />
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-medium text-plum-900">
                          {item.product_name}
                        </h3>
                        <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-plum-700/50">
                          {item.product_category_name && (
                            <span>{item.product_category_name}</span>
                          )}
                          {item.product_color && (
                            <>
                              <span className="text-plum-700/30">·</span>
                              <span>{item.product_color}</span>
                            </>
                          )}
                          {item.product_size_label && (
                            <>
                              <span className="text-plum-700/30">·</span>
                              <span className="font-medium text-plum-900">{item.product_size_label}</span>
                            </>
                          )}
                          {item.product_internal_code && (
                            <>
                              <span className="text-plum-700/30">·</span>
                              <span className="font-medium text-plum-700/70">
                                {item.product_internal_code}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-3 text-xs text-plum-700/60">
                        <span>
                          Qtde: <strong className="text-plum-900">{item.quantity}</strong>
                        </span>
                        <span>
                          Unit: <strong className="text-plum-900">{formatCurrency(Number(item.unit_price))}</strong>
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-plum-900">
                        {formatCurrency(Number(item.subtotal))}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-sand-200 pt-3">
              <span className="text-sm font-medium text-plum-700/70">Total</span>
              <span className="font-display text-xl font-semibold text-plum-900">
                {formatCurrency(Number(order.total))}
              </span>
            </div>
          </div>
        </div>

        {/* Status history */}
        <div className="mt-4 rounded-2xl border border-sand-200 bg-white p-5 shadow-soft">
          <h2 className="font-display text-lg font-semibold text-plum-900">Histórico de status</h2>
          <p className="mt-0.5 text-xs text-plum-700/50">
            Cada alteração é registrada com data e hora.
          </p>
          {order.order_status_history && order.order_status_history.length > 0 ? (
            <div className="mt-3 space-y-2">
              {[...order.order_status_history]
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .map((entry) => (
                  <div key={entry.id} className="flex items-center gap-3 text-sm">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${STATUS_STYLES[entry.status] ?? 'bg-sand-100 text-plum-700/60'}`}
                    >
                      {ORDER_STATUS_LABELS[entry.status] ?? entry.status}
                    </span>
                    <span className="text-plum-700/50">{formatDateTime(entry.created_at)}</span>
                    {entry.note && <span className="text-plum-700/40">· {entry.note}</span>}
                  </div>
                ))}
            </div>
          ) : (
            <p className="mt-3 text-xs text-plum-700/40">Nenhuma alteração registrada.</p>
          )}
        </div>

        {/* Delete order (discreet) */}
        <div className="mt-4 flex justify-end">
          <button
            onClick={() => setShowDelete(true)}
            className="inline-flex items-center gap-1.5 text-xs text-plum-700/40 transition hover:text-rose-500"
          >
            <Trash2 className="h-3.5 w-3.5" /> Excluir pedido
          </button>
        </div>

        {/* Delete confirmation modal */}
        {showDelete && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/40 p-4 backdrop-blur-sm"
            onClick={() => {
              if (!deleting) setShowDelete(false);
            }}
          >
            <div
              className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-card"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                  <AlertTriangle className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-display text-lg font-semibold text-navy-900">
                    Excluir pedido
                  </h3>
                  <p className="text-xs text-gray-500">Esta ação não pode ser desfeita.</p>
                </div>
              </div>
              <p className="mt-4 text-sm text-gray-600">
                Esta ação excluirá permanentemente este pedido. Deseja continuar?
              </p>
              <div className="mt-4">
                <label className="text-xs font-medium text-plum-700/70">
                  Senha administrativa
                </label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Digite a senha"
                  className="mt-1 w-full rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-100"
                  disabled={deleting}
                />
              </div>
              {deleteSuccess && (
                <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  Pedido excluído com sucesso.
                </p>
              )}
              {error && showDelete && !deleteSuccess && (
                <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {error}
                </p>
              )}
              <div className="mt-5 flex gap-2">
                <button
                  onClick={() => {
                    setShowDelete(false);
                    setDeletePassword('');
                    setError(null);
                    setDeleteSuccess(false);
                  }}
                  disabled={deleting}
                  className="flex-1 rounded-full border border-sand-200 px-4 py-2.5 text-sm text-navy-800 hover:bg-sand-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    if (!deletePassword.trim()) {
                      setError('Digite a senha administrativa.');
                      return;
                    }
                    setDeleting(true);
                    setError(null);
                    try {
                      await adminDeleteOrder(order.id, deletePassword);
                      setDeleteSuccess(true);
                      setTimeout(() => navigateAdmin({ name: 'orders' }), 1000);
                    } catch (err) {
                      const msg = err instanceof Error ? err.message : '';
                      if (msg.includes('Senha incorreta')) {
                        setError('Senha incorreta.');
                      } else if (msg.includes('Não autorizado')) {
                        setError('Não autorizado.');
                      } else {
                        setError('Não foi possível excluir o pedido.');
                      }
                    } finally {
                      setDeleting(false);
                    }
                  }}
                  disabled={deleting}
                  className="flex-1 rounded-full bg-rose-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-rose-600 disabled:opacity-60"
                >
                  {deleting ? 'Excluindo...' : 'Excluir pedido'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-plum-700/40">{icon}</span>
      <span className="text-plum-700/50">{label}:</span>
      <span className="text-plum-900">{value}</span>
    </div>
  );
}
