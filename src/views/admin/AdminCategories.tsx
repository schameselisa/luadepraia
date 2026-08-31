import { useEffect, useState } from 'react';
import { Plus, Tags, Trash2, Edit, Eye, EyeOff, X } from 'lucide-react';
import type { CategoryWithCount } from '@/types';
import { slugify } from '@/types';
import {
  adminFetchCategoriesWithCounts,
  adminCreateCategory,
  adminUpdateCategory,
  adminDeleteCategory,
} from '@/lib/admin';
import { useRouter } from '@/store/Router';
import { AdminLayout } from './AdminLayout';

export function AdminCategories() {
  const { navigate } = useRouter();
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CategoryWithCount | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<CategoryWithCount | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    adminFetchCategoriesWithCounts()
      .then(setCategories)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleToggle = async (cat: CategoryWithCount) => {
    setBusy(true);
    try {
      await adminUpdateCategory(cat.id, { active: !cat.active });
      load();
    } catch {
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      await adminDeleteCategory(confirmDelete.id);
      setConfirmDelete(null);
      load();
    } catch {
      setConfirmDelete(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminLayout current="categories">
      <div className="fade-in">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold text-plum-900">Categorias</h1>
            <p className="mt-1 text-sm text-plum-700/50">
              Organize seus produtos em categorias. Novas categorias aparecem automaticamente na loja.
            </p>
          </div>
          <button
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            className="inline-flex items-center gap-2 rounded-full bg-blush-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blush-600"
          >
            <Plus className="h-4 w-4" /> Adicionar categoria
          </button>
        </div>

        <div className="mt-5 space-y-2">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-sand-100" />
            ))
          ) : (
            categories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center gap-3 rounded-2xl border border-sand-200 bg-white p-4"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blush-100 text-blush-600">
                  <Tags className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-plum-900">{cat.name}</h3>
                    {!cat.active && (
                      <span className="rounded-full bg-sand-200 px-2 py-0.5 text-[10px] font-medium text-plum-700/60">
                        Inativa
                      </span>
                    )}
                    <span className="rounded-full bg-blush-50 px-2 py-0.5 text-[10px] font-medium text-blush-600">
                      {cat.product_count} {cat.product_count === 1 ? 'produto' : 'produtos'}
                    </span>
                  </div>
                  <p className="text-xs text-plum-700/50">/{cat.slug}</p>
                  {cat.description && (
                    <p className="mt-0.5 truncate text-xs text-plum-700/40">{cat.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    title={cat.active ? 'Desativar' : 'Ativar'}
                    onClick={() => handleToggle(cat)}
                    disabled={busy}
                    className="rounded-lg p-2 text-plum-700/60 transition hover:bg-sand-100"
                  >
                    {cat.active ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4 text-blush-600" />
                    )}
                  </button>
                  <button
                    title="Editar"
                    onClick={() => {
                      setEditing(cat);
                      setShowForm(true);
                    }}
                    className="rounded-lg p-2 text-plum-700/60 transition hover:bg-sand-100"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    title="Excluir"
                    onClick={() => setConfirmDelete(cat)}
                    className="rounded-lg p-2 text-rose-500 transition hover:bg-rose-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <button
          onClick={() => navigate({ name: 'home' })}
          className="mt-6 text-xs text-blush-600 hover:underline"
        >
          Ver loja pública →
        </button>
      </div>

      {showForm && (
        <CategoryFormModal
          category={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-plum-900/40 p-4 backdrop-blur-sm"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-card"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg font-semibold text-plum-900">Excluir categoria</h3>
            <p className="mt-3 text-sm text-plum-700/70">
              Tem certeza que deseja excluir <strong>{confirmDelete.name}</strong>? Produtos desta
              categoria podem ficar sem categoria — verifique antes de excluir.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 rounded-full border border-sand-200 px-4 py-2.5 text-sm text-plum-800 hover:bg-sand-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={busy}
                className="flex-1 rounded-full bg-rose-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-rose-600 disabled:opacity-60"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function CategoryFormModal({
  category,
  onClose,
  onSaved,
}: {
  category: CategoryWithCount | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(category?.name ?? '');
  const [slug, setSlug] = useState(category?.slug ?? '');
  const [description, setDescription] = useState(category?.description ?? '');
  const [active, setActive] = useState(category?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('Informe o nome da categoria.');
    setSaving(true);
    setError(null);
    try {
      const data = {
        name: name.trim(),
        slug: slug.trim() || slugify(name),
        description: description.trim(),
        image: '',
        active,
        sort_order: category?.sort_order ?? 99,
      };
      if (category) {
        await adminUpdateCategory(category.id, data);
      } else {
        await adminCreateCategory(data);
      }
      onSaved();
    } catch {
      setError('Não foi possível salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-plum-900/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-plum-900">
            {category ? 'Editar categoria' : 'Nova categoria'}
          </h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-plum-700/50 hover:bg-sand-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="mt-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-plum-700/70">Nome *</label>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!category) setSlug(slugify(e.target.value));
              }}
              placeholder="Ex: Tornozeleiras"
              className="mt-1 w-full rounded-xl border border-sand-200 bg-white px-3 py-2.5 text-sm focus:border-blush-300 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-plum-700/70">Slug (URL)</label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="tornozeleiras"
              className="mt-1 w-full rounded-xl border border-sand-200 bg-white px-3 py-2.5 text-sm focus:border-blush-300 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-plum-700/70">Descrição</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Opcional"
              className="mt-1 w-full resize-none rounded-xl border border-sand-200 bg-white px-3 py-2.5 text-sm focus:border-blush-300 focus:outline-none"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-plum-800">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="accent-blush-500"
            />
            Categoria ativa (visível na loja)
          </label>

          {error && (
            <p className="rounded-lg bg-blush-50 px-3 py-2 text-xs text-blush-700">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-full border border-sand-200 px-4 py-2.5 text-sm text-plum-800 hover:bg-sand-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-full bg-blush-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-blush-600 disabled:opacity-60"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
