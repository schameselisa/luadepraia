import { supabase } from '@/lib/supabase';
import type { CategoryRow, Order, OrderItem, Product, ProductImage, ProductSize, ProductWithCategory } from '@/types';
import { totalStock } from '@/types';

const GENERIC_ERROR = 'Não foi possível concluir a operação. Tente novamente.';

/**
 * Columns of `products` the storefront is allowed to read.
 *
 * `cost_price` is deliberately absent: it is the store's acquisition cost and
 * the database no longer grants SELECT on it to the storefront roles, so `*`
 * would be rejected. Keep this list in sync with the column grants.
 */
const PRODUCT_COLUMNS =
  'id, name, slug, category_id, description, price, promotional_price, image_url, internal_code, color, stock, minimum_stock, low_stock_alert_enabled, low_stock_threshold, supplier, active, deleted_at, created_at, updated_at';

/**
 * Columns of `order_items` the storefront is allowed to read.
 *
 * `unit_cost_snapshot` is deliberately absent: it is the store's cost at the
 * time of sale and must not be served to the shopper who placed the order.
 */
const ORDER_ITEM_COLUMNS =
  'id, order_id, product_id, product_name, unit_price, quantity, subtotal, product_image_url, product_category_name, product_internal_code, product_color, product_size_id, product_size_label';

/**
 * Business-rule messages deliberately raised by the `place_order` database
 * function. These are written for shoppers and are safe to display.
 *
 * Anything else the database returns (constraint names, policy violations,
 * column names) is internal detail and must never reach the interface, so it is
 * replaced with a generic message.
 */
const SAFE_ORDER_MESSAGES = [
  'Carrinho vazio',
  'Quantidade inválida',
  'Produto não encontrado',
  'Produto não disponível',
  'Estoque insuficiente',
  'Selecione um tamanho',
  'Tamanho não disponível',
];

function isSafeOrderMessage(message: string): boolean {
  return SAFE_ORDER_MESSAGES.some((m) => message.startsWith(m));
}

/** A non-revealing error to surface in place of any database error. */
function opaqueError(): Error {
  return new Error(GENERIC_ERROR);
}

function handleError<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw opaqueError();
  if (data === null) throw opaqueError();
  return data;
}

export async function fetchCategories(): Promise<CategoryRow[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true });
  if (error) throw opaqueError();
  return data ?? [];
}

export async function fetchProducts(): Promise<ProductWithCategory[]> {
  const { data, error } = await supabase
    .from('products')
    .select(`${PRODUCT_COLUMNS}, category:categories(*)`)
    .eq('active', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (error) throw opaqueError();
  const products = (data ?? []) as unknown as ProductWithCategory[];
  // Fetch sizes for all products in one query
  const productIds = products.map((p) => p.id);
  const sizesMap = await fetchSizesMap(productIds);
  return products
    .map((p) => ({ ...p, sizes: sizesMap.get(p.id) ?? [] }))
    .filter((p) => totalStock(p) > 0);
}

export async function fetchProduct(id: string): Promise<ProductWithCategory> {
  const { data, error } = await supabase
    .from('products')
    .select(`${PRODUCT_COLUMNS}, category:categories(*)`)
    .eq('id', id)
    .maybeSingle();
  const product = handleError<ProductWithCategory>(data as ProductWithCategory | null, error);
  const sizes = await fetchProductSizes(id);
  return { ...product, sizes };
}

export async function fetchProductsByCategorySlug(slug: string): Promise<ProductWithCategory[]> {
  const { data, error } = await supabase
    .from('products')
    .select(`${PRODUCT_COLUMNS}, category:categories!inner(*)`)
    .eq('active', true)
    .is('deleted_at', null)
    .eq('categories.slug', slug)
    .order('created_at', { ascending: true });
  if (error) throw opaqueError();
  const products = (data ?? []) as unknown as ProductWithCategory[];
  const productIds = products.map((p) => p.id);
  const sizesMap = await fetchSizesMap(productIds);
  return products
    .map((p) => ({ ...p, sizes: sizesMap.get(p.id) ?? [] }))
    .filter((p) => totalStock(p) > 0);
}

export async function fetchProductImages(productId: string): Promise<ProductImage[]> {
  const { data, error } = await supabase
    .from('product_images')
    .select('*')
    .eq('product_id', productId)
    .order('is_main', { ascending: false })
    .order('sort_order', { ascending: true });
  if (error) throw opaqueError();
  return data ?? [];
}

export async function fetchProductSizes(productId: string): Promise<ProductSize[]> {
  const { data, error } = await supabase
    .from('product_sizes')
    .select('*')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true });
  if (error) throw opaqueError();
  return data ?? [];
}

async function fetchSizesMap(productIds: string[]): Promise<Map<string, ProductSize[]>> {
  if (productIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from('product_sizes')
    .select('*')
    .in('product_id', productIds)
    .order('sort_order', { ascending: true });
  if (error) throw opaqueError();
  const map = new Map<string, ProductSize[]>();
  for (const sz of data ?? []) {
    const arr = map.get(sz.product_id) ?? [];
    arr.push(sz as ProductSize);
    map.set(sz.product_id, arr);
  }
  return map;
}

/**
 * Fetch the signed-in customer's own orders.
 *
 * `customerId` is required: an unscoped read of this table must never be issued
 * from the storefront. The database also enforces this (a customer may only
 * select rows where customer_id = auth.uid()), but the query itself is scoped so
 * the intent is explicit here too.
 */
export async function fetchOrders(customerId: string): Promise<Order[]> {
  if (!customerId) return [];
  const { data, error } = await supabase
    .from('orders')
    .select(`*, order_items(${ORDER_ITEM_COLUMNS})`)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });
  if (error) throw opaqueError();
  return data ?? [];
}

export type PlaceOrderInput = {
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  items: { product: Product; quantity: number; sizeId: string | null }[];
};

export async function placeOrder({
  customerName,
  customerEmail,
  customerPhone,
  items,
}: PlaceOrderInput): Promise<{ id: string; number: string; total: number }> {
  const payload = items.map((i) => ({
    product_id: i.product.id,
    quantity: i.quantity,
    size_id: i.sizeId ?? '',
  }));

  // The order is always filed under the caller's own session server-side; the
  // client does not send an owner id.
  const { data, error } = await supabase.rpc('place_order', {
    p_customer_name: customerName,
    p_customer_email: customerEmail ?? null,
    p_customer_phone: customerPhone ?? null,
    p_items: payload,
  });

  if (error) {
    throw isSafeOrderMessage(error.message)
      ? new Error(error.message)
      : new Error('Não foi possível finalizar o pedido. Tente novamente.');
  }
  if (!data) throw new Error('Não foi possível finalizar o pedido. Tente novamente.');

  return data as { id: string; number: string; total: number };
}

export type { OrderItem };
