import { useMemo, useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { toast } from 'sonner';
import {
  Printer, ShoppingCart, ShoppingBag, Package, Users, Truck, Receipt, Wallet,
  History, ArrowDownCircle, AlertTriangle, BarChart3, Loader2,
} from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';
import { fmtMoney, fmtNum, fmtDate } from '@/lib/formatters';
import { Stat } from '@/components/shop/Stat';
import { Empty } from '@/components/shop/Empty';
import { PrintPortal } from '@/components/shop/PrintPortal';
import { usePrint } from '@/hooks/usePrint';
import * as reportsApi from '@/services/api/reports';
import { btnOutline, thCls, tdCls } from '@/components/shop/styles';

const TOP_LIST_LIMIT = 8;

function toDateInputStr(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function ReportsPage() {
  const { settings } = useSettings();
  const [period, setPeriod] = useState('month');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [tab, setTab] = useState('sales');
  const [printing, startPrint] = usePrint();
  const [loading, setLoading] = useState(false);

  const [salesReport, setSalesReport] = useState(null);
  const [purchasesReport, setPurchasesReport] = useState(null);
  const [profitReport, setProfitReport] = useState(null);
  const [inventoryReport, setInventoryReport] = useState(null);
  const [customersReport, setCustomersReport] = useState(null);
  const [suppliersReport, setSuppliersReport] = useState(null);

  // "today/week/month" resolve to concrete from/to date strings client-side;
  // "custom" uses the date inputs as-is (omitted entirely when empty, so the
  // backend applies its own "no bound" default instead of us fabricating an
  // epoch/now stand-in).
  const { fromStr, toStr } = useMemo(() => {
    const now = new Date();
    let start;
    if (period === 'today') { start = new Date(); start.setHours(0, 0, 0, 0); }
    else if (period === 'week') { start = new Date(); start.setDate(start.getDate() - 6); start.setHours(0, 0, 0, 0); }
    else if (period === 'month') { start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0); }
    else return { fromStr: from || undefined, toStr: to || undefined };
    return { fromStr: toDateInputStr(start), toStr: toDateInputStr(now) };
  }, [period, from, to]);

  const rangeLabel = useMemo(() => {
    if (!fromStr && !toStr) return 'كل الفترة';
    return `${fromStr ? fmtDate(fromStr) : 'البداية'} إلى ${toStr ? fmtDate(toStr) : 'اليوم'}`;
  }, [fromStr, toStr]);

  // Only the ACTIVE tab's report is fetched — matches the project's "don't
  // return unrequested data" performance requirement; the other five tabs'
  // data is fetched on demand when the person actually switches to them.
  // Inventory/customers/suppliers are never date-filtered — matching the
  // backend and the original frontend exactly (inventory is a snapshot of
  // now, and a balance is always all-time), so they don't depend on
  // fromStr/toStr, though re-running them on a date change is harmless.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const rangeParams = { from: fromStr, to: toStr };
    const loaders = {
      sales: () => reportsApi.getSalesReport(rangeParams).then((r) => setSalesReport(r.data)),
      purchases: () => reportsApi.getPurchasesReport(rangeParams).then((r) => setPurchasesReport(r.data)),
      profit: () => reportsApi.getProfitReport(rangeParams).then((r) => setProfitReport(r.data)),
      inventory: () => reportsApi.getInventoryReport().then((r) => setInventoryReport(r.data)),
      customers: () => reportsApi.getCustomersReport({ limit: TOP_LIST_LIMIT }).then((r) => setCustomersReport(r.data)),
      suppliers: () => reportsApi.getSuppliersReport({ limit: TOP_LIST_LIMIT }).then((r) => setSuppliersReport(r.data)),
    };

    loaders[tab]()
      .catch((err) => { if (!cancelled) toast.error(err.message || 'تعذر تحميل التقرير'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [tab, fromStr, toStr]);

  const tabs = [
    ['sales', 'المبيعات'], ['purchases', 'المشتريات'], ['profit', 'الأرباح'],
    ['inventory', 'المخزون'], ['customers', 'العملاء'], ['suppliers', 'الموردين'],
  ];
  const tabLabel = tabs.find(([k]) => k === tab)[1];

  const printRows = useMemo(() => {
    if (tab === 'sales' && salesReport) return [
      ['إجمالي المبيعات', fmtMoney(salesReport.revenue)],
      ['عدد الفواتير', fmtNum(salesReport.invoiceCount)],
      ['مبيعات نقدية', fmtMoney(salesReport.cashTotal)],
      ['مبيعات آجلة', fmtMoney(salesReport.creditTotal)],
      ['المحصل', fmtMoney(salesReport.paid)],
      ['المستحق', fmtMoney(salesReport.remaining)],
    ];
    if (tab === 'purchases' && purchasesReport) return [
      ['إجمالي المشتريات', fmtMoney(purchasesReport.total)],
      ['عدد العمليات', fmtNum(purchasesReport.count)],
      ['المدفوع', fmtMoney(purchasesReport.paid)],
      ['المتبقي للموردين', fmtMoney(purchasesReport.remaining)],
    ];
    if (tab === 'profit' && profitReport) return [
      ['إيراد المبيعات', fmtMoney(profitReport.revenue)],
      ['تكلفة البضاعة المباعة', fmtMoney(profitReport.cogs)],
      ['مجمل الربح', fmtMoney(profitReport.gross)],
      ['المصروفات', fmtMoney(profitReport.expenses)],
      ['صافي الربح', fmtMoney(profitReport.net)],
    ];
    if (tab === 'inventory' && inventoryReport) return [
      ['عدد المنتجات', fmtNum(inventoryReport.productsCount)],
      ['قيمة المخزون (شراء)', fmtMoney(inventoryReport.costValue)],
      ['قيمة المخزون (بيع)', fmtMoney(inventoryReport.saleValue)],
      ['الربح المتوقع', fmtMoney(inventoryReport.expectedProfit)],
      ['منتجات منخفضة', fmtNum(inventoryReport.lowCount)],
      ['منتجات نافذة', fmtNum(inventoryReport.outCount)],
    ];
    if (tab === 'customers' && customersReport) return [
      ['عدد العملاء', fmtNum(customersReport.count)],
      ['إجمالي الأرصدة المستحقة', fmtMoney(customersReport.totalOutstanding)],
    ];
    if (tab === 'suppliers' && suppliersReport) return [
      ['عدد الموردين', fmtNum(suppliersReport.count)],
      ['إجمالي الأرصدة المستحقة', fmtMoney(suppliersReport.totalOutstanding)],
    ];
    return [];
  }, [tab, salesReport, purchasesReport, profitReport, inventoryReport, customersReport, suppliersReport]);

  const Loading = () => (
    <div className="py-14 text-center text-muted-foreground"><Loader2 size={20} className="mx-auto mb-2 animate-spin" />جارِ تحميل التقرير...</div>
  );

  return (
    <div className="grid gap-4">
      <Helmet><title>التقارير — نظام إدارة المحل</title><meta name="description" content="مركز التقارير والإحصائيات" /></Helmet>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-4">
        {[['today', 'اليوم'], ['week', 'هذا الأسبوع'], ['month', 'هذا الشهر'], ['custom', 'مخصص']].map(([k, l]) => (
          <button key={k} onClick={() => setPeriod(k)} className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${period === k ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>{l}</button>
        ))}
        {period === 'custom' && (
          <>
            <input type="date" className="h-10 rounded-lg border border-input bg-background px-3 text-sm" value={from} onChange={(e) => setFrom(e.target.value)} />
            <input type="date" className="h-10 rounded-lg border border-input bg-background px-3 text-sm" value={to} onChange={(e) => setTo(e.target.value)} />
          </>
        )}
        <button className={`${btnOutline} ms-auto`} onClick={startPrint}><Printer size={16} /> طباعة التقرير</button>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${tab === k ? 'border-primary bg-accent text-accent-foreground' : 'bg-card hover:bg-muted'}`}>{l}</button>
        ))}
      </div>

      {tab === 'sales' && (
        loading && !salesReport ? <Loading /> : salesReport && (
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Stat title="إجمالي المبيعات" value={fmtMoney(salesReport.revenue)} icon={ShoppingCart} tone="bg-emerald-100 text-emerald-700" />
            <Stat title="عدد الفواتير" value={fmtNum(salesReport.invoiceCount)} icon={Receipt} tone="bg-blue-100 text-blue-700" />
            <Stat title="مبيعات نقدية" value={fmtMoney(salesReport.cashTotal)} icon={Wallet} tone="bg-green-100 text-green-700" />
            <Stat title="مبيعات آجلة" value={fmtMoney(salesReport.creditTotal)} icon={History} tone="bg-amber-100 text-amber-700" />
            <Stat title="المحصل" value={fmtMoney(salesReport.paid)} icon={ArrowDownCircle} tone="bg-emerald-100 text-emerald-700" />
            <Stat title="المستحق" value={fmtMoney(salesReport.remaining)} icon={AlertTriangle} tone="bg-red-100 text-red-700" />
          </div>
          <div className="rounded-xl border bg-card p-4">
            <h3 className="mb-3 font-bold">الأكثر مبيعاً</h3>
            {salesReport.bestSellers.length === 0 ? <Empty text="لا توجد مبيعات في هذه الفترة" /> : (
              <table className="w-full">
                <thead><tr className="border-b"><th className={thCls}>المنتج</th><th className={thCls}>الكمية المباعة</th><th className={thCls}>إجمالي المبيعات</th></tr></thead>
                <tbody>{salesReport.bestSellers.map((b) => <tr key={b.productId} className="border-b last:border-0"><td className={tdCls}>{b.name}</td><td className={tdCls}>{b.qty}</td><td className={`${tdCls} font-bold`}>{fmtMoney(b.total)}</td></tr>)}</tbody>
              </table>
            )}
          </div>
        </div>
        )
      )}

      {tab === 'purchases' && (
        loading && !purchasesReport ? <Loading /> : purchasesReport && (
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat title="إجمالي المشتريات" value={fmtMoney(purchasesReport.total)} icon={ShoppingBag} tone="bg-blue-100 text-blue-700" />
            <Stat title="عدد العمليات" value={fmtNum(purchasesReport.count)} icon={Receipt} tone="bg-violet-100 text-violet-700" />
            <Stat title="المدفوع" value={fmtMoney(purchasesReport.paid)} icon={Wallet} tone="bg-emerald-100 text-emerald-700" />
            <Stat title="المتبقي للموردين" value={fmtMoney(purchasesReport.remaining)} icon={AlertTriangle} tone="bg-red-100 text-red-700" />
          </div>
          <div className="rounded-xl border bg-card p-4">
            <h3 className="mb-3 font-bold">أرصدة الموردين</h3>
            {purchasesReport.supplierBalances.length === 0 ? <Empty text="لا يوجد موردون" /> : (
              <table className="w-full">
                <thead><tr className="border-b"><th className={thCls}>المورد</th><th className={thCls}>إجمالي المشتريات</th><th className={thCls}>المدفوع</th><th className={thCls}>المتبقي</th></tr></thead>
                <tbody>{purchasesReport.supplierBalances.map((s) => <tr key={s._id} className="border-b last:border-0"><td className={tdCls}>{s.name}</td><td className={tdCls}>{fmtMoney(s.total)}</td><td className={tdCls}>{fmtMoney(s.paid)}</td><td className={tdCls}>{s.remaining > 0 ? <span className="font-semibold text-destructive">{fmtMoney(s.remaining)}</span> : '—'}</td></tr>)}</tbody>
              </table>
            )}
          </div>
        </div>
        )
      )}

      {tab === 'profit' && (
        loading && !profitReport ? <Loading /> : profitReport && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat title="إيراد المبيعات" value={fmtMoney(profitReport.revenue)} icon={ShoppingCart} tone="bg-blue-100 text-blue-700" />
          <Stat title="تكلفة البضاعة" value={fmtMoney(profitReport.cogs)} icon={Package} tone="bg-slate-100 text-slate-700" />
          <Stat title="مجمل الربح" value={fmtMoney(profitReport.gross)} icon={BarChart3} tone="bg-emerald-100 text-emerald-700" />
          <Stat title="المصروفات" value={fmtMoney(profitReport.expenses)} icon={Receipt} tone="bg-red-100 text-red-700" />
          <Stat title="صافي الربح" value={fmtMoney(profitReport.net)} icon={Wallet} tone="bg-emerald-100 text-emerald-700" />
        </div>
        )
      )}

      {tab === 'inventory' && (
        loading && !inventoryReport ? <Loading /> : inventoryReport && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Stat title="عدد المنتجات" value={fmtNum(inventoryReport.productsCount)} icon={Package} tone="bg-blue-100 text-blue-700" />
          <Stat title="إجمالي القطع" value={fmtNum(inventoryReport.totalQuantity)} icon={Package} tone="bg-violet-100 text-violet-700" />
          <Stat title="قيمة المخزون (شراء)" value={fmtMoney(inventoryReport.costValue)} icon={Wallet} tone="bg-slate-100 text-slate-700" />
          <Stat title="قيمة المخزون (بيع)" value={fmtMoney(inventoryReport.saleValue)} icon={BarChart3} tone="bg-emerald-100 text-emerald-700" />
          <Stat title="الربح المتوقع" value={fmtMoney(inventoryReport.expectedProfit)} icon={BarChart3} tone="bg-green-100 text-green-700" />
          <Stat title="منخفض / نافذ" value={`${fmtNum(inventoryReport.lowCount)} / ${fmtNum(inventoryReport.outCount)}`} icon={AlertTriangle} tone="bg-amber-100 text-amber-700" />
        </div>
        )
      )}

      {tab === 'customers' && (
        loading && !customersReport ? <Loading /> : customersReport && (
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Stat title="عدد العملاء" value={fmtNum(customersReport.count)} icon={Users} tone="bg-blue-100 text-blue-700" />
            <Stat title="إجمالي الأرصدة المستحقة" value={fmtMoney(customersReport.totalOutstanding)} icon={AlertTriangle} tone="bg-red-100 text-red-700" />
            <Stat title="عملاء عليهم أرصدة" value={fmtNum(customersReport.withBalanceCount)} icon={Users} tone="bg-amber-100 text-amber-700" />
          </div>
          <div className="rounded-xl border bg-card p-4">
            <h3 className="mb-3 font-bold">أعلى العملاء شراءً</h3>
            {customersReport.topCustomers.length === 0 ? <Empty text="لا يوجد عملاء" /> : (
              <table className="w-full">
                <thead><tr className="border-b"><th className={thCls}>العميل</th><th className={thCls}>إجمالي المشتريات</th><th className={thCls}>المدفوع</th><th className={thCls}>المتبقي</th></tr></thead>
                <tbody>{customersReport.topCustomers.map((c) => <tr key={c._id} className="border-b last:border-0"><td className={tdCls}>{c.name}</td><td className={tdCls}>{fmtMoney(c.total)}</td><td className={tdCls}>{fmtMoney(c.paid)}</td><td className={tdCls}>{c.remaining > 0 ? <span className="font-semibold text-destructive">{fmtMoney(c.remaining)}</span> : '—'}</td></tr>)}</tbody>
              </table>
            )}
          </div>
        </div>
        )
      )}

      {tab === 'suppliers' && (
        loading && !suppliersReport ? <Loading /> : suppliersReport && (
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Stat title="عدد الموردين" value={fmtNum(suppliersReport.count)} icon={Truck} tone="bg-blue-100 text-blue-700" />
            <Stat title="إجمالي الأرصدة المستحقة" value={fmtMoney(suppliersReport.totalOutstanding)} icon={AlertTriangle} tone="bg-red-100 text-red-700" />
            <Stat title="موردون لهم أرصدة" value={fmtNum(suppliersReport.withBalanceCount)} icon={Truck} tone="bg-amber-100 text-amber-700" />
          </div>
          <div className="rounded-xl border bg-card p-4">
            <h3 className="mb-3 font-bold">أعلى الموردين تعاملاً</h3>
            {suppliersReport.topSuppliers.length === 0 ? <Empty text="لا يوجد موردون" /> : (
              <table className="w-full">
                <thead><tr className="border-b"><th className={thCls}>المورد</th><th className={thCls}>إجمالي المشتريات</th><th className={thCls}>المدفوع</th><th className={thCls}>المتبقي</th></tr></thead>
                <tbody>{suppliersReport.topSuppliers.map((s) => <tr key={s._id} className="border-b last:border-0"><td className={tdCls}>{s.name}</td><td className={tdCls}>{fmtMoney(s.total)}</td><td className={tdCls}>{fmtMoney(s.paid)}</td><td className={tdCls}>{s.remaining > 0 ? <span className="font-semibold text-destructive">{fmtMoney(s.remaining)}</span> : '—'}</td></tr>)}</tbody>
              </table>
            )}
          </div>
        </div>
        )
      )}

      {printing && (
        <PrintPortal>
          <div dir="rtl" className="bg-white p-6 text-slate-900">
            <div className="mb-4 border-b pb-4 text-center">
              <h2 className="text-xl font-bold">{settings?.shopName}</h2>
              <p className="text-sm text-slate-500">تقرير {tabLabel} — {rangeLabel}</p>
            </div>
            <table className="w-full border-collapse text-sm">
              <tbody>
                {printRows.map(([k, v]) => (
                  <tr key={k} className="border-b"><td className="px-2 py-2">{k}</td><td className="px-2 py-2 text-start font-bold">{v}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </PrintPortal>
      )}
    </div>
  );
}

export default ReportsPage;
