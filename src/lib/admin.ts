import { supabase } from '@/lib/supabase';
import { slugify, isLowStock, totalStock, type CategoryRow, type Order, type Product, type ProductImage, type ProductSize } from '@/types';

/**
 * Columns of `products` readable through the data API.
 *
 * `cost_price` is excluded on purpose: the database does not grant SELECT on it
 * to the `authenticated` role, so `*` would be rejected. Read the cost through
 * `adminGetProductCost`, which is guarded server-side by an admin check.
 */
const PRODUCT_COLUMNS =
  'id, name, slug, category_id, description, price, promotional_price, image_url, internal_code, color, stock, minimum_stock, low_stock_alert_enabled, low_stock_threshold, supplier, active, deleted_at, created_at, updated_at';

/**
 * Columns of `order_items` readable through the data API.
 *
 * `unit_cost_snapshot` is excluded on purpose. Cost and profit figures come
 * from `adminFetchFinancialSummary`, which computes them server-side.
 */
const ORDER_ITEM_COLUMNS =
  'id, order_id, product_id, product_name, unit_price, quantity, subtotal, product_image_url, product_category_name, product_internal_code, product_color, product_size_id, product_size_label';

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export type AdminProductInput = {
  name: string;
  category_id: string;
  description: string;
  price: number;
  promotional_price: number | null;
  cost_price: number | null;
  stock: number;
  minimum_stock: number;
  low_stock_alert_enabled: boolean;
  low_stock_threshold: number;
  active: boolean;
  image_url: string;
  color: string | null;
  internal_code: string | null;
  supplier: string | null;
};

export async function adminFetchProducts(): Promise<(Product & { category: CategoryRow; sizes: ProductSize[] })[]> {
  const { data, error } = await supabase
    .from('products')
    .select(`${PRODUCT_COLUMNS}, category:categories(*)`)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  const products = (data ?? []) as unknown as (Product & { category: CategoryRow })[];
  if (products.length === 0) return [];
  // Batch fetch sizes for all products
  const productIds = products.map((p) => p.id);
  const { data: sizesData, error: sizesErr } = await supabase
    .from('product_sizes')
    .select('*')
    .in('product_id', productIds)
    .order('sort_order', { ascending: true });
  if (sizesErr) throw new Error(sizesErr.message);
  const sizesMap = new Map<string, ProductSize[]>();
  for (const sz of (sizesData ?? []) as ProductSize[]) {
    const arr = sizesMap.get(sz.product_id) ?? [];
    arr.push(sz);
    sizesMap.set(sz.product_id, arr);
  }
  return products.map((p) => ({ ...p, sizes: sizesMap.get(p.id) ?? [] }));
}

export async function adminFetchProduct(id: string): Promise<(Product & { category: CategoryRow }) | null> {
  const { data, error } = await supabase
    .from('products')
    .select(`${PRODUCT_COLUMNS}, category:categories(*)`)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as unknown as (Product & { category: CategoryRow }) | null;
}

/**
 * Read one product's acquisition cost.
 *
 * The column is not readable through the data API; this RPC is SECURITY DEFINER
 * and raises unless the caller passes the server-side admin check.
 */
export async function adminGetProductCost(productId: string): Promise<number | null> {
  const { data, error } = await supabase.rpc('admin_get_product_cost', {
    p_product_id: productId,
  });
  if (error) throw new Error(error.message);
  return data === null || data === undefined ? null : Number(data);
}

export async function adminFetchProductSizes(productId: string): Promise<ProductSize[]> {
  const { data, error } = await supabase
    .from('product_sizes')
    .select('*')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ProductSize[];
}

