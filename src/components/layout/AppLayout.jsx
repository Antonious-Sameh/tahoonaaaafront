import { useState, useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import {
  LayoutDashboard, ShoppingCart, ShoppingBag, Package, Users, Truck, Wallet, Receipt,
  BarChart3, Settings as SettingsIcon, History, Menu, Bell, LogOut, X, Store, ChevronLeft,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { Badge } from '@/components/shop/Badge';
import * as productsApi from '@/services/api/products';
import { GlobalSearch } from './GlobalSearch';

const NAV_GROUPS = [
  {
    label: 'الرئيسية',
    items: [
      { to: '/', label: 'لوحة التحكم', icon: LayoutDashboard, end: true },
    ],
  },
  {
    label: 'العمليات',
    items: [
      { to: '/sales', label: 'نقطة البيع', icon: ShoppingCart, end: true },
      { to: '/sales/history', label: 'سجل المبيعات', icon: History },
      { to: '/purchases', label: 'عملية شراء', icon: ShoppingBag, end: true },
      { to: '/purchases/history', label: 'سجل المشتريات', icon: History },
    ],
  },
  {
    label: 'الإدارة',
    items: [
      { to: '/inventory', label: 'المخزون', icon: Package },
      { to: '/customers', label: 'العملاء', icon: Users },
      { to: '/suppliers', label: 'الموردين', icon: Truck },
    ],
  },
  {
    label: 'المالية',
    items: [
      { to: '/cashbox', label: 'الصندوق', icon: Wallet },
      { to: '/expenses', label: 'المصروفات', icon: Receipt },
      { to: '/reports', label: 'التقارير', icon: BarChart3 },
    ],
  },
  {
    label: 'النظام',
    items: [
      { to: '/activity', label: 'سجل النشاط', icon: History },
      { to: '/settings', label: 'الإعدادات', icon: SettingsIcon },
    ],
  },
];

const TITLES = [
  ['/sales/history', 'سجل المبيعات'], ['/sales', 'نقطة البيع'],
  ['/purchases/history', 'سجل المشتريات'], ['/purchases', 'عملية شراء جديدة'],
  ['/inventory', 'المخزون'], ['/customers/', 'بيانات العميل'], ['/customers', 'العملاء'],
  ['/suppliers/', 'بيانات المورد'], ['/suppliers', 'الموردين'],
  ['/cashbox', 'الصندوق'], ['/expenses', 'المصروفات'], ['/reports', 'التقارير'],
  ['/activity', 'سجل النشاط'], ['/settings', 'الإعدادات'],
];

function NavItem({ item, onNavigate }) {
  return (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-semibold transition-colors select-none ${
          isActive
            ? 'bg-blue-600 text-white shadow-sm font-bold'
            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
        }`
      }
    >
      <item.icon size={18} className="shrink-0" />
      <span className="truncate">{item.label}</span>
    </NavLink>
  );
}

export function SidebarNav({ onNavigate }) {
  return (
    <nav className="flex flex-1 flex-col gap-3 overflow-y-auto px-3 py-4">
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <div className="mb-1.5 px-3 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            {group.label}
          </div>
          <div className="flex flex-col gap-1">
            {group.items.map((item) => (
              <NavItem key={item.to} item={item} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function AppLayout() {
  const { logout } = useAuth();
  const { settings } = useSettings();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);

  const [low, setLow] = useState([]);
  const [lowTotal, setLowTotal] = useState(0);

  // Refetched on every route change — a reasonable middle ground between a
  // stale badge and polling (which the project's performance guidance
  // discourages unless truly necessary). Won't catch a stock change made
  // without navigating away (e.g. completing a sale while staying on the
  // POS page) until the next navigation.
  useEffect(() => {
    let cancelled = false;
    productsApi.listProducts({ filter: 'low', limit: 6 })
      .then((res) => {
        if (cancelled) return;
        setLow(res.data);
        setLowTotal(res.pagination?.total || 0);
      })
      .catch(() => { /* the notification bell is a nice-to-have; a failure here shouldn't block the page */ });
    return () => { cancelled = true; };
  }, [location.pathname]);

  const title = (TITLES.find(([prefix]) => (prefix.endsWith('/') ? location.pathname.startsWith(prefix) : location.pathname === prefix || (prefix !== '/' && location.pathname.startsWith(prefix)))) || [null, 'لوحة التحكم'])[1];

  const doLogout = async () => { await logout(); navigate('/login', { replace: true }); };

  const shopName = settings?.shopName || 'نظام إدارة المحل';
  const ownerName = settings?.ownerName || '';
  const ownerInitial = ownerName ? ownerName.charAt(0) : '؟';

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
      <Helmet><title>{title} — {shopName}</title><meta name="description" content="نظام إدارة محل قطع غيار سيارات" /></Helmet>

      {/* Desktop Sidebar - بألوان مصمتة وواضحة جداً */}
      <aside className="fixed inset-y-0 right-0 z-40 hidden w-60 flex-col border-l border-slate-800 bg-slate-900 text-slate-100 shadow-xl lg:flex pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-800 px-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
            <Store size={18} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-white">{shopName}</div>
            <div className="text-[11px] font-medium text-slate-400">نظام إدارة المحل</div>
          </div>
        </div>
        <SidebarNav />
        <div className="shrink-0 border-t border-slate-800 px-4 py-2.5 text-center text-[10px] text-slate-500">
          تطوير: م. أنطونيوس سامح — 01223307593
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/70 transition-opacity" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 right-0 flex w-64 flex-col border-l border-slate-800 bg-slate-900 text-slate-100 shadow-2xl pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
            <div className="flex h-16 items-center justify-between border-b border-slate-800 px-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
                  <Store size={16} />
                </div>
                <span className="text-sm font-bold text-white truncate">{shopName}</span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <SidebarNav onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main Container */}
      <div className="lg:pr-60">
        {/* Header */}
        <header className="sticky top-0 z-30 min-h-16 border-b border-slate-200 bg-white shadow-sm pt-[env(safe-area-inset-top)]">
          <div className="flex h-16 items-center justify-between gap-4 px-4 md:px-6">
            
            {/* Title & Mobile Button */}
            <div className="flex items-center gap-3">
              <button
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 lg:hidden"
                onClick={() => setMobileOpen(true)}
              >
                <Menu size={18} />
              </button>
              <h1 className="text-base font-bold text-slate-800 md:text-lg">{title}</h1>
            </div>

            {/* Global Search */}
            <div className="flex-1 max-w-lg mx-2">
              <GlobalSearch />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              {/* Notifications */}
              <div className="relative">
                <button
                  onClick={() => { setNotifOpen(!notifOpen); setUserOpen(false); }}
                  className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                >
                  <Bell size={18} />
                  {lowTotal > 0 && (
                    <span className="absolute -top-1 -end-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                      {lowTotal}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                    <div className="absolute end-0 top-12 z-50 w-72 rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
                      <div className="border-b border-slate-100 px-4 py-3 bg-slate-50">
                        <span className="text-xs font-bold text-slate-800">تنبيهات المخزون</span>
                      </div>
                      <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                        {low.length === 0 ? (
                          <div className="px-4 py-4 text-center text-xs text-slate-500">لا توجد تنبيهات</div>
                        ) : (
                          low.map((p) => (
                            <div key={p._id} className="flex items-center justify-between px-4 py-2.5 text-xs hover:bg-slate-50">
                              <span className="font-semibold text-slate-700 truncate max-w-[150px]">{p.name}</span>
                              {p.quantity <= 0
                                ? <Badge tone="red">نافذ</Badge>
                                : <Badge tone="amber">متبقي {p.quantity}</Badge>
                              }
                            </div>
                          ))
                        )}
                      </div>
                      <div className="border-t border-slate-100 p-2 bg-slate-50">
                        <Link
                          to="/inventory?filter=low"
                          onClick={() => setNotifOpen(false)}
                          className="flex items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50"
                        >
                          عرض المخزون المنخفض <ChevronLeft size={14} />
                        </Link>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* User Dropdown */}
              <div className="relative">
                <button
                  onClick={() => { setUserOpen(!userOpen); setNotifOpen(false); }}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white shadow-sm hover:bg-blue-700"
                >
                  {ownerInitial}
                </button>

                {userOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setUserOpen(false)} />
                    <div className="absolute end-0 top-12 z-50 w-52 rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
                      <div className="border-b border-slate-100 px-4 py-3 bg-slate-50">
                        <div className="text-xs font-bold text-slate-800 truncate">{ownerName}</div>
                        <div className="text-[11px] text-slate-500 truncate">{shopName}</div>
                      </div>
                      <div className="p-1.5 flex flex-col gap-0.5">
                        <Link
                          to="/settings"
                          onClick={() => setUserOpen(false)}
                          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        >
                          <SettingsIcon size={15} className="text-slate-400" />
                          الإعدادات
                        </Link>
                        <button
                          onClick={doLogout}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-xs font-bold text-red-600 hover:bg-red-50"
                        >
                          <LogOut size={15} />
                          تسجيل الخروج
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Area */}
        <main className="w-full p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AppLayout;