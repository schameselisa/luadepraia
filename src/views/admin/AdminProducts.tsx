import { useEffect, useMemo, useState } from 'react';
import {
  Copy,
  Edit,
  Eye,
  EyeOff,
  Plus,
  Search,
  Trash2,
  AlertTriangle,
  PackageX,
} from 'lucide-react';
import type { Product, CategoryRow } from '@/types';
import { formatCurrency, isLowStock, totalStock } from '@/types';
import {
  adminFetchProducts,
  adminFetchCategories,
  adminSoftDeleteProduct,
  adminToggleProductActive,
  adminDuplicateProduct,
} from '@/lib/admin';
import { useRouter } from '@/store/Router';
import { AdminLayout } from './AdminLayout';

type SortKey = 'recent' | 'name' | 'price' | 'stock';

function readProductFilterFromUrl(): 'all' | 'active' | 'inactive' | 'out' | 'low' {
  if (typeof window === 'undefined') return 'all';
  const f = new URLSearchParams(window.location.search).get('filtro');
  if (f === 'ativos') return 'active';
  if (f === 'inativos') return 'inactive';
  if (f === 'sem-estoque') return 'out';
  if (f === 'estoque-baixo') return 'low';
  return 'all';
}

export function AdminProducts() {
  const { navigateAdmin } = useRouter();
  const [products, setProducts] = useState<(Product & { category: CategoryRow })[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [finishFilter, setFinishFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'out' | 'low'>(
    readProductFilterFromUrl
  );
  const [sort, setSort] = useState<SortKey>('recent');
  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([adminFetchProducts(), adminFetchCategories()])
      .then(([p, c]) => {
        setProducts(p);
        setCategories(c);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    let list = products;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.category?.name.toLowerCase().includes(q) ?? false) ||
          (p.internal_code?.toLowerCase().includes(q) ?? false) ||
          (p.color?.toLowerCase().includes(q) ?? false)
      );
    }
    if (categoryFilter !== 'all') list = list.filter((p) => p.category_id === categoryFilter);
    if (finishFilter !== 'all') list = list.filter((p) => (p.color ?? '') === finishFilter);
    if (statusFilter === 'active') list = list.filter((p) => p.active);
    if (statusFilter === 'inactive') list = list.filter((p) => !p.active);
    if (statusFilter === 'out') list = list.filter((p) => totalStock(p) <= 0);
    if (statusFilter === 'low') list = list.filter((p) => isLowStock(p));

    const sorted = [...list];
    switch (sort) {
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'price':
        sorted.sort((a, b) => a.price - b.price);
        break;
      case 'stock':
        sorted.sort((a, b) => totalStock(a) - totalStock(b));
        break;
      default:
        sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return sorted;
  }, [products, search, categoryFilter, finishFilter, statusFilter, sort]);

  const handleToggle = async (p: Product) => {
    setBusy(p.id);
    try {
      await adminToggleProductActive(p.id, !p.active);
      load();
    } catch {
    } finally {
      setBusy(null);
    }
  };

  const handleDuplicate = async (p: Product) => {
    setBusy(p.id);
    try {
      const copy = await adminDuplicateProduct(p.id);
      navigateAdmin({ name: 'product-edit', id: copy.id });
    } catch {
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setBusy(confirmDelete.id);
    try {
      await adminSoftDeleteProduct(confirmDelete.id);
      setConfirmDelete(null);
      load();
    } catch {
    } finally {
      setBusy(null);
    }
  };

  return (
    <AdminLayout current="products">
      <div className="fade-in">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold text-navy-900">Produtos</h1>
            <p className="mt-1 text-sm text-gray-500">
              Gerencie seu catálogo — cadastre, edite e controle o estoque.
            </p>
          </div>
          <button
            onClick={() => navigateAdmin({ name: 'product-new' })}
            className="inline-flex items-center gap-2 rounded-full bg-navy-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-navy-800"
          >
            <Plus className="h-4 w-4" /> Adicionar produto
          </button>
        </div>

        {/* Filters */}
        <div className="mt-5 space-y-3 rounded-2xl border border-sand-200 bg-white p-4">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              strokeWidth={1.6}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, SKU, categoria ou acabamento..."
              className="w-full rounded-full border border-sand-200 bg-white py-2.5 pl-10 pr-4 text-sm focus:border-sky-300 focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <Select
              label="Categoria"
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={[
                { value: 'all', label: 'Todas' },
                ...categories.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
            <Select
              label="Acabamento"
              value={finishFilter}
              onChange={setFinishFilter}
              options={[
                { value: 'all', label: 'Todos' },
                { value: 'Dourado', label: 'Dourado' },
                { value: 'Prata', label: 'Prata' },
              ]}
            />
            <Select
              label="Status"
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as typeof statusFilter)}
              options={[
                { value: 'all', label: 'Todos' },
                { value: 'active', label: 'Ativos' },
                { value: 'inactive', label: 'Inativos' },
                { value: 'out', label: 'Sem estoque' },
                { value: 'low', label: 'Estoque baixo' },
              ]}
            />
            <Select
              label="Ordenar"
              value={sort}
              onChange={(v) => setSort(v as SortKey)}
              options={[
                { value: 'recent', label: 'Mais recentes' },
                { value: 'name', label: 'Nome' },
                { value: 'price', label: 'Preço' },
                { value: 'stock', label: 'Estoque' },
              ]}
            />
          </div>
        </div>

        {/* Product list */}
        <div className="mt-4 space-y-2">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-sand-100" />
            ))
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-sand-300 bg-white/60 p-10 text-center text-sm text-gray-500">
              Nenhum produto encontrado com esses filtros.
            </div>
          ) : (
            filtered.map((p) => {
              const stock = totalStock(p);
              const out = stock <= 0;
              const low = isLowStock(p);
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-2xl border border-sand-200 bg-white p-3 transition hover:shadow-soft"
                >
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-sand-100">
                    <img
                      src={p.image_url}
                      alt={p.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {p.internal_code && (
                        <span className="shrink-0 rounded-md bg-navy-900/5 px-1.5 py-0.5 font-mono text-[10px] font-medium text-gray-500">
                          {p.internal_code}
                        </span>
                      )}
                      {p.color && (
                        <span className="shrink-0 rounded-md bg-blush-50 px-1.5 py-0.5 text-[10px] font-medium text-blush-600">
                          {p.color}
                        </span>
                      )}
                      <h3 className="truncate font-medium text-navy-900">{p.name}</h3>
                      {!p.active && (
                        <span className="shrink-0 rounded-full bg-sand-200 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                          Inativo
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{p.category?.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-medium text-navy-900">{formatCurrency(p.price)}</span>
                      <span className="text-gray-400">·</span>
                      <span className={out ? 'text-rose-600' : 'text-gray-500'}>
                        Estoque: {stock}
                      </span>
                      {out && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-600">
                          <PackageX className="h-3 w-3" /> Esgotado
                        </span>
                      )}
                      {low && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600">
                          <AlertTriangle className="h-3 w-3" /> Estoque baixo
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <IconButton
                      title={p.active ? 'Desativar' : 'Ativar'}
                      onClick={() => handleToggle(p)}
                      disabled={busy === p.id}
                    >
                      {p.active ? (
                        <EyeOff className="h-4 w-4 text-gray-500" />
                      ) : (
                        <Eye className="h-4 w-4 text-sky-600" />
                      )}
                    </IconButton>
                    <IconButton
                      title="Duplicar"
                      onClick={() => handleDuplicate(p)}
                      disabled={busy === p.id}
                    >
                      <Copy className="h-4 w-4 text-gray-500" />
                    </IconButton>
                    <IconButton
                      title="Editar"
                      onClick={() => navigateAdmin({ name: 'product-edit', id: p.id })}
                    >
                      <Edit className="h-4 w-4 text-gray-500" />
                    </IconButton>
                    <IconButton
                      title="Excluir"
                      onClick={() => setConfirmDelete(p)}
                    >
                      <Trash2 className="h-4 w-4 text-rose-500" />
                    </IconButton>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/40 p-4 backdrop-blur-sm"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <Trash2 className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-display text-lg font-semibold text-navy-900">
                  Excluir produto
                </h3>
                <p className="text-xs text-gray-500">Esta ação não pode ser desfeita.</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-gray-600">
              Tem certeza que deseja excluir <strong>{confirmDelete.name}</strong>? O produto será
              removido da loja, mas o histórico de pedidos é preservado.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 rounded-full border border-sand-200 px-4 py-2.5 text-sm text-navy-800 hover:bg-sand-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={busy === confirmDelete.id}
                className="flex-1 rounded-full bg-rose-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-rose-600 disabled:opacity-60"
              >
                Excluir produto
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-gray-500">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-full border border-sand-200 bg-white px-3 py-1.5 text-xs text-navy-900 focus:border-sky-300 focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function IconButton({
  children,
  onClick,
  title,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="rounded-lg p-2 text-gray-500 transition hover:bg-sand-100 hover:text-navy-900 disabled:opacity-40"
    >
      {children}
    </button>
  );
}
