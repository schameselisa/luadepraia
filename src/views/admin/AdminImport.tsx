import { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FileSpreadsheet,
  ImagePlus,
  Loader2,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import { useRouter } from '@/store/Router';
import { AdminLayout } from './AdminLayout';
import {
  parseXlsx,
  executeImport,
  type ParsedProduct,
  type PreviewRow,
  type ImportResult,
} from '@/lib/importProducts';
import { formatCurrency } from '@/types';

type Phase = 'select' | 'preview' | 'importing' | 'results';

export function AdminImport() {
  const { navigateAdmin } = useRouter();
  const [phase, setPhase] = useState<Phase>('select');
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [xlsxFile, setXlsxFile] = useState<File | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [products, setProducts] = useState<ParsedProduct[]>([]);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleXlsxSelect = async (file: File) => {
    setXlsxFile(file);
    setError(null);
    setParsing(true);
    try {
      const { products: parsed, preview: pv } = await parseXlsx(file);
      setProducts(parsed);
      setPreview(pv);
      setPhase('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao ler o arquivo.');
      setProducts([]);
      setPreview([]);
    } finally {
      setParsing(false);
    }
  };

  const handleImagesSelect = (files: FileList) => {
    const valid = Array.from(files).filter((f) => f.type.startsWith('image/'));
    setImageFiles((prev) => [...prev, ...valid]);
  };

  const removeImage = (idx: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleConfirm = async () => {
    setPhase('importing');
    setError(null);
    try {
      const res = await executeImport(products, preview, imageFiles);
      setResult(res);
      setPhase('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro durante a importação.');
      setPhase('preview');
    }
  };

  const handleReset = () => {
    setPhase('select');
    setXlsxFile(null);
    setImageFiles([]);
    setProducts([]);
    setPreview([]);
    setResult(null);
    setError(null);
  };

  const okCount = preview.filter((p) => p.status === 'ok').length;
  const ignoredCount = preview.filter((p) => p.status === 'ignored').length;
  const errorCount = preview.filter((p) => p.status === 'error').length;

  return (
    <AdminLayout current="import">
      <div className="fade-in">
        <button
          onClick={() => navigateAdmin({ name: 'products' })}
          className="mb-4 inline-flex items-center gap-2 text-sm text-plum-700/60 transition hover:text-plum-900"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para produtos
        </button>

        <h1 className="font-display text-2xl font-semibold text-plum-900">Importar produtos</h1>
        <p className="mt-1 text-sm text-plum-700/50">
          Selecione um arquivo .xlsx com a aba "IMPORTAR" para cadastrar vários produtos de uma vez.
        </p>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Phase 1: Select file */}
        {phase === 'select' && (
          <div className="mt-6 space-y-6">
            <div className="rounded-2xl border border-sand-200 bg-white p-6 shadow-soft">
              <h2 className="font-display text-lg font-semibold text-plum-900">1. Selecione o arquivo</h2>
              <p className="mt-1 text-xs text-plum-700/50">
                O arquivo deve conter uma aba chamada "IMPORTAR" com os cabeçalhos corretos.
              </p>

              <label className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-sand-300 bg-sand-50/50 px-6 py-10 text-center transition hover:border-blush-300 hover:bg-blush-50/30">
                {parsing ? (
                  <Loader2 className="h-8 w-8 animate-spin text-blush-500" />
                ) : (
                  <FileSpreadsheet className="h-8 w-8 text-plum-700/40" />
                )}
                <span className="text-sm font-medium text-plum-800">
                  {parsing ? 'Lendo arquivo...' : 'Selecionar arquivo .xlsx'}
                </span>
                <span className="text-xs text-plum-700/40">
                  Arraste ou clique para escolher a planilha
                </span>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleXlsxSelect(e.target.files[0]);
                    }
                  }}
                />
              </label>
            </div>

            {/* Image upload (optional, can be done in preview too) */}
            <div className="rounded-2xl border border-sand-200 bg-white p-6 shadow-soft">
              <h2 className="font-display text-lg font-semibold text-plum-900">
                Imagens (opcional)
              </h2>
              <p className="mt-1 text-xs text-plum-700/50">
                Selecione múltiplas imagens nomeadas pelo SKU. Ex: <code className="rounded bg-sand-100 px-1">ANL35_1.jpg</code> (principal), <code className="rounded bg-sand-100 px-1">ANL35_2.jpg</code> (galeria).
              </p>

              <label className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-sand-300 bg-sand-50/50 px-6 py-6 text-center transition hover:border-sky-300 hover:bg-sky-50/30">
                <ImagePlus className="h-6 w-6 text-plum-700/40" />
                <span className="text-sm text-plum-800">Selecionar imagens</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => e.target.files && handleImagesSelect(e.target.files)}
                />
              </label>

              {imageFiles.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {imageFiles.map((f, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-1.5 rounded-full bg-sand-100 px-3 py-1 text-xs text-plum-800"
                    >
                      <span className="max-w-32 truncate">{f.name}</span>
                      <button
                        onClick={() => removeImage(idx)}
                        className="text-plum-700/40 hover:text-rose-500"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Phase 2: Preview */}
        {phase === 'preview' && (
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-sand-200 bg-white p-5 shadow-soft">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold text-plum-900">
                    {products.length} produtos encontrados
                  </h2>
                  <p className="mt-1 text-xs text-plum-700/50">
                    {okCount} prontos · {ignoredCount} ignorados · {errorCount} com erro
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleReset}
                    className="rounded-full border border-sand-200 px-4 py-2 text-sm text-plum-800 transition hover:bg-sand-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={okCount === 0}
                    className="inline-flex items-center gap-2 rounded-full bg-blush-500 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-blush-600 disabled:opacity-40"
                  >
                    <Upload className="h-4 w-4" /> Importar {okCount} produto{okCount !== 1 ? 's' : ''}
                  </button>
                </div>
              </div>
            </div>

            {/* Preview table */}
            <div className="overflow-x-auto rounded-2xl border border-sand-200 bg-white shadow-soft">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-sand-200 text-left text-xs font-medium text-plum-700/50">
                    <th className="px-3 py-2.5">SKU</th>
                    <th className="px-3 py-2.5">Nome</th>
                    <th className="px-3 py-2.5">Categoria</th>
                    <th className="px-3 py-2.5">Acab.</th>
                    <th className="px-3 py-2.5 text-right">Preço</th>
                    <th className="px-3 py-2.5 text-right">Estoque</th>
                    <th className="px-3 py-2.5">Tamanhos</th>
                    <th className="px-3 py-2.5">Imagem</th>
                    <th className="px-3 py-2.5">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-sand-100 last:border-0 text-plum-800"
                    >
                      <td className="px-3 py-2.5 font-mono text-xs">{row.sku || '—'}</td>
                      <td className="px-3 py-2.5 max-w-48 truncate">{row.name || '—'}</td>
                      <td className="px-3 py-2.5 text-xs">{row.categoryName || '—'}</td>
                      <td className="px-3 py-2.5 text-xs">{row.finish || '—'}</td>
                      <td className="px-3 py-2.5 text-right text-xs">{formatCurrency(row.salePrice)}</td>
                      <td className="px-3 py-2.5 text-right text-xs">
                        {row.hasSizes
                          ? row.sizes.map((s) => `${s.size}:${s.stock}`).join(', ')
                          : row.stock}
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        {row.hasSizes ? `${row.sizes.length} tam.` : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        {row.imageStatus === 'none' ? (
                          <span className="text-amber-600">Pendente</span>
                        ) : (
                          <span className="text-plum-700/50">{row.imageName}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={row.status} message={row.statusMessage} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Image upload in preview phase too */}
            <div className="rounded-2xl border border-sand-200 bg-white p-5 shadow-soft">
              <h3 className="text-sm font-semibold text-plum-900">Imagens</h3>
              <p className="mt-1 text-xs text-plum-700/50">
                {imageFiles.length > 0
                  ? `${imageFiles.length} imagem(ns) selecionada(s).`
                  : 'Nenhuma imagem selecionada. Os produtos serão importados sem imagem.'}
              </p>
              <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-full border border-sand-200 bg-white px-4 py-2 text-xs font-medium text-plum-800 transition hover:border-sky-300">
                <ImagePlus className="h-3.5 w-3.5" /> Adicionar imagens
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => e.target.files && handleImagesSelect(e.target.files)}
                />
              </label>
              {imageFiles.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {imageFiles.map((f, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-1 rounded-full bg-sand-100 px-2.5 py-0.5 text-[10px] text-plum-800"
                    >
                      <span className="max-w-28 truncate">{f.name}</span>
                      <button
                        onClick={() => removeImage(idx)}
                        className="text-plum-700/40 hover:text-rose-500"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <p className="text-center text-xs text-plum-700/40">
              Todos os produtos importados serão criados como inativos. Você poderá revisá-los e ativá-los manualmente.
            </p>
          </div>
        )}

        {/* Phase 3: Importing */}
        {phase === 'importing' && (
          <div className="mt-10 flex flex-col items-center justify-center gap-3 py-20">
            <Loader2 className="h-8 w-8 animate-spin text-blush-500" />
            <p className="text-sm text-plum-700/60">Importando produtos...</p>
          </div>
        )}

        {/* Phase 4: Results */}
        {phase === 'results' && result && (
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-sand-200 bg-white p-6 shadow-soft">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckCircle2 className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-display text-xl font-semibold text-plum-900">
                    {result.totalProcessed} produtos processados
                  </h2>
                  <p className="text-sm text-plum-700/50">
                    {result.imported} importados · {result.ignored} ignorados · {result.errors} com erro
                  </p>
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="overflow-x-auto rounded-2xl border border-sand-200 bg-white shadow-soft">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-sand-200 text-left text-xs font-medium text-plum-700/50">
                    <th className="px-3 py-2.5">SKU</th>
                    <th className="px-3 py-2.5">Situação</th>
                    <th className="px-3 py-2.5">Detalhe</th>
                  </tr>
                </thead>
                <tbody>
                  {result.details.map((d, idx) => (
                    <tr key={idx} className="border-b border-sand-100 last:border-0 text-plum-800">
                      <td className="px-3 py-2.5 font-mono text-xs">{d.sku || '—'}</td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={d.status === 'imported' ? 'ok' : d.status === 'ignored' ? 'ignored' : 'error'} message={d.status === 'imported' ? 'Importado' : d.status === 'ignored' ? 'Ignorado' : 'Erro'} />
                      </td>
                      <td className="px-3 py-2.5 text-xs text-plum-700/60">{d.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleReset}
                className="rounded-full border border-sand-200 px-5 py-2.5 text-sm text-plum-800 transition hover:bg-sand-50"
              >
                Importar outro arquivo
              </button>
              <button
                onClick={() => navigateAdmin({ name: 'products' })}
                className="rounded-full bg-navy-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-navy-800"
              >
                Ver produtos
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function StatusBadge({ status, message }: { status: 'ok' | 'ignored' | 'error'; message: string }) {
  if (status === 'ok') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
        <CheckCircle2 className="h-3 w-3" /> {message}
      </span>
    );
  }
  if (status === 'ignored') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
        <AlertCircle className="h-3 w-3" /> {message}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-700">
      <XCircle className="h-3 w-3" /> {message}
    </span>
  );
}
