// ---------------------------------------------------------------------------
// Public / shared domain types (mirror the Postgres schema)
// ---------------------------------------------------------------------------

export type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  active: boolean;
  sort_order: number;
  created_at: string;
};

export type CategoryWithCount = CategoryRow & { product_count: number };

export type ProductSize = {
  id: string;
  product_id: string;
  label: string;
  stock: number;
  sort_order: number;
  created_at: string;
};

export const COLOR_OPTIONS: string[] = ['Dourado', 'Prata'];

export type ProductImage = {
  id: string;
  product_id: string;
  image_url: string;
  is_main: boolean;
  sort_order: number;
  created_at: string;
};

export type Product = {
  id: string;
  name: string;
  slug: string;
  category_id: string;
  description: string;
  price: number;
  promotional_price: number | null;
  /**
   * Acquisition cost. Not readable through the data API: the storefront and
   * admin product queries omit it, and admins read it through the
   * `admin_get_product_cost` function instead.
   */
  cost_price?: number | null;
  image_url: string;
  images?: ProductImage[];
  internal_code: string | null;
  color: string | null;
  sizes?: ProductSize[];
  stock: number;
  minimum_stock: number;
  low_stock_alert_enabled: boolean;
  low_stock_threshold: number;
  supplier: string | null;
  active: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProductWithCategory = Product & {
  category?: CategoryRow;
};

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'completed'
  | 'cancelled';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Aguardando confirmação',
  confirmed: 'Pedido confirmado',
  preparing: 'Em separação',
  ready: 'Pronto para retirada',
  completed: 'Concluído',
  cancelled: 'Cancelado',
};

export const ORDER_STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: 'pending', label: 'Aguardando confirmação' },
  { value: 'confirmed', label: 'Pedido confirmado' },
  { value: 'preparing', label: 'Em separação' },
  { value: 'ready', label: 'Pronto para retirada' },
  { value: 'completed', label: 'Concluído' },
  { value: 'cancelled', label: 'Cancelado' },
];

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
  product_image_url: string | null;
  product_category_name: string | null;
  product_internal_code: string | null;
  product_color: string | null;
  product_size_id: string | null;
  product_size_label: string | null;
  /**
   * Store cost at the time of sale. Not readable through the data API; cost and
   * profit figures are computed server-side for admins only.
   */
  unit_cost_snapshot?: number | null;
};

export type OrderStatusHistoryEntry = {
  id: string;
  order_id: string;
  status: OrderStatus;
  note: string;
  created_at: string;
};

export type Order = {
  id: string;
  number: string;
  status: OrderStatus;
  total: number;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
  order_status_history?: OrderStatusHistoryEntry[];
};

export type CartItem = {
  product: Product;
  quantity: number;
  sizeId: string | null;
  sizeLabel: string | null;
};

export const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);

export const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

export const formatDateTime = (iso: string): string =>
  new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export const slugify = (text: string): string =>
  text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const effectivePrice = (product: Product): number =>
  product.promotional_price !== null && product.promotional_price < product.price
    ? product.promotional_price
    : product.price;

/**
 * Returns the display name: product name plus color suffix if not already in name.
 * Example: "Anel Trinity" + "Prata" → "Anel Trinity — Prata"
 */
export const displayName = (product: { name: string; color: string | null }): string => {
  if (!product.color) return product.name;
  if (product.name.toLowerCase().includes(product.color.toLowerCase())) return product.name;
  return `${product.name} — ${product.color}`;
};

/**
 * Total available stock: sum of size stocks if sizes exist, otherwise product stock.
 */
export const totalStock = (product: Product): number => {
  if (product.sizes && product.sizes.length > 0) {
    return product.sizes.reduce((s, sz) => s + sz.stock, 0);
  }
  return product.stock;
};

/**
 * Whether a product is considered "low stock" based on the optional per-product alert.
 * Only products with low_stock_alert_enabled=true and totalStock <= threshold count.
 * Out-of-stock products are NOT low stock — they are sold out (a separate concept).
 */
export const isLowStock = (product: Product): boolean => {
  const stock = totalStock(product);
  if (stock <= 0) return false;
  if (!product.low_stock_alert_enabled) return false;
  return stock <= product.low_stock_threshold;
};
