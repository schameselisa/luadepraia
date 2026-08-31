import { useState, type ReactNode } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  Package,
  PackagePlus,
  Settings,
  Tags,
  Menu as MenuIcon,
  Store,
} from 'lucide-react';
import { useAdminAuth } from '@/store/AdminAuthContext';
import { useRouter, type AdminView } from '@/store/Router';
import { Logo } from '@/components/Logo';
import logoBlue from '@/assets/lua-de-praia-logo-blue.png';

type Props = {
  children: ReactNode;
  current: AdminView['name'];
};

export function AdminLayout({ children, current }: Props) {
  const { user, signOut } = useAdminAuth();
  const { navigate, navigateAdmin } = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate({ name: 'home' });
  };

  const go = (view: AdminView) => {
    navigateAdmin(view);
    setMobileOpen(false);
  };

  const links: { view: AdminView; label: string; icon: ReactNode }[] = [
    { view: { name: 'dashboard' }, label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
    { view: { name: 'products' }, label: 'Produtos', icon: <Package className="h-4 w-4" /> },
    { view: { name: 'import' }, label: 'Importar produtos', icon: <PackagePlus className="h-4 w-4" /> },
    { view: { name: 'categories' }, label: 'Categorias', icon: <Tags className="h-4 w-4" /> },
    { view: { name: 'orders' }, label: 'Pedidos', icon: <ListOrdered className="h-4 w-4" /> },
    { view: { name: 'settings' }, label: 'Configurações', icon: <Settings className="h-4 w-4" /> },
  ];

  return (
    <div className="flex min-h-dvh bg-sand-50">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-plum-900/30 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar */}
      <aside
        className={[
          'fixed z-40 flex h-dvh flex-col border-r border-sand-200 bg-white transition-all duration-300 md:relative md:translate-x-0 md:h-screen',
          collapsed ? 'md:w-20' : 'md:w-64',
          'w-64',
          mobileOpen
            ? 'translate-x-0 opacity-100 pointer-events-auto'
            : 'pointer-events-none opacity-0 md:translate-x-0 md:opacity-100 md:pointer-events-auto',
        ].join(' ')}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-4">
          {collapsed ? (
            <img src={logoBlue} alt="Lua de Praia" className="mx-auto h-8 w-auto" />
          ) : (
            <Logo imgClassName="h-7 w-auto md:h-8" />
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="hidden rounded-full p-2 text-plum-700/50 transition hover:bg-sand-100 hover:text-plum-900 md:block"
            aria-label={collapsed ? 'Expandir' : 'Recolher'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setMobileOpen(false)}
            className="rounded-full p-2 text-plum-700/50 md:hidden"
            aria-label="Fechar"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {links.map((link) => (
            <button
              key={link.view.name}
              onClick={() => go(link.view)}
              title={collapsed ? link.label : undefined}
              className={[
                'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition',
                current === link.view.name
                  ? 'bg-blush-100 font-medium text-blush-700'
                  : 'text-plum-800 hover:bg-sand-100',
                collapsed ? 'justify-center' : '',
              ].join(' ')}
            >
              <span className={current === link.view.name ? 'text-blush-600' : 'text-plum-700/60'}>
                {link.icon}
              </span>
              {!collapsed && <span>{link.label}</span>}
            </button>
          ))}
        </nav>

        <div className="border-t border-sand-200 px-3 py-3">
          {!collapsed ? (
            <div className="space-y-2">
              <button
                onClick={() => navigate({ name: 'home' })}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-plum-700/70 transition hover:bg-sand-100 hover:text-plum-900"
              >
                <Store className="h-4 w-4" /> Ver loja pública
              </button>
              <div className="flex items-center gap-2 rounded-xl bg-sand-50 px-3 py-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blush-100 text-xs font-semibold text-blush-600">
                  {(user?.email ?? '?')[0].toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-plum-900">Administradora</p>
                  <p className="truncate text-[10px] text-plum-700/50">{user?.email}</p>
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-blush-600 transition hover:bg-blush-50"
              >
                <LogOut className="h-4 w-4" /> Sair
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={() => navigate({ name: 'home' })}
                className="flex h-9 w-9 items-center justify-center rounded-full text-plum-700/60 hover:bg-sand-100"
                title="Ver loja"
              >
                <Store className="h-4 w-4" />
              </button>
              <button
                onClick={handleSignOut}
                className="flex h-9 w-9 items-center justify-center rounded-full text-blush-600 hover:bg-blush-50"
                title="Sair"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-sand-200 bg-white/90 px-4 py-3 backdrop-blur md:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-full p-2 text-navy-800 hover:bg-sand-100"
            aria-label="Abrir menu"
          >
            <MenuIcon className="h-5 w-5" />
          </button>
          <button
            onClick={() => go({ name: 'dashboard' })}
            className="font-display text-sm font-semibold text-navy-900 transition hover:text-sky-600"
          >
            Gestão da loja
          </button>
          <span className="w-9" />
        </header>

        <main className="flex-1 px-4 py-6 sm:px-8 sm:py-8">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
