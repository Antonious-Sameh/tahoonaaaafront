import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { toast } from 'sonner';
import {
  Wallet, ShoppingCart, ShoppingBag, Package, Users, Truck, Receipt,
  AlertTriangle, History, Settings as SettingsIcon, Loader2,
} from 'lucide-react';
import { fmtMoney, fmtDate, fmtTime, ACTIVITY_TYPE_LABELS } from '@/lib/formatters';
import { Stat } from '@/components/shop/Stat';
import { Badge } from '@/components/shop/Badge';
import { Empty } from '@/components/shop/Empty';
import { thCls, tdCls } from '@/components/shop/styles';
import * as cashboxApi from '@/services/api/cashbox';
import * as expensesApi from '@/services/api/expenses';
import * as reportsApi from '@/services/api/reports';
import * as productsApi from '@/services/api/products';
import * as activityApi from '@/services/api/activity';

const ACT_ICONS = { sale: ShoppingCart, purchase: ShoppingBag, expense: Receipt, cash: Wallet, product: Package, customer: Users, supplier: Truck, settings: SettingsIcon };
const ACT_COLORS = {
  sale: 'bg-emerald-100 text-emerald-700', purchase: 'bg-blue-100 text-blue-700', expense: 'bg-red-100 text-red-700',
  cash: 'bg-amber-100 text-amber-700', product: 'bg-violet-100 text-violet-700', customer: 'bg-cyan-100 text-cyan-700',
  supplier: 'bg-orange-100 text-orange-700', settings: 'bg-slate-100 text-slate-700',
};

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function DashboardPage() {
  const [actFilter, setActFilter] = useState('all');

  const [balance, setBalance] = useState(0);
  const [todaySalesTotal, setTodaySalesTotal] = useState(0);
  const [todayPurchasesTotal, setTodayPurchasesTotal] = useState(0);
  const [todayExpensesTotal, setTodayExpensesTotal] = useState(0);
  const [custDebt, setCustDebt] = useState(0);
  const [suppDebt, setSuppDebt] = useState(0);
  const [lowStock, setLowStock] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);

  const [activities, setActivities] = useState([]);
  const [loadingActivities, setLoadingActivities] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoadingStats(true);
    const today = todayStr();

    Promise.all([
      cashboxApi.getCashboxSummary(),
      reportsApi.getSalesReport({ from: today, to: today }),
      reportsApi.getPurchasesReport({ from: today, to: today }),
      expensesApi.getExpensesSummary(),
      reportsApi.getCustomersReport({ limit: 1 }),
      reportsApi.getSuppliersReport({ limit: 1 }),
      // The original widget shows every product with quantity <= minQuantity
      // in ONE list (out-of-stock and low-stock together, distinguished only
      // by the badge in each row) — there's no single backend filter for
      // that combined condition, so two small calls are merged here instead
      // of adding a new filter value to the backend just for this widget.
      productsApi.listProducts({ filter: 'out', limit: 10 }),
      productsApi.listProducts({ filter: 'low', limit: 10 }),
    ])
      .then(([cashboxRes, salesRes, purchasesRes, expensesRes, custRes, suppRes, outRes, lowRes]) => {
        if (cancelled) return;
        setBalance(cashboxRes.data.balance);
        setTodaySalesTotal(salesRes.data.revenue);
        setTodayPurchasesTotal(purchasesRes.data.total);
        setTodayExpensesTotal(expensesRes.data.todayTotal);
        setCustDebt(custRes.data.totalOutstanding);
        setSuppDebt(suppRes.data.totalOutstanding);
        setLowStock([...outRes.data, ...lowRes.data]);
      })
      .catch((err) => {
        if (!cancelled) toast.error(err.message || 'تعذر تحميل بيانات لوحة التحكم');
      })
      .finally(() => {
        if (!cancelled) setLoadingStats(false);
      });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingActivities(true);
    activityApi.listActivity({ type: actFilter, limit: 12 })
      .then((res) => { if (!cancelled) setActivities(res.data); })
      .catch((err) => { if (!cancelled) toast.error(err.message || 'تعذر تحميل النشاطات'); })
      .finally(() => { if (!cancelled) setLoadingActivities(false); });
    return () => { cancelled = true; };
  }, [actFilter]);

  const quick = [
    { to: '/sales', label: 'إضافة بيع', icon: ShoppingCart },
    { to: '/purchases', label: 'إضافة شراء', icon: ShoppingBag },
    { to: '/inventory?add=1', label: 'إضافة منتج', icon: Package },
    { to: '/customers?add=1', label: 'إضافة عميل', icon: Users },
    { to: '/suppliers?add=1', label: 'إضافة مورد', icon: Truck },
    { to: '/expenses', label: 'إضافة مصروف', icon: Receipt },
    { to: '/cashbox?add=1', label: 'إضافة للصندوق', icon: Wallet },
  ];

  return (
    <div className="grid gap-5">
      <Helmet><title>لوحة التحكم — نظام إدارة المحل</title><meta name="description" content="ملخص أداء المحل اليومي" /></Helmet>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat title="رصيد الصندوق" value={loadingStats ? '—' : fmtMoney(balance)} icon={Wallet} tone="bg-emerald-100 text-emerald-700" />
        <Stat title="مبيعات اليوم" value={loadingStats ? '—' : fmtMoney(todaySalesTotal)} icon={ShoppingCart} tone="bg-blue-100 text-blue-700" />
        <Stat title="مشتريات اليوم" value={loadingStats ? '—' : fmtMoney(todayPurchasesTotal)} icon={ShoppingBag} tone="bg-violet-100 text-violet-700" />
        <Stat title="مصروفات اليوم" value={loadingStats ? '—' : fmtMoney(todayExpensesTotal)} icon={Receipt} tone="bg-red-100 text-red-700" />
        <Stat title="مستحقات العملاء" value={loadingStats ? '—' : fmtMoney(custDebt)} icon={Users} tone="bg-amber-100 text-amber-700" />
        <Stat title="مستحقات الموردين" value={loadingStats ? '—' : fmtMoney(suppDebt)} icon={Truck} tone="bg-orange-100 text-orange-700" />
      </div>

      {/* Quick actions */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">إجراءات سريعة</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {quick.map((q) => (
            <Link
              key={q.label}
              to={q.to}
              className="flex flex-col items-center gap-2 rounded-md border border-border bg-background p-3 text-center text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-accent"
            >
              <q.icon size={18} className="text-primary" />
              <span className="text-xs leading-tight">{q.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Bottom grid */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Recent activity */}
        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">آخر النشاطات</h3>
            <select
              className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring/20"
              value={actFilter}
              onChange={(e) => setActFilter(e.target.value)}
            >
              <option value="all">كل الأنواع</option>
              {Object.entries(ACTIVITY_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="p-2">
            {loadingActivities && activities.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground"><Loader2 size={18} className="mx-auto mb-2 animate-spin" />جارِ التحميل...</div>
            ) : activities.length === 0 ? <Empty text="لا توجد نشاطات" /> : (
              <div className="grid gap-0.5">
                {activities.map((a) => {
                  const Icon = ACT_ICONS[a.type] || History;
                  return (
                    <div key={a._id} className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-muted/60">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${ACT_COLORS[a.type] || ACT_COLORS.settings}`}>
                        <Icon size={14} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-foreground">{a.description}</div>
                        <div className="text-xs text-muted-foreground">{fmtDate(a.date)} — {fmtTime(a.date)}</div>
                      </div>
                      {a.amount > 0 && <div className="text-sm font-bold text-foreground">{fmtMoney(a.amount)}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Low stock */}
        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <AlertTriangle size={15} className="text-amber-500" />
              منتجات قاربت على النفاد
            </h3>
            <Link to="/inventory?filter=low" className="text-xs font-semibold text-primary hover:underline">
              عرض الكل
            </Link>
          </div>
          {loadingStats && lowStock.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground"><Loader2 size={18} className="mx-auto mb-2 animate-spin" />جارِ التحميل...</div>
          ) : lowStock.length === 0 ? <Empty text="لا توجد منتجات منخفضة" /> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className={thCls}>المنتج</th>
                    <th className={thCls}>الكمية</th>
                    <th className={thCls}>الحد الأدنى</th>
                    <th className={thCls}>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStock.map((p) => (
                    <tr key={p._id} className="border-b border-border last:border-0">
                      <td className={tdCls}>{p.name}</td>
                      <td className={tdCls}>{p.quantity}</td>
                      <td className={tdCls}>{p.minQuantity}</td>
                      <td className={tdCls}>
                        {p.quantity <= 0 ? <Badge tone="red">نافذ</Badge> : <Badge tone="amber">منخفض</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
