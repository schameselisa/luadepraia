import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
} from 'lucide-react';
import type { ProductImage, ProductSize, ProductWithCategory } from '@/types';
import { formatCurrency, displayName, totalStock } from '@/types';
import { fetchProduct, fetchProductImages, fetchProductsByCategorySlug, fetchProductSizes } from '@/lib/data';
import { useRouter } from '@/store/Router';
import { useCart } from '@/store/CartContext';
import { ProductCard } from '@/components/ProductCard';

type Props = { id: string };

export function ProductDetails({ id }: Props) {
  const { navigate } = useRouter();
  const { add, maxFor } = useCart();
  const [product, setProduct] = useState<ProductWithCategory | null>(null);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [related, setRelated] = useState<ProductWithCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [selectedSizeId, setSelectedSizeId] = useState<string | null>(null);
  const [sizeError, setSizeError] = useState<string | null>(null);

  const hasSizes = !!product?.sizes && product.sizes.length > 0;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setQty(1);
    setActiveImage(0);
    setSelectedSizeId(null);
    setSizeError(null);

    fetchProduct(id)
      .then(async (p) => {
        if (cancelled) return;
        setProduct(p);
        const imgs = await fetchProductImages(id);
        if (cancelled) return;
        setImages(imgs);

        if (p.category?.slug) {
          const relatedProducts = await fetchProductsByCategorySlug(p.category.slug);
          if (cancelled) return;
          setRelated(relatedProducts.filter((rp) => rp.id !== id).slice(0, 4));
        }
      })
      .catch(() => {
        if (!cancelled) setError('Não foi possível carregar o produto.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const name = product ? displayName(product) : '';
  const stockCount = product ? totalStock(product) : 0;
  const out = stockCount <= 0;

  const selectedSize: ProductSize | null = useMemo(() => {
    if (!product?.sizes || !selectedSizeId) return null;
    return product.sizes.find((s) => s.id === selectedSizeId) ?? null;
  }, [product, selectedSizeId]);

  const max = hasSizes
    ? selectedSize
      ? selectedSize.stock
      : 0
    : (product ? maxFor(product) : 0);

  const displayPrice =
    product && product.promotional_price !== null && product.promotional_price < product.price
      ? product.promotional_price
      : null;

  const handleAdd = () => {
    if (!product) return;
    if (hasSizes && !selectedSizeId) {
      setSizeError('Selecione um tamanho para continuar.');
      return;
    }
    setSizeError(null);
    add(product, qty, selectedSizeId, selectedSize?.label ?? null);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  if (loading) {
    return (
      <div className="fade-in">
        <div className="mb-6 h-4 w-48 animate-pulse rounded bg-sand-100" />
        <div className="grid gap-8 md:grid-cols-2 md:gap-12">
          <div className="space-y-3">
            <div className="aspect-square animate-pulse rounded-2xl bg-sand-100" />
            <div className="flex gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 w-16 animate-pulse rounded-lg bg-sand-100" />
              ))}
            </div>
          </div>
          <div className="space-y-5">
            <div className="h-3 w-20 animate-pulse rounded bg-sand-100" />
            <div className="h-8 w-48 animate-pulse rounded bg-sand-100" />
            <div className="h-7 w-28 animate-pulse rounded bg-sand-100" />
            <div className="h-20 w-full animate-pulse rounded bg-sand-100" />
            <div className="h-12 w-full animate-pulse rounded-full bg-sand-100" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="rounded-2xl border border-blush-200 bg-blush-50 p-8 text-center">
        <p className="text-sm text-blush-700">{error ?? 'Produto não encontrado.'}</p>
        <button
          onClick={() => navigate({ name: 'home' })}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-blush-500 px-4 py-2 text-sm text-white transition hover:bg-blush-600"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar à loja
        </button>
      </div>
    );
  }

  const galleryImages = images.length > 0 ? images : [
    {
      id: 'fallback',
      product_id: product.id,
      image_url: product.image_url,
      is_main: true,
      sort_order: 0,
      created_at: '',
    },
  ];

  const currentImage = galleryImages[activeImage] ?? galleryImages[0];

  const stockLabel = out ? 'Esgotado' : 'Disponível';

  const canAdd = hasSizes ? !!selectedSizeId && selectedSize && selectedSize.stock > 0 : !out;

  return (
    <div className="fade-in">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-1.5 text-xs text-plum-700/50">
        <button
          onClick={() => navigate({ name: 'home' })}
          className="transition hover:text-plum-900"
        >
          Início
        </button>
        <ChevronRight className="h-3 w-3 text-plum-700/30" />
        {product.category && (
          <>
            <button
              onClick={() => navigate({ name: 'category', slug: product.category!.slug })}
              className="transition hover:text-plum-900"
            >
              {product.category.name}
            </button>
            <ChevronRight className="h-3 w-3 text-plum-700/30" />
          </>
        )}
        <span className="truncate text-plum-700/70">{name}</span>
      </nav>

      <div className="grid gap-8 md:grid-cols-2 md:gap-12">
        {/* Gallery */}
        <div className="flex flex-col gap-3">
          <div className="overflow-hidden rounded-2xl border border-sand-200 bg-white">
            <img
              src={currentImage.image_url}
              alt={name}
              className="aspect-square w-full object-cover transition-opacity duration-300"
            />
          </div>
          {galleryImages.length > 1 && (
            <div className="flex gap-2 overflow-x-auto scrollbar-thin">
              {galleryImages.map((img, idx) => (
                <button
                  key={img.id}
                  onClick={() => setActiveImage(idx)}
                  className={[
                    'h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition',
                    idx === activeImage
                      ? 'border-blush-400'
                      : 'border-sand-200 hover:border-sand-300',
                  ].join(' ')}
                  aria-label={`Imagem ${idx + 1}`}
                >
                  <img
                    src={img.image_url}
                    alt=""
                    loading={idx === 0 ? undefined : 'lazy'}
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col">
          {/* Category */}
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-500">
            {product.category?.name ?? ''}
          </span>

          {/* Name */}
          <h1 className="mt-2 font-display text-3xl font-semibold leading-tight text-navy-900 sm:text-4xl">
            {name}
          </h1>

          {/* Price */}
          <div className="mt-4">
            {displayPrice !== null ? (
              <div className="flex items-baseline gap-2.5">
                <span className="text-base text-gray-400 line-through">
                  {formatCurrency(product.price)}
                </span>
                <span className="text-3xl font-semibold text-sky-600">
                  {formatCurrency(displayPrice)}
                </span>
              </div>
            ) : (
              <p className="text-3xl font-semibold text-navy-900">
                {formatCurrency(product.price)}
              </p>
            )}
          </div>

          {/* Stock */}
          <div className="mt-4 flex items-center gap-2 text-sm">
            <span
              className={[
                'h-2 w-2 rounded-full',
                out ? 'bg-rose-400' : 'bg-aqua-500',
              ].join(' ')}
            />
            <span
              className={[
                'font-medium',
                out ? 'text-rose-600' : 'text-aqua-700',
              ].join(' ')}
            >
              {stockLabel}
            </span>
            {!out && !hasSizes && (
              <span className="text-gray-400">
                · {product.stock} {product.stock === 1 ? 'unidade' : 'unidades'}
              </span>
            )}
          </div>

          {/* Size selector */}
          {hasSizes && (
            <div className="mt-5">
              <p className="text-sm font-medium text-navy-900">Escolha o tamanho</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {product.sizes!.map((sz) => {
                  const sizeOut = sz.stock <= 0;
                  const isSelected = selectedSizeId === sz.id;
                  return (
                    <button
                      key={sz.id}
                      onClick={() => {
                        if (sizeOut) return;
                        setSelectedSizeId(sz.id);
                        setSizeError(null);
                        setQty(1);
                      }}
                      disabled={sizeOut}
                      className={[
                        'min-w-12 rounded-full border px-4 py-2.5 text-sm font-medium transition',
                        isSelected
                          ? 'border-navy-700 bg-navy-700 text-white'
                          : sizeOut
                          ? 'border-sand-200 bg-sand-50 text-gray-300 line-through cursor-not-allowed'
                          : 'border-sand-200 bg-white text-navy-800 hover:border-navy-300',
                      ].join(' ')}
                    >
                      {sz.label}
                    </button>
                  );
                })}
              </div>
              {sizeError && (
                <p className="mt-2 text-xs text-rose-600">{sizeError}</p>
              )}
              {selectedSize && (
                <p className="mt-2 text-xs text-gray-400">
                  {selectedSize.stock} {selectedSize.stock === 1 ? 'unidade disponível' : 'unidades disponíveis'}
                </p>
              )}
            </div>
          )}

          {/* Quantity + Add to cart */}
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div
              className="flex items-center justify-between rounded-full border border-sand-200 bg-white sm:w-32"
              role="group"
              aria-label="Quantidade"
            >
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="p-3 text-gray-500 transition hover:text-navy-900 disabled:opacity-30"
                aria-label="Diminuir quantidade"
                disabled={!canAdd || qty <= 1}
              >
                <Minus className="h-4 w-4" />
              </button>
              <span
                className="min-w-8 text-center text-sm font-semibold text-navy-900"
                aria-live="polite"
              >
                {qty}
              </span>
              <button
                onClick={() => setQty((q) => Math.min(max, q + 1))}
                className="p-3 text-gray-500 transition hover:text-navy-900 disabled:opacity-30"
                aria-label="Aumentar quantidade"
                disabled={!canAdd || qty >= max}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <button
              onClick={handleAdd}
              disabled={!canAdd || added}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-navy-700 px-6 py-3.5 text-sm font-medium text-white transition hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {added ? (
                <>
                  <Check className="h-4 w-4" /> Adicionado ao carrinho
                </>
              ) : out ? (
                'Esgotado'
              ) : (
                <>
                  <ShoppingBag className="h-4 w-4" strokeWidth={1.6} /> Adicionar ao carrinho
                </>
              )}
            </button>
          </div>

          {/* Material */}
          <div className="mt-6 flex items-center gap-3 rounded-xl border border-sand-200 bg-sand-50 px-4 py-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-600">
              <ShieldCheck className="h-4 w-4" strokeWidth={1.6} />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                Material
              </p>
              <p className="text-sm text-navy-800">Aço inoxidável</p>
            </div>
          </div>

          {/* Description */}
          {product.description && (
            <div className="mt-6">
              <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">
                Descrição
              </h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-500">
                {product.description}
              </p>
            </div>
          )}

          {/* Continue shopping */}
          <button
            onClick={() => navigate({ name: 'home' })}
            className="mt-6 inline-flex items-center gap-2 text-sm text-gray-500 transition hover:text-navy-900"
          >
            <ArrowLeft className="h-4 w-4" /> Continuar comprando
          </button>
        </div>
      </div>

      {/* Related products */}
      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="font-display text-2xl font-semibold text-plum-900">
            Você também pode gostar
          </h2>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {related.map((rp) => (
              <ProductCard key={rp.id} product={rp} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
