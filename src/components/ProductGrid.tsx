import type { ProductWithCategory } from '@/types';
import { ProductCard } from './ProductCard';

type Props = {
  products: ProductWithCategory[];
  loading?: boolean;
  emptyText?: string;
};

export function ProductGrid({ products, loading, emptyText }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-3 rounded-2xl border border-sand-200 bg-white p-4"
          >
            <div className="aspect-square animate-pulse rounded-xl bg-sand-100" />
            <div className="h-3 w-16 animate-pulse rounded bg-sand-100" />
            <div className="h-4 w-24 animate-pulse rounded bg-sand-100" />
            <div className="h-4 w-16 animate-pulse rounded bg-sand-100" />
          </div>
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-sand-300 bg-white/60 p-10 text-center">
        <p className="text-sm text-plum-700/60">{emptyText ?? 'Nenhum acessório encontrado.'}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
