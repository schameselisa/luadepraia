import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { slugify, type CategoryRow } from '@/types';
import {
  adminFetchCategories,
  adminFetchProducts,
  adminCreateProduct,
  adminSetProductSizes,
  adminSetProductImages,
  adminUploadProductImage,
  type AdminProductInput,
} from '@/lib/admin';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ParsedSize = {
  size: string;
  stock: number;
};

export type ParsedProduct = {
  sku: string;
  name: string;
  categoryName: string;
  finish: string;
  costPrice: number | null;
  priceRef: number | null;
  salePrice: number;
  stock: number;
  hasSizes: boolean;
  sizesRef: string;
  description: string;
  imageName: string | null;
  statusRef: string;
  reviewNote: string;
  supplier: string | null;
  sizes: ParsedSize[];
};

export type PreviewRow = {
  sku: string;
  name: string;
  categoryName: string;
  finish: string;
  salePrice: number;
  stock: number;
  hasSizes: boolean;
  sizes: ParsedSize[];
  imageName: string | null;
  imageStatus: 'pending' | 'found' | 'none';
  status: 'ok' | 'ignored' | 'error';
  statusMessage: string;
};

export type ImportResult = {
  totalProcessed: number;
  imported: number;
  ignored: number;
  errors: number;
  details: { sku: string; status: 'imported' | 'ignored' | 'error'; message: string }[];
};

// ---------------------------------------------------------------------------
// XLSX parsing
// ---------------------------------------------------------------------------

