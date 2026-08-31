import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ImagePlus,
  Loader2,
  Plus,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { CategoryRow, ProductImage, ProductSize } from '@/types';
import { COLOR_OPTIONS } from '@/types';
import { formatCurrency } from '@/types';
import {
  adminFetchCategories,
  adminFetchProduct,
  adminFetchProductImages,
  adminFetchProductSizes,
  adminGetProductCost,
  adminCreateProduct,
  adminUpdateProduct,
  adminSetProductImages,
  adminSetProductSizes,
  adminUploadProductImage,
  type AdminProductInput,
} from '@/lib/admin';
import { useRouter } from '@/store/Router';
import { AdminLayout } from './AdminLayout';

type Props = {
  mode: 'new' | 'edit';
  productId?: string;
};

type ImageEntry = { url: string; isMain: boolean; isNew?: boolean };
type SizeEntry = { id?: string; label: string; stock: string; sort_order: number };

function parseNumber(value: string): number | null {
  const cleaned = value.trim().replace(',', '.');
  if (cleaned === '') return null;
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

export function AdminProductForm({ mode, productId }: Props) {
  const { navigateAdmin } = useRouter();
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [price, setPrice] = useState('');
  const [priceTouched, setPriceTouched] = useState(false);
  const [promoPrice, setPromoPrice] = useState('');
  const [stock, setStock] = useState('1');
  const [minStock, setMinStock] = useState('5');
  const [active, setActive] = useState(true);
  const [internalCode, setInternalCode] = useState<string>('');
  const [supplier, setSupplier] = useState<string>('');
  const [color, setColor] = useState<string>('');
  const [hasSizes, setHasSizes] = useState(false);
  const [sizes, setSizes] = useState<SizeEntry[]>([]);
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [lowStockAlertEnabled, setLowStockAlertEnabled] = useState(false);
  const [lowStockThreshold, setLowStockThreshold] = useState('2');

  useEffect(() => {
    adminFetchCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    if (mode !== 'edit' || !productId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      adminFetchProduct(productId),
      adminFetchProductImages(productId),
      adminFetchProductSizes(productId),
      adminGetProductCost(productId).catch(() => null),
    ])
      .then(([product, imgs, sizeList, cost]) => {
        if (cancelled || !product) return;
        setName(product.name);
        setCategoryId(product.category_id);
        setDescription(product.description);
        setCostPrice(cost != null ? String(cost) : '');
        setPrice(String(product.price));
        setPriceTouched(true);
        setPromoPrice(product.promotional_price ? String(product.promotional_price) : '');
        setStock(String(product.stock));
        setMinStock(String(product.minimum_stock));
        setActive(product.active);
        setInternalCode(product.internal_code ?? '');
        setSupplier(product.supplier ?? '');
        setColor(product.color ?? '');
        setLowStockAlertEnabled(product.low_stock_alert_enabled ?? false);
        setLowStockThreshold(String(product.low_stock_threshold ?? 2));
        const loadedSizes: SizeEntry[] = (sizeList as ProductSize[]).map((sz) => ({
          id: sz.id,
          label: sz.label,
          stock: String(sz.stock),
          sort_order: sz.sort_order,
        }));
        if (loadedSizes.length > 0) {
          setHasSizes(true);
          setSizes(loadedSizes);
        }
        setImages(
          imgs.map((img: ProductImage) => ({
            url: img.image_url,
            isMain: img.is_main,
          }))
        );
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
  }, [mode, productId]);

  // Suggested price = cost × 3
  const costNum = parseNumber(costPrice);
  const suggestedPrice = costNum != null ? costNum * 3 : null;

  // Auto-fill sale price with suggestion when creating (only if price not yet touched)
  useEffect(() => {
    if (mode === 'new' && !priceTouched && suggestedPrice != null) {
      setPrice(suggestedPrice.toFixed(2).replace('.', ','));
    }
  }, [suggestedPrice, priceTouched, mode]);

  // Profit and margin calculations
  const priceNum = parseNumber(price);
  const profit = costNum != null && priceNum != null ? priceNum - costNum : null;
  const margin = costNum != null && priceNum != null && priceNum > 0
    ? (profit! / priceNum) * 100
    : null;

  const handleUpload = async (files: FileList) => {
    setUploading(true);
    setError(null);
    try {
      const newUrls: ImageEntry[] = [];
      for (const file of Array.from(files)) {
        if (file.size > 5 * 1024 * 1024) {
          setError('Cada imagem deve ter no máximo 5MB.');
          continue;
        }
        const url = await adminUploadProductImage(file);
        newUrls.push({ url, isMain: images.length === 0 && newUrls.length === 0, isNew: true });
      }
      setImages((prev) => [...prev, ...newUrls]);
    } catch {
      setError('Não foi possível enviar a imagem. Tente novamente.');
    } finally {
      setUploading(false);
    }
  };

  const setMain = (idx: number) => {
    setImages((prev) => prev.map((img, i) => ({ ...img, isMain: i === idx })));
  };

  const removeImage = (idx: number) => {
    setImages((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      if (next.length > 0 && !next.some((i) => i.isMain)) next[0].isMain = true;
      return next;
    });
  };

  const addSize = () => {
    setSizes((prev) => [...prev, { label: '', stock: '', sort_order: prev.length }]);
  };

  const removeSize = (idx: number) => {
    setSizes((prev) => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, sort_order: i })));
  };

  const updateSize = (idx: number, field: 'label' | 'stock', value: string) => {
    setSizes((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) return setError('Informe o nome do produto.');
    if (!categoryId) return setError('Selecione uma categoria.');
    const priceNumSave = parseFloat(price.replace(',', '.'));
    if (isNaN(priceNumSave) || priceNumSave < 0) return setError('Informe um preço válido.');
    const stockNum = parseInt(stock, 10);
    if (isNaN(stockNum) || stockNum < 0) return setError('Informe um estoque válido.');

    const promoNum = promoPrice.trim()
      ? parseFloat(promoPrice.replace(',', '.'))
      : null;
    if (promoNum !== null && (isNaN(promoNum) || promoNum < 0))
      return setError('Preço promocional inválido.');

    const costNumSave = costPrice.trim()
      ? parseFloat(costPrice.replace(',', '.'))
      : null;
    if (costNumSave !== null && (isNaN(costNumSave) || costNumSave < 0))
      return setError('Custo de aquisição inválido.');

    // Validate sizes
    let sizeEntries: { id?: string; label: string; stock: number; sort_order: number }[] = [];
    if (hasSizes) {
      for (let i = 0; i < sizes.length; i++) {
        const sz = sizes[i];
        if (!sz.label.trim()) return setError(`Informe o nome do tamanho ${i + 1}.`);
        const szStock = parseInt(sz.stock, 10);
        if (isNaN(szStock) || szStock < 0) return setError(`Estoque inválido para o tamanho ${sz.label}.`);
        sizeEntries.push({ id: sz.id, label: sz.label.trim(), stock: szStock, sort_order: i });
      }
      if (sizeEntries.length === 0) return setError('Adicione pelo menos um tamanho ou desmarque a opção de tamanhos.');
      // Check for duplicate size labels (case-insensitive)
      const labels = sizeEntries.map((s) => s.label.toLowerCase().trim());
      const dupes = labels.filter((l, i) => labels.indexOf(l) !== i);
      if (dupes.length > 0) {
        return setError(`Tamanho duplicado: "${dupes[0]}". Use nomes diferentes para cada tamanho.`);
      }
    }

    // Validate color: required for new products, optional for existing
    if (mode === 'new' && !color) return setError('Selecione o acabamento (Dourado ou Prata).');

    // Validate low stock threshold when alert is enabled
    const thresholdNum = parseInt(lowStockThreshold, 10);
    if (lowStockAlertEnabled && (isNaN(thresholdNum) || thresholdNum < 0)) {
      return setError('Informe um limite válido para o alerta de estoque baixo.');
    }

    const mainImage = images.find((i) => i.isMain) ?? images[0];
    const input: AdminProductInput = {
      name: name.trim(),
      category_id: categoryId,
      description: description.trim(),
      price: priceNumSave,
      promotional_price: promoNum,
      cost_price: costNumSave,
      stock: stockNum,
      minimum_stock: parseInt(minStock, 10) || 5,
      low_stock_alert_enabled: lowStockAlertEnabled,
      low_stock_threshold: thresholdNum || 2,
      active,
      image_url: mainImage?.url ?? '',
      color: color || null,
      internal_code: internalCode.trim() || null,
      supplier: supplier.trim() || null,
    };

    setSaving(true);
    try {
      let savedId: string;
      if (mode === 'new') {
        const created = await adminCreateProduct(input);
        savedId = created.id;
      } else if (productId) {
        await adminUpdateProduct(productId, input);
        savedId = productId;
      } else {
        throw new Error('ID do produto ausente.');
      }

      if (images.length > 0) {
        await adminSetProductImages(
          savedId,
          images.map((img) => ({ image_url: img.url, is_main: img.isMain }))
        );
      }

      if (hasSizes) {
        await adminSetProductSizes(savedId, sizeEntries);
      } else if (mode === 'edit' && productId) {
        // If product had sizes but now doesn't, clear them
        await adminSetProductSizes(productId, []);
      }

      navigateAdmin({ name: 'products' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('products_name_color_unique_idx')) {
        setError('Já existe um produto com esse nome e acabamento.');
      } else if (msg.includes('products_internal_code_unique_idx')) {
        setError('Este SKU já está sendo usado por outro produto.');
      } else if (msg.includes('product_sizes_product_label_unique_idx')) {
        setError('Existem tamanhos duplicados neste produto. Use nomes diferentes para cada tamanho.');
      } else {
        setError('Não foi possível salvar o produto. Verifique se você está logada como admin.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout current="products">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-blush-500" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout current={mode === 'new' ? 'products' : 'products'}>
      <div className="fade-in">
        <button
          onClick={() => navigateAdmin({ name: 'products' })}
          className="mb-4 inline-flex items-center gap-2 text-sm text-plum-700/60 transition hover:text-plum-900"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para produtos
        </button>

        <h1 className="font-display text-2xl font-semibold text-plum-900">
          {mode === 'new' ? 'Adicionar produto' : 'Editar produto'}
        </h1>

        <form onSubmit={handleSave} className="mt-5 space-y-5">
          {/* Images */}
          <Section title="Imagens" subtitle="Adicione fotos do produto e marque a principal.">
            <div className="flex flex-wrap gap-3">
              {images.map((img, idx) => (
                <div
                  key={idx}
                  className="group relative h-28 w-28 overflow-hidden rounded-xl border border-sand-200 bg-sand-100"
                >
                  <img src={img.url} alt="" className="h-full w-full object-cover" />
                  {img.isMain && (
                    <span className="absolute left-1 top-1 rounded-full bg-blush-500 px-2 py-0.5 text-[9px] font-medium text-white">
                      Principal
                    </span>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center gap-1 bg-plum-900/40 opacity-0 transition group-hover:opacity-100">
                    {!img.isMain && (
                      <button
                        type="button"
                        onClick={() => setMain(idx)}
                        title="Definir como principal"
                        className="rounded-lg bg-white/90 p-1.5 text-blush-600"
                      >
                        <Star className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      title="Remover"
                      className="rounded-lg bg-white/90 p-1.5 text-rose-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              <label className="flex h-28 w-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-sand-300 bg-white text-plum-700/40 transition hover:border-blush-300 hover:text-blush-600">
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <ImagePlus className="h-5 w-5" />
                    <span className="text-[10px]">Enviar foto</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => e.target.files && handleUpload(e.target.files)}
                />
              </label>
            </div>
            <p className="mt-2 text-xs text-plum-700/40">
              JPG ou PNG, até 5MB cada. A primeira imagem marcada como principal aparece na loja.
            </p>
          </Section>

          {/* Basic info */}
          <Section title="Informações básicas">
            <Field label="SKU / Código interno" full>
              <div className="flex items-center gap-2">
                <input
                  value={internalCode}
                  onChange={(e) => setInternalCode(e.target.value)}
                  placeholder="Ex: AN-001 (gerado automaticamente se vazio)"
                  className="form-input font-mono"
                />
              </div>
              <p className="mt-1 text-xs text-plum-700/40">
                Pode ser gerado automaticamente ao criar. Edite manualmente se desejar. O SKU é único.
              </p>
            </Field>
            <Field label="Nome do produto" required>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Anel Coração"
                className="form-input"
              />
            </Field>
            <Field label="Cor / Acabamento" required={mode === 'new'}>
              <select
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="form-input"
              >
                <option value="">{mode === 'new' ? 'Selecione...' : 'Não informado'}</option>
                {COLOR_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              {mode === 'edit' && !color && (
                <p className="mt-1 text-xs text-amber-600">
                  Acabamento não informado. Selecione para exibir na loja.
                </p>
              )}
            </Field>
            <Field label="Categoria" required>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="form-input"
              >
                <option value="">Selecione...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Fornecedor (opcional)">
              <input
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Ex: Estrela da Manhã"
                className="form-input"
              />
            </Field>
            <Field label="Descrição" full>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Descreva o material, estilo e cuidados do produto..."
                className="form-input resize-none"
              />
            </Field>
          </Section>

          {/* Pricing */}
          <Section title="Precificação e estoque">
            {/* Cost price */}
            <Field label="Custo de aquisição (R$)">
              <input
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                placeholder="10,00"
                inputMode="decimal"
                className="form-input"
              />
            </Field>

            {/* Suggested price */}
            <div className="flex items-end">
              <div className="w-full rounded-xl bg-sky-50 px-4 py-3">
                <p className="text-xs text-sky-700/70">Preço sugerido (custo × 3)</p>
                <p className="mt-0.5 font-display text-lg font-semibold text-sky-700">
                  {suggestedPrice != null ? formatCurrency(suggestedPrice) : '—'}
                </p>
              </div>
            </div>

            {/* Sale price */}
            <Field label="Preço de venda (R$)" required>
              <input
                value={price}
                onChange={(e) => {
                  setPrice(e.target.value);
                  setPriceTouched(true);
                }}
                placeholder="25,00"
                inputMode="decimal"
                className="form-input"
              />
            </Field>

            {/* Promotional price */}
            <Field label="Preço promocional (R$) — opcional">
              <input
                value={promoPrice}
                onChange={(e) => setPromoPrice(e.target.value)}
                placeholder="19,90"
                inputMode="decimal"
                className="form-input"
              />
            </Field>

            {/* Profit & margin */}
            {profit != null && margin != null && (
              <div className="flex items-end">
                <div className="w-full rounded-xl bg-emerald-50 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-emerald-700/70">Lucro bruto estimado/unid.</span>
                    <span className="text-sm font-semibold text-emerald-700">
                      {formatCurrency(profit)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-xs text-emerald-700/70">Margem bruta</span>
                    <span className="text-sm font-semibold text-emerald-700">
                      {margin.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Sizes section — redesigned for clarity */}
            <div className="sm:col-span-2">
              <div className="rounded-xl border border-sand-200 bg-sand-50/50 p-4">
                <h3 className="text-sm font-semibold text-plum-900">Tamanhos e estoque</h3>
                <label className="mt-2 flex items-center gap-2 text-sm text-plum-800">
                  <input
                    type="checkbox"
                    checked={hasSizes}
                    onChange={(e) => setHasSizes(e.target.checked)}
                    className="accent-blush-500"
                  />
                  Este produto possui tamanhos
                </label>

                {hasSizes && (
                  <div className="mt-4 space-y-2">
                    {/* Header */}
                    <div className="hidden grid-cols-[1fr_100px_40px] gap-2 text-xs font-medium text-plum-700/50 sm:grid">
                      <span>Tamanho</span>
                      <span>Estoque</span>
                      <span></span>
                    </div>
                    {sizes.length === 0 && (
                      <p className="text-xs text-plum-700/50">
                        Nenhum tamanho cadastrado. Clique em "Adicionar tamanho" para começar.
                      </p>
                    )}
                    {sizes.map((sz, idx) => (
                      <div key={idx} className="grid grid-cols-[1fr_90px_36px] items-center gap-2 sm:grid-cols-[1fr_100px_40px]">
                        <input
                          value={sz.label}
                          onChange={(e) => updateSize(idx, 'label', e.target.value)}
                          placeholder="Aro 18"
                          className="form-input"
                        />
                        <input
                          value={sz.stock}
                          onChange={(e) => updateSize(idx, 'stock', e.target.value)}
                          placeholder="0"
                          inputMode="numeric"
                          className="form-input text-center"
                        />
                        <button
                          type="button"
                          onClick={() => removeSize(idx)}
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-rose-500 transition hover:bg-rose-50"
                          title="Remover tamanho"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addSize}
                      className="inline-flex items-center gap-1.5 rounded-full border border-sand-200 bg-white px-4 py-2 text-xs font-medium text-plum-800 transition hover:border-blush-300 hover:text-blush-600"
                    >
                      <Plus className="h-3.5 w-3.5" /> Adicionar tamanho
                    </button>
                  </div>
                )}

                {!hasSizes && (
                  <div className="mt-3 max-w-xs">
                    <label className="text-xs font-medium text-plum-700/70">
                      Quantidade em estoque <span className="text-blush-500">*</span>
                    </label>
                    <input
                      value={stock}
                      onChange={(e) => setStock(e.target.value)}
                      placeholder="1"
                      inputMode="numeric"
                      className="form-input mt-1"
                    />
                  </div>
                )}
              </div>
            </div>
          </Section>

          {/* Low stock alert */}
          <Section title="Alerta de estoque baixo">
            <div className="sm:col-span-2 space-y-3">
              <label className="flex items-center gap-2 text-sm text-plum-800">
                <input
                  type="checkbox"
                  checked={lowStockAlertEnabled}
                  onChange={(e) => setLowStockAlertEnabled(e.target.checked)}
                  className="accent-blush-500"
                />
                Ativar alerta de estoque baixo
              </label>
              <p className="text-xs text-plum-700/50">
                Quando ativado, o produto aparece no card "Estoque baixo" do dashboard
                {hasSizes ? ' com base na soma do estoque de todos os tamanhos' : ''} quando o estoque
                chegar ao limite definido. Desativado por padrão.
              </p>
              {lowStockAlertEnabled && (
                <div className="max-w-xs">
                  <label className="text-xs font-medium text-plum-700/70">
                    Avisar quando o estoque chegar a
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      value={lowStockThreshold}
                      onChange={(e) => setLowStockThreshold(e.target.value)}
                      placeholder="2"
                      inputMode="numeric"
                      className="form-input w-24"
                    />
                    <span className="text-sm text-plum-700/60">unidades</span>
                  </div>
                </div>
              )}
            </div>
          </Section>

          {/* Status */}
          <Section title="Status">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-plum-800">
                <input
                  type="radio"
                  checked={active}
                  onChange={() => setActive(true)}
                  className="accent-blush-500"
                />
                Ativo (visível na loja)
              </label>
              <label className="flex items-center gap-2 text-sm text-plum-800">
                <input
                  type="radio"
                  checked={!active}
                  onChange={() => setActive(false)}
                  className="accent-blush-500"
                />
                Inativo (oculto na loja)
              </label>
            </div>
          </Section>

          {error && (
            <div className="rounded-xl bg-blush-50 px-4 py-3 text-sm text-blush-700">{error}</div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-blush-500 px-6 py-3 text-sm font-medium text-white transition hover:bg-blush-600 disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Salvando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" /> {mode === 'new' ? 'Cadastrar produto' : 'Salvar alterações'}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => navigateAdmin({ name: 'products' })}
              className="rounded-full border border-sand-200 px-6 py-3 text-sm text-plum-800 transition hover:bg-sand-50"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .form-input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid var(--sand-200, #EFE5DC);
          background: white;
          padding: 0.625rem 0.875rem;
          font-size: 0.875rem;
          color: #2B2228;
        }
        .form-input:focus {
          outline: none;
          border-color: #EFB4BF;
          box-shadow: 0 0 0 2px rgba(239, 180, 191, 0.3);
        }
      `}</style>
    </AdminLayout>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-sand-200 bg-white p-5 shadow-soft">
      <h2 className="font-display text-lg font-semibold text-plum-900">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-plum-700/50">{subtitle}</p>}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({
  label,
  required,
  full,
  children,
}: {
  label: string;
  required?: boolean;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <label className="text-xs font-medium text-plum-700/70">
        {label}
        {required && <span className="text-blush-500"> *</span>}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
