import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { CartItem, Product } from '@/types';
import { effectivePrice, totalStock } from '@/types';

type CartContextValue = {
  items: CartItem[];
  count: number;
  total: number;
  add: (product: Product, quantity?: number, sizeId?: string | null, sizeLabel?: string | null) => void;
  remove: (cartKey: string) => void;
  setQuantity: (cartKey: string, quantity: number) => void;
  clear: () => void;
  maxFor: (product: Product, sizeId?: string | null) => number;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = 'lua-de-praia-cart';

export function cartKey(productId: string, sizeId: string | null): string {
  return sizeId ? `${productId}__${sizeId}` : productId;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as CartItem[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* ignore quota errors */
    }
  }, [items]);

  const add = useCallback(
    (product: Product, quantity = 1, sizeId: string | null = null, sizeLabel: string | null = null) => {
      setItems((prev) => {
        const key = cartKey(product.id, sizeId);
        const existing = prev.find((i) => cartKey(i.product.id, i.sizeId) === key);
        if (existing) {
          let max: number;
          if (sizeId) {
            const sz = product.sizes?.find((s) => s.id === sizeId);
            max = sz ? sz.stock : 0;
          } else {
            max = totalStock(product);
          }
          const newQty = Math.min(existing.quantity + quantity, max);
          return prev.map((i) =>
            cartKey(i.product.id, i.sizeId) === key ? { ...i, quantity: newQty } : i
          );
        }
        let max: number;
        if (sizeId) {
          const sz = product.sizes?.find((s) => s.id === sizeId);
          max = sz ? sz.stock : 0;
        } else {
          max = totalStock(product);
        }
        const initQty = Math.min(quantity, max);
        return [...prev, { product, quantity: initQty, sizeId, sizeLabel }];
      });
    },
    []
  );

  const remove = useCallback((key: string) => {
    setItems((prev) => prev.filter((i) => cartKey(i.product.id, i.sizeId) !== key));
  }, []);

  const setQuantity = useCallback((key: string, quantity: number) => {
    setItems((prev) =>
      prev
        .map((i) => {
          if (cartKey(i.product.id, i.sizeId) !== key) return i;
          let max: number;
          if (i.sizeId) {
            const sz = i.product.sizes?.find((s) => s.id === i.sizeId);
            max = sz ? sz.stock : 0;
          } else {
            max = totalStock(i.product);
          }
          return { ...i, quantity: Math.max(1, Math.min(quantity, max)) };
        })
        .filter((i) => i.quantity > 0)
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const maxFor = useCallback((product: Product, sizeId?: string | null) => {
    if (sizeId) {
      const sz = product.sizes?.find((s) => s.id === sizeId);
      return sz ? sz.stock : 0;
    }
    return totalStock(product);
  }, []);

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((s, i) => s + i.quantity, 0);
    const total = items.reduce((s, i) => s + i.quantity * effectivePrice(i.product), 0);
    return { items, count, total, add, remove, setQuantity, clear, maxFor };
  }, [items, add, remove, setQuantity, clear, maxFor]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart deve ser usado dentro de CartProvider');
  return ctx;
}
