import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { ProductWithCategory } from '@/types';
import { formatCurrency } from '@/types';
import { fetchProducts } from '@/lib/data';
import { useRouter } from '@/store/Router';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function SearchOverlay({ open, onClose }: Props) {
  const { navigate } = useRouter();
  const [query, setQuery] = useState('');
  const [allProducts, setAllProducts] = useState<ProductWithCategory[]>([]);
  const [results, setResults] = useState<ProductWithCategory[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      fetchProducts().then(setAllProducts).catch(() => {});
      setQuery('');
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      setResults([]);
      return;
    }
    const filtered = allProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.category?.name.toLowerCase().includes(q) ?? false) ||
        (p.internal_code?.toLowerCase().includes(q) ?? false) ||
        p.description.toLowerCase().includes(q)
    );
    setResults(filtered);
  }, [query, allProducts]);

  const selectProduct = (id: string) => {
    navigate({ name: 'product', id });
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto md:absolute md:inset-x-0 md:top-0">
      <div
        className="absolute inset-0 bg-navy-900/20 backdrop-blur-sm md:bg-navy-900/10"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative mx-auto w-full max-w-2xl bg-white px-4 py-4 shadow-lg md:rounded-b-2xl md:border-x md:border-b md:border-sand-200">
        <div className="flex items-center gap-3">
          <Search className="h-5 w-5 shrink-0 text-gray-400" strokeWidth={1.6} />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar acessórios..."
            aria-label="Buscar acessórios"
            style={{ fontSize: '16px' }}
            className="flex-1 bg-transparent py-2 text-base text-navy-900 placeholder:text-gray-400 focus:outline-none md:text-sm"
          />
          <button
            onClick={onClose}
            className="rounded-full p-2 text-gray-400 transition hover:bg-sand-100 hover:text-navy-800"
            aria-label="Fechar busca"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {query.trim() && (
          <div className="mt-3 border-t border-sand-100 pt-3">
            {results.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-500">
                Nenhum acessório encontrado.
              </p>
            ) : (
              <ul className="max-h-[60vh] space-y-1 overflow-y-auto overflow-x-hidden">
                {results.map((p) => {
                  const hasPromo =
                    p.promotional_price !== null &&
                    p.promotional_price < p.price;
                  return (
                    <li key={p.id}>
                      <button
                        onClick={() => selectProduct(p.id)}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-sand-50"
                      >
                        <img
                          src={p.image_url}
                          alt=""
                          className="h-10 w-10 shrink-0 rounded-lg object-cover"
                          loading="lazy"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-navy-900">{p.name}</p>
                          <p className="truncate text-xs text-gray-400">
                            {p.category?.name ?? ''}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          {hasPromo ? (
                            <div className="flex flex-col items-end">
                              <span className="text-[10px] text-gray-400 line-through">
                                {formatCurrency(p.price)}
                              </span>
                              <span className="text-sm font-semibold text-sky-600">
                                {formatCurrency(p.promotional_price!)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm font-semibold text-navy-900">
                              {formatCurrency(p.price)}
                            </span>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
