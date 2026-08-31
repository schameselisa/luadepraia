import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ShoppingBag } from 'lucide-react';
import type { ProductWithCategory } from '@/types';
import { totalStock, displayName } from '@/types';
import { fetchProducts } from '@/lib/data';
import { useRouter } from '@/store/Router';
import { useCategories } from '@/store/CategoriesContext';
import { CategoryFilter } from '@/components/CategoryFilter';
import { ProductGrid } from '@/components/ProductGrid';

type Props = {
  initialCategorySlug?: string;
  initialQuery?: string;
  lockCategory?: boolean;
};

type FinishFilter = 'all' | 'Dourado' | 'Prata';

const FINISH_OPTIONS: { value: FinishFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'Dourado', label: 'Dourado' },
  { value: 'Prata', label: 'Prata' },
];

// Stable shuffle: varies product order per session but stays consistent during navigation.
// Uses a session-scoped seed so the order doesn't reshuffle on every filter change.
const SHUFFLE_SEED = typeof sessionStorage !== 'undefined'
  ? (sessionStorage.getItem('catalog-shuffle-seed') ?? (() => {
      const seed = String(Math.floor(Math.random() * 1000000));
      sessionStorage.setItem('catalog-shuffle-seed', seed);
      return seed;
    })())
  : '1';

function stableShuffle<T>(arr: T[]): T[] {
  const seed = parseInt(SHUFFLE_SEED, 10) || 1;
  const result = [...arr];
  // Fisher-Yates with seeded PRNG (mulberry32)
  let s = seed;
  const rng = () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function Catalog({ initialCategorySlug, initialQuery, lockCategory }: Props) {
  const { navigate } = useRouter();
  const { categories } = useCategories();
  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [shuffled, setShuffled] = useState<ProductWithCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | 'all'>('all');
  const [finishFilter, setFinishFilter] = useState<FinishFilter>('all');
  const [query, setQuery] = useState(initialQuery ?? '');

  const initialCategoryId = useMemo(() => {
    if (!initialCategorySlug) return undefined;
    return categories.find((c) => c.slug === initialCategorySlug)?.id;
  }, [initialCategorySlug, categories]);

  useEffect(() => {
    setCategoryFilter(initialCategoryId ?? 'all');
    setQuery(initialQuery ?? '');
  }, [initialCategoryId, initialQuery]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchProducts()
      .then((data) => {
        if (!cancelled) {
          setProducts(data);
          // Stable shuffle per session — varied order but doesn't change on filter changes
          setShuffled(stableShuffle(data));
        }
      })
      .catch(() => {
        if (!cancelled) setError('Não foi possível carregar os produtos.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    let list = shuffled;
    if (categoryFilter !== 'all') list = list.filter((p) => p.category_id === categoryFilter);
    if (finishFilter !== 'all') list = list.filter((p) => (p.color ?? '') === finishFilter);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          displayName(p).toLowerCase().includes(q) ||
          (p.category?.name.toLowerCase().includes(q) ?? false) ||
          p.description.toLowerCase().includes(q) ||
          (p.internal_code?.toLowerCase().includes(q) ?? false) ||
          (p.color?.toLowerCase().includes(q) ?? false)
      );
    }
    // Hide sold-out from catalog, search, and category pages
    return list.filter((p) => totalStock(p) > 0);
  }, [shuffled, categoryFilter, finishFilter, query]);

  const isSearchResult = Boolean(initialQuery);

  return (
    <div className="fade-in">
      {isSearchResult && (
        <p className="mb-4 text-sm font-medium text-navy-800">
          Resultados para "{initialQuery}"
        </p>
      )}

      {!lockCategory && !initialQuery && (
        <div className="mb-5 space-y-3">
          <CategoryFilter
            categories={categories}
            selected={categoryFilter}
            onChange={setCategoryFilter}
          />
          {/* Finish filter — compact dropdown */}
          <div className="flex items-center justify-center">
            <div className="relative inline-flex items-center">
              <label className="mr-2 text-xs font-medium text-navy-700/50">Acabamento</label>
              <select
                value={finishFilter}
                onChange={(e) => setFinishFilter(e.target.value as FinishFilter)}
                className="cursor-pointer appearance-none rounded-full border border-sand-200 bg-white py-1.5 pl-4 pr-9 text-xs font-medium text-navy-800 transition hover:border-sky-200 focus:border-sky-300 focus:outline-none"
              >
                {FINISH_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-navy-700/40" />
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-700">
          {error}
        </div>
      )}

      {isSearchResult && !loading && filtered.length === 0 && (
        <p className="py-8 text-center text-sm text-gray-500">
          Nenhum acessório encontrado.
        </p>
      )}

      {isSearchResult && filtered.length > 0 && (
        <p className="mb-4 text-xs text-gray-500">
          {filtered.length} {filtered.length === 1 ? 'acessório encontrado' : 'acessórios encontrados'}
        </p>
      )}

      <ProductGrid
        products={filtered}
        loading={loading}
        emptyText={
          initialQuery
            ? 'Nenhum acessório encontrado.'
            : 'Nenhum acessório disponível no momento.'
        }
      />

      <div className="mt-10 flex items-center justify-center">
        <button
          onClick={() => navigate({ name: 'cart' })}
          className="inline-flex items-center gap-2 rounded-full border border-sand-200 bg-white px-5 py-2.5 text-sm text-navy-800 transition hover:border-sky-200 hover:text-sky-600"
        >
          <ShoppingBag className="h-4 w-4" strokeWidth={1.6} /> Ir para o carrinho
        </button>
      </div>
    </div>
  );
}