function cellValue(row: Record<string, unknown>, headers: string[], key: string): string {
  const header = headers.find((h) => h.trim().toLowerCase() === key.toLowerCase());
  if (!header) return '';
  const val = row[header];
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

function numValue(val: string): number | null {
  if (!val) return null;
  const cleaned = val.replace(/[R$\s]/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function intOrZero(val: string): number {
  const n = parseInt(val, 10);
  return isNaN(n) ? 0 : n;
}

export async function parseXlsx(file: File): Promise<{ products: ParsedProduct[]; preview: PreviewRow[] }> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });

  // Parse IMPORTAR sheet
  const importSheetName = wb.SheetNames.find((n) => n.trim().toUpperCase() === 'IMPORTAR');
  if (!importSheetName) {
    throw new Error('Aba "IMPORTAR" não encontrada no arquivo.');
  }
  const importSheet = wb.Sheets[importSheetName];
  const importRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(importSheet, { defval: '' });
  if (importRows.length === 0) {
    throw new Error('A aba "IMPORTAR" está vazia.');
  }

  const headers = Object.keys(importRows[0]);

  // Parse TAMANHOS sheet if it exists
  const sizeMap = new Map<string, ParsedSize[]>();
  const sizesSheetName = wb.SheetNames.find((n) => n.trim().toUpperCase() === 'TAMANHOS');
  if (sizesSheetName) {
    const sizesSheet = wb.Sheets[sizesSheetName];
    const sizesRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sizesSheet, { defval: '' });
    const sizeHeaders = sizesRows.length > 0 ? Object.keys(sizesRows[0]) : [];

    for (const row of sizesRows) {
      const sku = cellValue(row, sizeHeaders, 'SKU').trim();
      const size = cellValue(row, sizeHeaders, 'Tamanho').trim();
      const stockStr = cellValue(row, sizeHeaders, 'Estoque');
      if (!sku || !size) continue;
      const stock = intOrZero(stockStr);
      const arr = sizeMap.get(sku) ?? [];
      arr.push({ size, stock });
      sizeMap.set(sku, arr);
    }
  }

  // Build parsed products
  const products: ParsedProduct[] = [];
  for (const row of importRows) {
    const sku = cellValue(row, headers, 'SKU');
    const name = cellValue(row, headers, 'Nome do produto');
    if (!sku && !name) continue; // skip empty rows

    const sizes = sizeMap.get(sku) ?? [];
    const hasSizesStr = cellValue(row, headers, 'Possui tamanhos?');
    const hasSizes = hasSizesStr.toLowerCase() === 'sim' || sizes.length > 0;

    products.push({
      sku,
      name,
      categoryName: cellValue(row, headers, 'Categoria'),
      finish: cellValue(row, headers, 'Acabamento'),
      costPrice: numValue(cellValue(row, headers, 'Custo real (un.)')),
      priceRef: numValue(cellValue(row, headers, 'Preço x3')),
      salePrice: numValue(cellValue(row, headers, 'Preço de venda')) ?? 0,
      stock: intOrZero(cellValue(row, headers, 'Qtd. estoque')),
      hasSizes,
      sizesRef: cellValue(row, headers, 'Tamanhos / estoque'),
      description: cellValue(row, headers, 'Descrição'),
      imageName: cellValue(row, headers, 'Imagem principal') || null,
      statusRef: cellValue(row, headers, 'Status'),
      reviewNote: cellValue(row, headers, 'Revisar'),
      supplier: cellValue(row, headers, 'Fornecedor') || null,
      sizes,
    });
  }

  // Fetch existing data for validation
  const [existingProducts, categories] = await Promise.all([
    adminFetchProducts(),
    adminFetchCategories(),
  ]);
  const existingSkus = new Set(
    existingProducts
      .map((p) => p.internal_code?.trim())
      .filter((s): s is string => Boolean(s))
  );
  const categoryMap = new Map<string, CategoryRow>();
  for (const cat of categories) {
    categoryMap.set(cat.name.toLowerCase().trim(), cat);
  }

  // Build preview with validation
  const preview: PreviewRow[] = products.map((p) => {
    const imageFileNames = p.imageName ? [p.imageName] : [];
    const imageStatus: PreviewRow['imageStatus'] =
      imageFileNames.length > 0 ? 'pending' : 'none';

    if (!p.sku.trim()) {
      return {
        sku: p.sku || '—',
        name: p.name,
        categoryName: p.categoryName,
        finish: p.finish,
        salePrice: p.salePrice,
        stock: p.stock,
        hasSizes: p.hasSizes,
        sizes: p.sizes,
        imageName: p.imageName,
        imageStatus,
        status: 'error',
        statusMessage: 'SKU não informado',
      };
    }

    if (existingSkus.has(p.sku.trim())) {
      return {
        sku: p.sku,
        name: p.name,
        categoryName: p.categoryName,
        finish: p.finish,
        salePrice: p.salePrice,
        stock: p.stock,
        hasSizes: p.hasSizes,
        sizes: p.sizes,
        imageName: p.imageName,
        imageStatus,
        status: 'ignored',
        statusMessage: 'SKU já cadastrado',
      };
    }

    if (!p.categoryName.trim() || !categoryMap.has(p.categoryName.toLowerCase().trim())) {
      return {
        sku: p.sku,
        name: p.name,
        categoryName: p.categoryName,
        finish: p.finish,
        salePrice: p.salePrice,
        stock: p.stock,
        hasSizes: p.hasSizes,
        sizes: p.sizes,
        imageName: p.imageName,
        imageStatus,
        status: 'error',
        statusMessage: 'Categoria inexistente',
      };
    }

    if (!p.name.trim()) {
      return {
        sku: p.sku,
        name: p.name,
        categoryName: p.categoryName,
        finish: p.finish,
        salePrice: p.salePrice,
        stock: p.stock,
        hasSizes: p.hasSizes,
        sizes: p.sizes,
        imageName: p.imageName,
        imageStatus,
        status: 'error',
        statusMessage: 'Nome não informado',
      };
    }

    return {
      sku: p.sku,
      name: p.name,
      categoryName: p.categoryName,
      finish: p.finish,
      salePrice: p.salePrice,
      stock: p.stock,
      hasSizes: p.hasSizes,
      sizes: p.sizes,
      imageName: p.imageName,
      imageStatus,
      status: 'ok',
      statusMessage: 'Pronto para importar',
    };
  });

  return { products, preview };
}

// ---------------------------------------------------------------------------
// Import execution
// ---------------------------------------------------------------------------

