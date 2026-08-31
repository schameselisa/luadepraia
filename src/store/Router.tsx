import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

// ---------------------------------------------------------------------------
// Storefront views (URL-driven)
// ---------------------------------------------------------------------------
export type StoreView =
  | { name: 'home' }
  | { name: 'category'; slug: string }
  | { name: 'product'; id: string }
  | { name: 'search'; query: string }
  | { name: 'cart' }
  | { name: 'orders' }
  | { name: 'account' };

export type AdminView =
  | { name: 'dashboard' }
  | { name: 'products' }
  | { name: 'product-new' }
  | { name: 'product-edit'; id: string }
  | { name: 'import' }
  | { name: 'categories' }
  | { name: 'orders' }
  | { name: 'order-detail'; id: string }
  | { name: 'settings' };

type RouterValue = {
  // storefront
  view: StoreView;
  navigate: (view: StoreView) => void;
  // admin
  adminView: AdminView | null;
  navigateAdmin: (view: AdminView) => void;
  isAdminRoute: boolean;
};

const RouterContext = createContext<RouterValue | null>(null);

function parseStorePath(pathname: string): StoreView {
  const parts = pathname.replace(/^\/+|\/+$/g, '').split('/');
  if (parts.length === 0 || parts[0] === '') return { name: 'home' };
  if (parts[0] === 'cart') return { name: 'cart' };
  if (parts[0] === 'orders') return { name: 'orders' };
  if (parts[0] === 'conta') return { name: 'account' };
  if (parts[0] === 'search') return { name: 'search', query: decodeURIComponent(parts[1] ?? '') };
  if (parts[0] === 'product' && parts[1]) return { name: 'product', id: parts[1] };
  if (parts[0] === 'categoria' && parts[1]) return { name: 'category', slug: parts[1] };
  return { name: 'home' };
}

function parseAdminPath(pathname: string): AdminView | null {
  const parts = pathname.replace(/^\/+|\/+$/g, '').split('/');
  if (parts[0] !== 'admin') return null;
  if (parts.length === 1 || !parts[1]) return { name: 'dashboard' };
  if (parts[1] === 'produtos' && parts[2] === 'novo') return { name: 'product-new' };
  if (parts[1] === 'produtos' && parts[2] === 'importar') return { name: 'import' };
  if (parts[1] === 'produtos' && parts[2] && parts[2] !== 'novo' && parts[2] !== 'importar')
    return { name: 'product-edit', id: parts[2] };
  if (parts[1] === 'produtos') return { name: 'products' };
  if (parts[1] === 'categorias') return { name: 'categories' };
  if (parts[1] === 'pedidos' && parts[2]) return { name: 'order-detail', id: parts[2] };
  if (parts[1] === 'pedidos') return { name: 'orders' };
  if (parts[1] === 'configuracoes') return { name: 'settings' };
  return { name: 'dashboard' };
}

function storeViewToPath(view: StoreView): string {
  switch (view.name) {
    case 'home':
      return '/';
    case 'category':
      return `/categoria/${view.slug}`;
    case 'product':
      return `/product/${view.id}`;
    case 'search':
      return `/search/${encodeURIComponent(view.query)}`;
    case 'cart':
      return '/cart';
    case 'orders':
      return '/orders';
    case 'account':
      return '/conta';
  }
}

function adminViewToPath(view: AdminView): string {
  switch (view.name) {
    case 'dashboard':
      return '/admin';
    case 'products':
      return '/admin/produtos';
    case 'product-new':
      return '/admin/produtos/novo';
    case 'import':
      return '/admin/produtos/importar';
    case 'product-edit':
      return `/admin/produtos/${view.id}`;
    case 'categories':
      return '/admin/categorias';
    case 'orders':
      return '/admin/pedidos';
    case 'order-detail':
      return `/admin/pedidos/${view.id}`;
    case 'settings':
      return '/admin/configuracoes';
  }
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [pathname, setPathname] = useState(() =>
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  useEffect(() => {
    const onPop = () => {
      setPathname(window.location.pathname);
      window.scrollTo(0, 0);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const push = useCallback((path: string) => {
    window.history.pushState({}, '', path);
    setPathname(path);
    window.scrollTo(0, 0);
  }, []);

  const navigate = useCallback(
    (view: StoreView) => push(storeViewToPath(view)),
    [push]
  );
  const navigateAdmin = useCallback(
    (view: AdminView) => push(adminViewToPath(view)),
    [push]
  );

  const isAdminRoute = pathname.startsWith('/admin');
  const adminView = isAdminRoute ? parseAdminPath(pathname) : null;
  const view = isAdminRoute ? { name: 'home' } as StoreView : parseStorePath(pathname);

  return (
    <RouterContext.Provider
      value={{ view, navigate, adminView, navigateAdmin, isAdminRoute }}
    >
      {children}
    </RouterContext.Provider>
  );
}

export function useRouter(): RouterValue {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error('useRouter deve ser usado dentro de RouterProvider');
  return ctx;
}
