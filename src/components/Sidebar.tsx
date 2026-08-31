import {
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Package,
  ShoppingBag,
  X,
} from 'lucide-react';
import { useRouter, type StoreView } from '@/store/Router';
import { useCart } from '@/store/CartContext';
import { useCategories } from '@/store/CategoriesContext';
import { Logo } from './Logo';
import logoBlue from '@/assets/lua-de-praia-logo-blue.png';

type Props = {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
};

export function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }: Props) {
  const { view, navigate } = useRouter();
  const { count } = useCart();
  const { categories } = useCategories();

  const go = (next: StoreView) => {
    navigate(next);
    onCloseMobile();
  };

  const isActive = (name: StoreView['name']) => view.name === name;
  const isHomeActive = view.name === 'home' || view.name === 'category';
  const activeSlug = view.name === 'category' ? view.slug : null;

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-navy-900/20 backdrop-blur-sm md:hidden"
          onClick={onCloseMobile}
          aria-hidden
        />
      )}

      <aside
        className={[
          'fixed z-40 flex h-dvh flex-col border-r border-sand-200 bg-white/80 backdrop-blur-md transition-all duration-300 md:relative md:translate-x-0 md:h-screen',
          collapsed ? 'md:w-20' : 'md:w-64',
          'w-72',
          mobileOpen
            ? 'translate-x-0 opacity-100 pointer-events-auto'
            : 'pointer-events-none opacity-0 md:translate-x-0 md:opacity-100 md:pointer-events-auto',
        ].join(' ')}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-5 py-5">
          {collapsed ? (
            <button
              onClick={() => go({ name: 'home' })}
              className="flex items-center justify-center transition md:mx-auto"
              aria-label="Lua de Praia — início"
            >
              <img src={logoBlue} alt="Lua de Praia" className="h-8 w-auto" />
            </button>
          ) : (
            <Logo />
          )}
          <button
            onClick={onToggleCollapse}
            className="hidden rounded-full p-2 text-gray-500 transition hover:bg-sand-100 hover:text-navy-900 md:block"
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={onCloseMobile}
            className="rounded-full p-2 text-gray-500 transition hover:bg-sand-100 md:hidden"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-3 scrollbar-thin">
          {/* Catalog section */}
          {!collapsed && (
            <p className="px-3 pb-2 pt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">
              Catálogo
            </p>
          )}
          <nav className="space-y-0.5">
            <SidebarLink
              collapsed={collapsed}
              icon={<ShoppingBag className="h-4 w-4" strokeWidth={1.6} />}
              label="Todos os produtos"
              active={isHomeActive}
              onClick={() => go({ name: 'home' })}
            />
            {categories.map((cat) => (
              <SidebarLink
                key={cat.id}
                collapsed={collapsed}
                icon={<CategoryDot active={activeSlug === cat.slug} />}
                label={cat.name}
                active={activeSlug === cat.slug}
                onClick={() => go({ name: 'category', slug: cat.slug })}
              />
            ))}
          </nav>

          {/* Separator */}
          <div className="my-4 border-t border-sand-200" />

          {/* Account section */}
          {!collapsed && (
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">
              Conta
            </p>
          )}
          <nav className="space-y-0.5">
            <SidebarLink
              collapsed={collapsed}
              icon={<Package className="h-4 w-4" strokeWidth={1.6} />}
              label="Meus pedidos"
              active={isActive('orders')}
              onClick={() => go({ name: 'orders' })}
            />
            <SidebarLink
              collapsed={collapsed}
              icon={<CircleUserRound className="h-4 w-4" strokeWidth={1.6} />}
              label="Minha conta"
              active={isActive('account')}
              onClick={() => go({ name: 'account' })}
            />
          </nav>
        </div>

        {/* Footer */}
        <div className="border-t border-sand-200 px-3 py-4">
          {!collapsed ? (
            <div className="space-y-2">
              <button
                onClick={() => go({ name: 'cart' })}
                className="flex w-full items-center justify-between rounded-2xl bg-navy-700 px-4 py-3 text-white transition hover:bg-navy-800"
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <ShoppingBag className="h-4 w-4" strokeWidth={1.6} /> Meu carrinho
                </span>
                {count > 0 && (
                  <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs font-semibold">
                    {count}
                  </span>
                )}
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={() => go({ name: 'cart' })}
                className="relative flex h-9 w-9 items-center justify-center rounded-full bg-navy-700 text-white transition hover:bg-navy-800"
                aria-label="Carrinho"
              >
                <ShoppingBag className="h-4 w-4" strokeWidth={1.6} />
                {count > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-aqua-500 px-1 text-[10px] font-semibold text-white">
                    {count}
                  </span>
                )}
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

function SidebarLink({
  icon,
  label,
  active,
  collapsed,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition',
        active
          ? 'bg-sky-50 font-medium text-sky-700'
          : 'text-navy-800 hover:bg-sand-50 hover:text-navy-900',
        collapsed ? 'justify-center' : '',
      ].join(' ')}
      title={collapsed ? label : undefined}
    >
      <span className={active ? 'text-sky-500' : 'text-gray-400 group-hover:text-navy-700'}>
        {icon}
      </span>
      {!collapsed && <span className="flex-1 text-left">{label}</span>}
    </button>
  );
}

function CategoryDot({ active }: { active: boolean }) {
  return (
    <span
      className={[
        'block h-2 w-2 rounded-full transition',
        active ? 'bg-sky-500' : 'bg-sand-300 group-hover:bg-sky-300',
      ].join(' ')}
    />
  );
}
