import { lazy, Suspense, useMemo, useState } from 'react';
import { Menu, Search, ShoppingBag } from 'lucide-react';
import { CartProvider, useCart } from '@/store/CartContext';
import { RouterProvider, useRouter } from '@/store/Router';
import { CategoriesProvider } from '@/store/CategoriesContext';
import { AdminAuthProvider, useAdminAuth } from '@/store/AdminAuthContext';
import { CustomerAuthProvider } from '@/store/CustomerAuthContext';
import { Sidebar } from '@/components/Sidebar';
import { Logo } from '@/components/Logo';
import { SearchOverlay } from '@/components/SearchOverlay';
import logoBlue from '@/assets/lua-de-praia-logo-blue.png';
import { Catalog } from '@/views/Catalog';
import { ProductDetails } from '@/views/ProductDetails';
import { Cart } from '@/views/Cart';
import { OrderList } from '@/views/OrderList';
import { Account } from '@/views/Account';
import { AdminLogin } from '@/views/admin/AdminLogin';
import { AdminDashboard } from '@/views/admin/AdminDashboard';
import { AdminProducts } from '@/views/admin/AdminProducts';
import { AdminProductForm } from '@/views/admin/AdminProductForm';
const AdminImport = lazy(() => import('@/views/admin/AdminImport').then((m) => ({ default: m.AdminImport })));
import { AdminCategories } from '@/views/admin/AdminCategories';
import { AdminOrders } from '@/views/admin/AdminOrders';
import { AdminOrderDetail } from '@/views/admin/AdminOrderDetail';
import { AdminSettings } from '@/views/admin/AdminSettings';

export default function App() {
  return (
    <RouterProvider>
      <AdminAuthProvider>
        <CustomerAuthProvider>
          <CartProvider>
            <CategoriesProvider>
              <Root />
            </CategoriesProvider>
          </CartProvider>
        </CustomerAuthProvider>
      </AdminAuthProvider>
    </RouterProvider>
  );
}

function Root() {
  const { isAdminRoute } = useRouter();
  return isAdminRoute ? <AdminRoot /> : <StorefrontRoot />;
}

// ---------------------------------------------------------------------------
// Storefront
// ---------------------------------------------------------------------------
function StorefrontRoot() {
  const { view } = useRouter();
  const { count, navigate } = useCartBound();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const isHome = view.name === 'home';

  return (
    <div className="block bg-sand-50 md:flex md:min-h-dvh">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="block min-w-0 md:flex md:flex-1 md:flex-col">
        <header className="relative flex w-full items-center justify-between border-b border-sand-200 bg-white px-4 py-2.5 md:bg-white/90 md:py-3 md:backdrop-blur-md md:sticky md:top-0 md:z-20">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-full p-2 text-navy-800 transition hover:bg-sand-100 md:hidden"
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Logo className="md:hidden" />
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setSearchOpen(true)}
              className="rounded-full p-2 text-navy-800 transition hover:bg-sand-100"
              aria-label="Buscar"
            >
              <Search className="h-5 w-5" strokeWidth={1.6} />
            </button>
            <button
              onClick={() => navigate({ name: 'cart' })}
              className="relative rounded-full p-2 text-navy-800 transition hover:bg-sand-100"
              aria-label="Carrinho"
            >
              <ShoppingBag className="h-5 w-5" strokeWidth={1.6} />
              {count > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-aqua-500 px-1 text-[10px] font-semibold text-white">
                  {count}
                </span>
              )}
            </button>
          </div>

          <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
        </header>

        <main className="block px-4 py-6 sm:px-8 sm:py-10 md:flex-1">
          <div className="mx-auto w-full max-w-6xl">
            {isHome && <Hero />}
            <StorefrontContent />
          </div>
        </main>

        <footer className="block border-t border-sand-200 bg-white/60 px-4 py-8 text-center text-xs text-gray-500 sm:px-8">
          <p className="font-display text-sm font-medium text-navy-700">Lua de Praia 🌙</p>
          <p className="mt-1">Acessórios em aço inoxidável · Feitos para durar</p>
        </footer>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="mb-6 mt-2 overflow-hidden rounded-3xl border border-sand-200 bg-gradient-to-br from-sky-50 via-white to-sand-50 px-6 py-10 text-center sm:px-12 sm:py-14">
      <img
        src={logoBlue}
        alt="Lua de Praia"
        className="rise-in mx-auto h-16 w-auto sm:h-20"
      />
      <div className="rise-in mt-5 flex flex-col items-center gap-1.5">
        <p className="font-display text-base font-semibold tracking-wide text-navy-900 sm:text-lg">
          Acessórios em aço inoxidável
        </p>
        <p className="text-sm leading-relaxed text-gray-500 sm:text-base">
          Feitos para acompanhar você em todos os momentos.
        </p>
      </div>
    </section>
  );
}

function StorefrontContent() {
  const { view } = useRouter();

  return useMemo(() => {
    switch (view.name) {
      case 'home':
        return <Catalog />;
      case 'category':
        return <Catalog initialCategorySlug={view.slug} lockCategory />;
      case 'search':
        return <Catalog initialQuery={view.query} lockCategory />;
      case 'product':
        return <ProductDetails id={view.id} />;
      case 'cart':
        return <Cart />;
      case 'orders':
        return <OrderList />;
      case 'account':
        return <Account />;
      default:
        return <Catalog />;
    }
  }, [view]);
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------
function AdminRoot() {
  const { adminView } = useRouter();
  const { user, loading, isAdmin } = useAdminAuth();

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-sand-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-sand-200 border-t-sky-500" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return <AdminLogin />;
  }

  if (!adminView) return <AdminDashboard />;

  switch (adminView.name) {
    case 'dashboard':
      return <AdminDashboard />;
    case 'products':
      return <AdminProducts />;
    case 'product-new':
      return <AdminProductForm mode="new" />;
    case 'product-edit':
      return <AdminProductForm mode="edit" productId={adminView.id} />;
    case 'import':
      return <Suspense fallback={<div className="flex min-h-dvh items-center justify-center bg-sand-50"><div className="h-8 w-8 animate-spin rounded-full border-2 border-sand-200 border-t-sky-500" /></div>}><AdminImport /></Suspense>;
    case 'categories':
      return <AdminCategories />;
    case 'orders':
      return <AdminOrders />;
    case 'order-detail':
      return <AdminOrderDetail orderId={adminView.id} />;
    case 'settings':
      return <AdminSettings />;
    default:
      return <AdminDashboard />;
  }
}

function useCartBound() {
  const { count } = useCart();
  const { navigate } = useRouter();
  return useMemo(() => ({ count, navigate }), [count, navigate]);
}
