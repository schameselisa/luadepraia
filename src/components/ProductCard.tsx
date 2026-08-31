import { useState } from 'react';
import { Check, ShoppingBag } from 'lucide-react';
import type { ProductWithCategory } from '@/types';
import { formatCurrency, displayName, totalStock } from '@/types';
import { useRouter } from '@/store/Router';
import { useCart } from '@/store/CartContext';

type Props = {
  product: ProductWithCategory;
};

export function ProductCard({ product }: Props) {
  const { navigate } = useRouter();
  const { add } = useCart();
  const out = totalStock(product) <= 0;
  const name = displayName(product);
  const [added, setAdded] = useState(false);
  const [showSizes, setShowSizes] = useState(false);
  const hasSizes = !!product.sizes && product.sizes.length > 0;

  const displayPrice =
    product.promotional_price !== null && product.promotional_price < product.price
      ? product.promotional_price
      : null;

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (out) return;
    if (hasSizes) {
      setShowSizes((s) => !s);
      return;
    }
    add(product, 1, null, null);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  const handleSizeSelect = (e: React.MouseEvent, sizeId: string, sizeLabel: string) => {
    e.stopPropagation();
    add(product, 1, sizeId, sizeLabel);
    setShowSizes(false);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div
      onClick={() => navigate({ name: 'product', id: product.id })}
      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-sand-200 bg-white text-left transition duration-300 hover:-translate-y-0.5 hover:border-blush-200 hover:shadow-soft"
    >
      <div className="relative aspect-square overflow-hidden bg-sand-100">
        <img
          src={product.image_url}
          alt={name}
          loading="lazy"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
        />
        {out && (
          <div className="absolute inset-0 flex items-end justify-start bg-plum-900/10">
            <span className="m-3 rounded-full bg-white/90 px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-plum-700/80 backdrop-blur-sm">
              Esgotado
            </span>
          </div>
        )}
        {displayPrice !== null && !out && (
          <span className="absolute left-3 top-3 rounded-full bg-blush-500 px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-white shadow-soft">
            Promo
          </span>
        )}
        {/* Quick add bag button */}
        {!out && (
          <button
            onClick={handleQuickAdd}
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-navy-800 shadow-soft backdrop-blur-sm transition hover:bg-blush-500 hover:text-white"
            aria-label="Adicionar ao carrinho"
          >
            {added ? (
              <Check className="h-4 w-4" />
            ) : (
              <ShoppingBag className="h-4 w-4" strokeWidth={1.6} />
            )}
          </button>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-blush-400">
          {product.category?.name ?? ''}
        </span>
        <h3 className="mt-1.5 font-display text-xl leading-snug text-plum-900">{name}</h3>
        <div className="mt-auto pt-3">
          {displayPrice !== null ? (
            <div className="flex items-baseline gap-2">
              <span className="text-xs text-plum-700/40 line-through">
                {formatCurrency(product.price)}
              </span>
              <span className="text-base font-semibold text-blush-600">
                {formatCurrency(displayPrice)}
              </span>
            </div>
          ) : (
            <span className="text-base font-medium text-plum-800">
              {formatCurrency(product.price)}
            </span>
          )}
        </div>
      </div>

      {/* Quick size selector popover */}
      {showSizes && hasSizes && (
        <div
          className="absolute inset-x-0 bottom-0 z-10 rounded-b-2xl border-t border-sand-200 bg-white p-3 shadow-card"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="mb-2 text-xs font-medium text-navy-900">Escolha o tamanho</p>
          <div className="flex flex-wrap gap-1.5">
            {product.sizes!.map((sz) => {
              const sizeOut = sz.stock <= 0;
              return (
                <button
                  key={sz.id}
                  onClick={(e) => !sizeOut && handleSizeSelect(e, sz.id, sz.label)}
                  disabled={sizeOut}
                  className={[
                    'rounded-full border px-3 py-1.5 text-xs font-medium transition',
                    sizeOut
                      ? 'border-sand-200 bg-sand-50 text-gray-300 cursor-not-allowed'
                      : 'border-sand-200 bg-white text-navy-800 hover:border-navy-300 hover:bg-navy-50',
                  ].join(' ')}
                >
                  {sz.label}
                </button>
              );
            })}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setShowSizes(false); }}
            className="mt-2 w-full text-center text-[10px] text-gray-400 hover:text-gray-600"
          >
            Fechar
          </button>
        </div>
      )}
    </div>
  );
}