export async function executeImport(
  products: ParsedProduct[],
  preview: PreviewRow[],
  imageFiles: File[]
): Promise<ImportResult> {
  const categories = await adminFetchCategories();
  const categoryMap = new Map<string, CategoryRow>();
  for (const cat of categories) {
    categoryMap.set(cat.name.toLowerCase().trim(), cat);
  }

  // Build image lookup: map SKU prefix → File[]
  const imageLookup = new Map<string, File[]>();
  for (const file of imageFiles) {
    const baseName = file.name.replace(/\.[^.]+$/, ''); // strip extension
    const match = baseName.match(/^(.+?)_(\d+)$/);
    if (match) {
      const sku = match[1];
      const arr = imageLookup.get(sku) ?? [];
      arr.push(file);
      imageLookup.set(sku, arr);
    } else {
      // Single image without _N suffix — treat as _1
      const arr = imageLookup.get(baseName) ?? [];
      arr.push(file);
      imageLookup.set(baseName, arr);
    }
  }

  const details: ImportResult['details'] = [];
  let imported = 0;
  let ignored = 0;
  let errors = 0;

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const pv = preview[i];

    if (pv.status === 'ignored') {
      ignored++;
      details.push({ sku: p.sku, status: 'ignored', message: 'SKU já cadastrado' });
      continue;
    }

    if (pv.status === 'error') {
      errors++;
      details.push({ sku: p.sku || '—', status: 'error', message: pv.statusMessage });
      continue;
    }

    try {
      const category = categoryMap.get(p.categoryName.toLowerCase().trim());
      if (!category) {
        errors++;
        details.push({ sku: p.sku, status: 'error', message: 'Categoria inexistente' });
        continue;
      }

      // Upload images if available
      const imageUrls: { url: string; isMain: boolean }[] = [];
      const files = imageLookup.get(p.sku) ?? [];
      if (files.length > 0) {
        // Sort by _N suffix
        files.sort((a, b) => {
          const aMatch = a.name.match(/_(\d+)\./);
          const bMatch = b.name.match(/_(\d+)\./);
          const aNum = aMatch ? parseInt(aMatch[1], 10) : 1;
          const bNum = bMatch ? parseInt(bMatch[1], 10) : 1;
          return aNum - bNum;
        });
        for (let f = 0; f < files.length; f++) {
          const url = await adminUploadProductImage(files[f]);
          imageUrls.push({ url, isMain: f === 0 });
        }
      }

      const mainImageUrl = imageUrls.length > 0 ? imageUrls[0].url : '';

      const input: AdminProductInput = {
        name: p.name.trim(),
        category_id: category.id,
        description: p.description.trim(),
        price: p.salePrice,
        promotional_price: null,
        cost_price: p.costPrice,
        stock: p.hasSizes ? 0 : p.stock,
        minimum_stock: 5,
        low_stock_alert_enabled: false,
        low_stock_threshold: 2,
        active: false, // Always inactive on import
        image_url: mainImageUrl,
        color: p.finish || null,
        internal_code: p.sku.trim() || null,
        supplier: p.supplier,
      };

      const created = await adminCreateProduct(input);

      // Set sizes if product has them
      if (p.hasSizes && p.sizes.length > 0) {
        await adminSetProductSizes(
          created.id,
          p.sizes.map((sz, idx) => ({
            label: sz.size,
            stock: sz.stock,
            sort_order: idx,
          }))
        );
      }

      // Set gallery images (including main)
      if (imageUrls.length > 0) {
        await adminSetProductImages(
          created.id,
          imageUrls.map((iu) => ({ image_url: iu.url, is_main: iu.isMain }))
        );
      }

      imported++;
      const imgMsg = imageUrls.length === 0 ? ' — Imagem pendente' : '';
      details.push({ sku: p.sku, status: 'imported', message: 'Importado' + imgMsg });
    } catch (err) {
      errors++;
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      let friendly = 'Erro ao criar produto';
      if (msg.includes('products_internal_code_unique_idx')) {
        friendly = 'SKU já cadastrado';
      } else if (msg.includes('products_name_color_unique_idx')) {
        friendly = 'Já existe um produto com esse nome e acabamento';
      }
      details.push({ sku: p.sku, status: 'error', message: friendly });
    }
  }

  return {
    totalProcessed: products.length,
    imported,
    ignored,
    errors,
    details,
  };
}
