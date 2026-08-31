import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Minus, Plus, ShoppingBag, Trash2, MessageCircle } from 'lucide-react';
import { effectivePrice, formatCurrency, displayName } from '@/types';
import type { CartItem } from '@/types';
import { useRouter } from '@/store/Router';
import { useCart, cartKey } from '@/store/CartContext';
import { useCustomerAuth } from '@/store/CustomerAuthContext';
import { PageHeader } from '@/components/PageHeader';
import { placeOrder } from '@/lib/data';
import { STORE_CONFIG, buildWhatsAppUrl } from '@/lib/storeConfig';

type PlacedOrder = {
  number: string;
  total: number;
  items: CartItem[];
  phone: string;
  name: string;
};

export function Cart() {
  const { items, total, setQuantity, remove, clear, maxFor } = useCart();
  const { navigate } = useRouter();
  const { profile } = useCustomerAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [placing, setPlacing] = useState(false);
  const [success, setSuccess] = useState<PlacedOrder | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill checkout form when customer is signed in
  useEffect(() => {
    if (profile) {
      setName((prev) => prev || profile.fullName);
      setPhone((prev) => prev || profile.phone);
      setEmail((prev) => prev || profile.email);
    }
  }, [profile]);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;
    if (!name.trim()) return setError('Por favor, informe seu nome.');
    if (!phone.trim()) return setError('Por favor, informe seu WhatsApp ou telefone.');

    setPlacing(true);
    setError(null);
    try {
      const snapshot = [...items];
      const result = await placeOrder({
        customerName: name.trim(),
        customerEmail: email.trim() || undefined,
        customerPhone: phone.trim(),
        items: items.map((i) => ({ product: i.product, quantity: i.quantity, sizeId: i.sizeId })),
      });
      clear();
      setSuccess({
        number: result.number,
        total: result.total,
        items: snapshot,
        phone: phone.trim(),
        name: name.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível finalizar o pedido.');
    } finally {
      setPlacing(false);
    }
  };

  const buildWhatsAppMessage = (order: PlacedOrder): string => {
    return (
      `Oi! Sou a ${order.name} 😊\n\n` +
      `Fiz o pedido ${order.number} na Lua de Praia 🌙\n\n` +
      `Total: ${formatCurrency(order.total)}\n\n` +
      `Estou entrando em contato para confirmar meu pedido e combinar o pagamento e a retirada. 💙`
    );
  };

  if (success) {
    const waUrl = buildWhatsAppUrl(
      STORE_CONFIG.whatsappNumber,
      buildWhatsAppMessage(success)
    );
    return (
      <div className="fade-in mx-auto max-w-md rounded-2xl border border-sky-200 bg-white p-8 text-center shadow-soft">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-aqua-100 text-aqua-600">
          <CheckCircle2 className="h-7 w-7" strokeWidth={1.6} />
        </div>
        <h2 className="font-display text-2xl font-semibold text-navy-900">
          Pedido recebido! <span className="text-sky-500">🌙</span>
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-gray-500">
          Recebemos seu pedido. Vamos confirmar as peças e combinar pagamento e retirada pelo
          WhatsApp.
        </p>

        <div className="mt-5 rounded-xl border border-sand-200 bg-sand-50 p-4 text-left">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Pedido</span>
            <span className="font-semibold text-navy-900">{success.number}</span>
          </div>
          <div className="mt-2 space-y-1.5">
            {success.items.map((item) => {
              const key = cartKey(item.product.id, item.sizeId);
              const itemName = displayName(item.product);
              return (
                <div key={key} className="flex items-center gap-2 text-sm">
                  <img
                    src={item.product.image_url}
                    alt={itemName}
                    className="h-8 w-8 shrink-0 rounded-lg object-cover"
                  />
                  <span className="min-w-0 flex-1 truncate text-gray-600">
                    {item.quantity}× {itemName}
                    {item.sizeLabel && (
                      <span className="text-gray-400"> · {item.sizeLabel}</span>
                    )}
                  </span>
                  <span className="text-navy-900">
                    {formatCurrency(effectivePrice(item.product) * item.quantity)}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-sand-200 pt-2 text-sm">
            <span className="font-medium text-gray-500">Total</span>
            <span className="font-display text-lg font-semibold text-navy-900">
              {formatCurrency(success.total)}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-gray-400">
            <span>WhatsApp informado</span>
            <span className="text-gray-500">{success.phone}</span>
          </div>
        </div>

        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 py-3.5 text-sm font-medium text-white transition hover:bg-[#1DA851]"
        >
          <MessageCircle className="h-5 w-5" />
          Continuar no WhatsApp
        </a>
        <p className="mt-3 text-xs leading-relaxed text-gray-400">
          Pagamento a combinar pelo WhatsApp após confirmação do pedido.
        </p>

        <div className="mt-4 flex flex-col gap-2">
          <button
            onClick={() => navigate({ name: 'orders' })}
            className="rounded-full border border-sand-200 bg-white px-5 py-3 text-sm text-navy-800 transition hover:border-sky-200"
          >
            Ver meus pedidos
          </button>
          <button
            onClick={() => navigate({ name: 'home' })}
            className="text-sm text-gray-500 transition hover:text-navy-900"
          >
            Continuar comprando
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <PageHeader title="Meu carrinho" subtitle="Revise seus itens antes de finalizar." />

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-sand-300 bg-white/60 p-10 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-sand-100 text-gray-400">
            <ShoppingBag className="h-6 w-6" strokeWidth={1.6} />
          </div>
          <p className="text-sm text-gray-500">Seu carrinho está vazio.</p>
          <button
            onClick={() => navigate({ name: 'home' })}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-navy-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-navy-800"
          >
            <ArrowLeft className="h-4 w-4" /> Explorar a loja
          </button>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3 lg:gap-8">
          {/* Items */}
          <div className="space-y-3 lg:col-span-2">
            {items.map((item) => {
              const key = cartKey(item.product.id, item.sizeId);
              const max = maxFor(item.product, item.sizeId);
              const unitPrice = effectivePrice(item.product);
              const hasPromo =
                item.product.promotional_price !== null &&
                item.product.promotional_price < item.product.price;
              const itemName = displayName(item.product);
              return (
                <div
                  key={key}
                  className="flex gap-3 rounded-2xl border border-sand-200 bg-white p-3 sm:gap-4 sm:p-4"
                >
                  <button
                    onClick={() => navigate({ name: 'product', id: item.product.id })}
                    className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-sand-100 sm:h-24 sm:w-24"
                    aria-label={itemName}
                  >
                    <img
                      src={item.product.image_url}
                      alt={itemName}
                      className="h-full w-full object-cover"
                    />
                  </button>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate font-display text-base text-plum-900 sm:text-lg">
                          {itemName}
                        </h3>
                        {item.sizeLabel && (
                          <p className="mt-0.5 text-xs font-medium text-plum-700/50">
                            Tamanho: {item.sizeLabel}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => remove(key)}
                        className="shrink-0 rounded-full p-2 text-plum-700/50 transition hover:bg-blush-50 hover:text-blush-600"
                        aria-label="Remover item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                      <div
                        className="flex items-center rounded-full border border-sand-200"
                        role="group"
                        aria-label="Quantidade"
                      >
                        <button
                          onClick={() => setQuantity(key, item.quantity - 1)}
                          className="p-2 text-plum-700/70 transition hover:text-plum-900 sm:p-2.5"
                          aria-label="Diminuir quantidade"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span
                          className="min-w-8 text-center text-sm font-medium text-plum-900"
                          aria-live="polite"
                        >
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => setQuantity(key, item.quantity + 1)}
                          className="p-2 text-plum-700/70 transition hover:text-plum-900 disabled:opacity-30 sm:p-2.5"
                          disabled={item.quantity >= max}
                          aria-label="Aumentar quantidade"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="text-right">
                        {hasPromo ? (
                          <p className="text-xs text-plum-700/40 line-through">
                            {formatCurrency(item.product.price)} cada
                          </p>
                        ) : (
                          <p className="text-xs text-plum-700/50">
                            {formatCurrency(unitPrice)} cada
                          </p>
                        )}
                        <p className="text-sm font-semibold text-plum-900">
                          {formatCurrency(unitPrice * item.quantity)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            <button
              onClick={() => navigate({ name: 'home' })}
              className="inline-flex items-center gap-2 pt-2 text-sm text-plum-700/60 transition hover:text-plum-900"
            >
              <ArrowLeft className="h-4 w-4" /> Continuar comprando
            </button>
          </div>

          {/* Checkout */}
          <div className="lg:col-span-1">
            <form
              onSubmit={handleCheckout}
              className="sticky top-6 rounded-2xl border border-sand-200 bg-white p-5 shadow-soft"
            >
              <h2 className="font-display text-xl font-semibold text-plum-900">Resumo</h2>
              <div className="mt-4 space-y-2 text-sm">
                <Row label="Subtotal" value={formatCurrency(total)} />
                <Row label="Retirada / envio" value="A combinar" muted />
                <div className="my-3 border-t border-sand-200" />
                <Row label="Total" value={formatCurrency(total)} strong />
              </div>

              <div className="mt-4 rounded-xl bg-blush-50 p-3 text-xs leading-relaxed text-plum-700/70">
                Após enviar seu pedido, entraremos em contato pelo WhatsApp para confirmar
                disponibilidade, pagamento e combinar a retirada ou envio por serviço escolhido
                pelo cliente.
              </div>

              <div className="mt-4 space-y-3">
                <Field label="Nome" required>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Como podemos te chamar?"
                    required
                    className="w-full rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm focus:border-blush-300 focus:outline-none focus:ring-2 focus:ring-blush-100"
                  />
                </Field>
                <Field label="WhatsApp / Telefone" required>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(00) 00000-0000"
                    required
                    inputMode="tel"
                    className="w-full rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm focus:border-blush-300 focus:outline-none focus:ring-2 focus:ring-blush-100"
                  />
                </Field>
                <Field label="E-mail (opcional)">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm focus:border-blush-300 focus:outline-none focus:ring-2 focus:ring-blush-100"
                  />
                </Field>
              </div>

              {error && (
                <p className="mt-3 rounded-xl bg-blush-50 px-3 py-2 text-xs text-blush-700">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={placing}
                className="mt-5 w-full rounded-full bg-blush-500 px-5 py-3.5 text-sm font-medium text-white transition hover:bg-blush-600 disabled:opacity-60"
              >
                {placing ? 'Finalizando...' : 'Finalizar pedido'}
              </button>
              <p className="mt-3 text-center text-[11px] leading-relaxed text-plum-700/50">
                Pagamento a combinar pelo WhatsApp após confirmação do pedido.
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-plum-700/70">
        {label}
        {required && <span className="text-blush-500"> *</span>}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? 'text-plum-700/50' : 'text-plum-700/70'}>{label}</span>
      <span
        className={[strong ? 'text-base font-semibold text-plum-900' : 'text-plum-900'].join(' ')}
      >
        {value}
      </span>
    </div>
  );
}