export async function adminSetProductSizes(
  productId: string,
  sizes: { id?: string; label: string; stock: number; sort_order: number }[]
): Promise<void> {
  // Delete existing sizes not in the list
  const existingIds = sizes.filter((s) => s.id).map((s) => s.id!);
  if (existingIds.length > 0) {
  const { error: delErr } = await supabase
      .from('product_sizes')
      .delete()
      .eq('product_id', productId)
      .not('id', 'in', `(${existingIds.join(',')})`);
    if (delErr) throw new Error(delErr.message);
  } else {
    const { error: delErr } = await supabase
      .from('product_sizes')
      .delete()
      .eq('product_id', productId);
    if (delErr) throw new Error(delErr.message);
  }

  for (const sz of sizes) {
    if (sz.id) {
      const { error } = await supabase
        .from('product_sizes')
        .update({ label: sz.label, stock: sz.stock, sort_order: sz.sort_order })
        .eq('id', sz.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from('product_sizes')
        .insert({ product_id: productId, label: sz.label, stock: sz.stock, sort_order: sz.sort_order });
      if (error) throw new Error(error.message);
    }
  }
}

export async function adminCreateProduct(input: AdminProductInput): Promise<Product> {
  const body = {
    ...input,
    slug: slugify(input.name) + '-' + Math.random().toString(36).slice(2, 8),
  };
  const { data, error } = await supabase
    .from('products')
    .insert(body)
    .select(PRODUCT_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as Product;
}

export async function adminUpdateProduct(id: string, input: Partial<AdminProductInput>): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .update(input)
    .eq('id', id)
    .select(PRODUCT_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as Product;
}

export async function adminDuplicateProduct(id: string): Promise<Product> {
  const source = await adminFetchProduct(id);
  if (!source) throw new Error('Produto não encontrado');

  // The cost is not part of the readable product payload, so fetch it through
  // the admin-guarded function to carry it over to the copy.
  const sourceCost = await adminGetProductCost(id).catch(() => null);

  const copy: AdminProductInput = {
    name: `${source.name} — Cópia`,
    category_id: source.category_id,
    description: source.description,
    price: source.price,
    promotional_price: source.promotional_price,
    cost_price: sourceCost,
    stock: source.stock,
    minimum_stock: source.minimum_stock,
    low_stock_alert_enabled: source.low_stock_alert_enabled,
    low_stock_threshold: source.low_stock_threshold,
    active: false,
    image_url: source.image_url,
    color: source.color,
    internal_code: null,
    supplier: source.supplier,
  };
  const product = await adminCreateProduct(copy);

  const images = await adminFetchProductImages(id);
  if (images.length > 0) {
    await adminSetProductImages(
      product.id,
      images.map((img) => ({ image_url: img.image_url, is_main: img.is_main }))
    );
  }
  return product;
}

export async function adminSoftDeleteProduct(id: string): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update({ deleted_at: new Date().toISOString(), active: false })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function adminToggleProductActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update({ active })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Product images
// ---------------------------------------------------------------------------

export async function adminFetchProductImages(productId: string): Promise<ProductImage[]> {
  const { data, error } = await supabase
    .from('product_images')
    .select('*')
    .eq('product_id', productId)
    .order('is_main', { ascending: false })
    .order('sort_order', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function adminSetProductImages(
  productId: string,
  images: { image_url: string; is_main: boolean }[]
): Promise<void> {
  await supabase.from('product_images').delete().eq('product_id', productId);
  if (images.length === 0) return;

  const rows = images.map((img, idx) => ({
    product_id: productId,
    image_url: img.image_url,
    is_main: img.is_main,
    sort_order: idx,
  }));
  const { error } = await supabase.from('product_images').insert(rows);
  if (error) throw new Error(error.message);

  const mainImage = images.find((i) => i.is_main) ?? images[0];
  if (mainImage) {
    await supabase
      .from('products')
      .update({ image_url: mainImage.image_url })
      .eq('id', productId);
  }
}

export async function adminUploadProductImage(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const path = `products/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('product-images')
    .upload(path, file, { cacheControl: '3600', upsert: false });
  if (uploadError) throw new Error(uploadError.message);

  const { data } = supabase.storage.from('product-images').getPublicUrl(path);
  return data.publicUrl;
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export type AdminCategoryInput = {
  name: string;
  slug?: string;
  description: string;
  image: string;
  active: boolean;
  sort_order: number;
};

export type CategoryWithCount = CategoryRow & { product_count: number };

export async function adminFetchCategories(): Promise<CategoryRow[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function adminFetchCategoriesWithCounts(): Promise<CategoryWithCount[]> {
  const [categories, products] = await Promise.all([
    adminFetchCategories(),
    adminFetchProducts(),
  ]);
  return categories.map((cat) => ({
    ...cat,
    product_count: products.filter((p) => p.category_id === cat.id).length,
  }));
}

export async function adminCreateCategory(input: AdminCategoryInput): Promise<CategoryRow> {
  const body = {
    name: input.name,
    slug: input.slug && input.slug.trim() ? input.slug : slugify(input.name),
    description: input.description,
    image: input.image,
    active: input.active,
    sort_order: input.sort_order,
  };
  const { data, error } = await supabase
    .from('categories')
    .insert(body)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as CategoryRow;
}

export async function adminUpdateCategory(id: string, input: Partial<AdminCategoryInput>): Promise<void> {
  const body: Record<string, unknown> = { ...input };
  if (input.slug !== undefined) {
    body.slug = input.slug.trim() ? input.slug : slugify(input.name ?? '');
  }
  const { error } = await supabase.from('categories').update(body).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function adminDeleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export async function adminFetchOrders(): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(`*, order_items(${ORDER_ITEM_COLUMNS})`)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function adminFetchOrder(id: string): Promise<Order | null> {
  const { data, error } = await supabase
    .from('orders')
    .select(`*, order_items(${ORDER_ITEM_COLUMNS}), order_status_history(*)`)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Order | null;
}

export async function adminUpdateOrderStatus(
  orderId: string,
  status: Order['status'],
  note = ''
): Promise<void> {
  const { error } = await supabase.rpc('update_order_status', {
    p_order_id: orderId,
    p_status: status,
    p_note: note,
  });
  if (error) throw new Error(error.message);
}

export async function adminDeleteOrder(orderId: string, password: string): Promise<void> {
  const { error } = await supabase.rpc('admin_delete_order', {
    p_order_id: orderId,
    p_password: password,
  });
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Dashboard stats
// ---------------------------------------------------------------------------

/**
 * Realized financial figures, computed entirely server-side.
 *
 * The per-item costs this is derived from are not readable through the data
 * API, so the aggregation happens in an admin-guarded database function rather
 * than in the browser.
 */
export type FinancialSummary = {
  revenue: number;
  cogs: number;
  profit: number;
  margin: number;
  avgTicket: number;
  completedOrders: number;
  hasUnknownCost: boolean;
};

export async function adminFetchFinancialSummary(): Promise<FinancialSummary> {
  const { data, error } = await supabase.rpc('admin_financial_summary');
  if (error) throw new Error(error.message);
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    revenue: Number(row.revenue ?? 0),
    cogs: Number(row.cogs ?? 0),
    profit: Number(row.profit ?? 0),
    margin: Number(row.margin ?? 0),
    avgTicket: Number(row.avg_ticket ?? 0),
    completedOrders: Number(row.completed_orders ?? 0),
    hasUnknownCost: Boolean(row.has_unknown_cost),
  };
}

export type DashboardStats = {
  totalProducts: number;
  activeProducts: number;
  outOfStock: number;
  lowStock: number;
  receivedOrders: number;
  preparingOrders: number;
  totalRevenue: number;
  openOrdersValue: number;
  completedRevenue: number;
  completedCOGS: number;
  completedProfit: number;
  completedMargin: number;
  avgTicket: number;
  hasOrdersWithUnknownCost: boolean;
  completedOrderCount: number;
};

export type StockFinancials = {
  invested: number;
  potential: number;
  profit: number;
};

export type ProductCostInfo = {
  product_id: string;
  cost_price: number | null;
  price: number;
  stock: number;
  created_at: string;
};

export async function adminFetchAllProductCosts(): Promise<ProductCostInfo[]> {
  const { data, error } = await supabase.rpc('admin_get_all_product_costs');
  if (error) throw new Error(error.message);
  return (data ?? []) as ProductCostInfo[];
}

export async function adminFetchStockFinancials(
  dateFrom?: string,
  dateTo?: string
): Promise<StockFinancials> {
  const [products, costs] = await Promise.all([
    adminFetchProducts(),
    adminFetchAllProductCosts(),
  ]);

  const costMap = new Map<string, number | null>();
  for (const c of costs) {
    costMap.set(c.product_id, c.cost_price);
  }

  let invested = 0;
  let potential = 0;

  for (const p of products) {
    // Apply date filter on created_at
    if (dateFrom && p.created_at < dateFrom) continue;
    if (dateTo && p.created_at > dateTo + 'T23:59:59') continue;

    const stock = totalStock(p);
    if (stock <= 0) continue;

    const cost = costMap.get(p.id) ?? null;
    const salePrice = p.promotional_price !== null && p.promotional_price < p.price
      ? p.promotional_price
      : p.price;

    if (cost !== null) {
      invested += cost * stock;
    }
    potential += salePrice * stock;
  }

  return {
    invested,
    potential,
    profit: potential - invested,
  };
}

export async function adminFetchStats(): Promise<DashboardStats> {
  const [products, orders, financials] = await Promise.all([
    adminFetchProducts(),
    adminFetchOrders(),
    adminFetchFinancialSummary(),
  ]);

  const active = products.filter((p) => p.active);
  const outOfStock = products.filter((p) => totalStock(p) <= 0);
  const lowStock = products.filter((p) => isLowStock(p));
  const received = orders.filter((o) => o.status === 'pending' || o.status === 'confirmed');
  const preparing = orders.filter((o) => o.status === 'preparing');
  const revenue = orders
    .filter((o) => o.status !== 'cancelled')
    .reduce((s, o) => s + Number(o.total), 0);

  // Open orders value: all non-cancelled, non-completed orders
  const openOrdersValue = orders
    .filter((o) => o.status !== 'cancelled' && o.status !== 'completed')
    .reduce((s, o) => s + Number(o.total), 0);

  return {
    totalProducts: products.length,
    activeProducts: active.length,
    outOfStock: outOfStock.length,
    lowStock: lowStock.length,
    receivedOrders: received.length,
    preparingOrders: preparing.length,
    totalRevenue: revenue,
    openOrdersValue,
    completedRevenue: financials.revenue,
    completedCOGS: financials.cogs,
    completedProfit: financials.profit,
    completedMargin: financials.margin,
    avgTicket: financials.avgTicket,
    hasOrdersWithUnknownCost: financials.hasUnknownCost,
    completedOrderCount: financials.completedOrders,
  };
}
