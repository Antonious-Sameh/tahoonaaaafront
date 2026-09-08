import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { toast } from 'sonner';
import { Eye, Printer, Loader2 } from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';
import { fmtMoney, fmtDate, fmtTime, PAYMENT_LABELS } from '@/lib/formatters';
import { Empty } from '@/components/shop/Empty';
import { Badge } from '@/components/shop/Badge';
import { Modal } from '@/components/shop/Modal';
import { InvoiceView } from '@/components/shop/InvoiceView';
import { PrintPortal } from '@/components/shop/PrintPortal';
import { Pagination } from '@/components/shop/Pagination';
import { usePrint } from '@/hooks/usePrint';
import { useDebounce } from '@/hooks/useDebounce';
import { useApiList } from '@/hooks/useApiList';
import * as purchasesApi from '@/services/api/purchases';
import * as suppliersApi from '@/services/api/suppliers';
import { inp, btn, btnOutline, thCls, tdCls } from '@/components/shop/styles';

// Same reasoning as the POS/Purchases pickers: one batch instead of an
// async-searchable dropdown, for this filter's list of suppliers.
const SUPPLIER_FILTER_LIMIT = 100;

export function PurchaseHistoryPage() {
  const { settings } = useSettings();
  const [search, setSearch] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [viewPurchase, setViewPurchase] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [printing, startPrint] = usePrint();

  const debouncedSearch = useDebounce(search);

  useEffect(() => setPage(1), [debouncedSearch, supplierFilter, paymentFilter, from, to]);

  useEffect(() => {
    suppliersApi.listSuppliers({ limit: SUPPLIER_FILTER_LIMIT })
      .then((res) => setSuppliers(res.data))
      .catch((err) => toast.error(err.message || 'تعذر تحميل الموردين'));
  }, []);

  const { items: rows, pagination, loading, error } = useApiList(purchasesApi.listPurchases, {
    page, limit: 20, search: debouncedSearch, supplierId: supplierFilter, paymentMethod: paymentFilter, from, to,
  });

  useEffect(() => {
    if (error) toast.error(error.message || 'تعذر تحميل سجل المشتريات');
  }, [error]);

  const selectedSupplier = viewPurchase ? suppliers.find((s) => s._id === viewPurchase.supplierId) : null;

  // تجهيز فاتورة الشراء بخصائص متوافقة مع InvoiceView
  const formattedPurchaseForInvoice = viewPurchase ? {
    ...viewPurchase,
    invoiceNumber: viewPurchase.purchaseNumber,
    type: 'purchase',
  } : null;

  return (
    <div className="grid gap-4">
      <Helmet>
        <title>سجل المشتريات — نظام إدارة المحل</title>
        <meta name="description" content="سجل عمليات الشراء" />
      </Helmet>

      <div className="grid grid-cols-2 gap-2 rounded-xl border bg-card p-4 md:grid-cols-5">
        <input
          className={inp}
          placeholder="بحث برقم العملية أو المورد"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className={inp} value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)}>
          <option value="all">كل الموردين</option>
          {suppliers.map((s) => (
            <option key={s._id} value={s._id}>{s.name}</option>
          ))}
        </select>
        <select className={inp} value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}>
          <option value="all">كل طرق الدفع</option>
          <option value="cash">نقدي</option>
          <option value="credit">آجل</option>
        </select>
        <input type="date" className={inp} value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" className={inp} value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className={thCls}>رقم العملية</th>
              <th className={thCls}>المورد</th>
              <th className={thCls}>التاريخ</th>
              <th className={thCls}>الوقت</th>
              <th className={thCls}>الإجمالي</th>
              <th className={thCls}>المدفوع</th>
              <th className={thCls}>المتبقي</th>
              <th className={thCls}>الدفع</th>
              <th className={thCls}>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 && (
              <tr><td colSpan={9} className="py-14 text-center text-muted-foreground"><Loader2 size={20} className="mx-auto mb-2 animate-spin" />جارِ تحميل سجل المشتريات...</td></tr>
            )}
            {rows.map((p) => {
              const supplier = suppliers.find((s) => s._id === p.supplierId);
              return (
                <tr key={p._id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className={`${tdCls} font-semibold font-mono`}>#{p.purchaseNumber}</td>
                  <td className={tdCls}>{supplier ? supplier.name : '—'}</td>
                  <td className={tdCls}>{fmtDate(p.date)}</td>
                  <td className={tdCls}>{fmtTime(p.date)}</td>
                  <td className={`${tdCls} font-bold`}>{fmtMoney(p.total)}</td>
                  <td className={tdCls}>{fmtMoney(p.paid)}</td>
                  <td className={tdCls}>
                    {p.remaining > 0 ? (
                      <span className="font-semibold text-destructive">{fmtMoney(p.remaining)}</span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className={tdCls}>
                    <Badge tone={p.paymentMethod === 'cash' ? 'green' : 'amber'}>
                      {PAYMENT_LABELS[p.paymentMethod] || p.paymentMethod}
                    </Badge>
                  </td>
                  <td className={tdCls}>
                    <button className={btnOutline + ' !h-8 !px-3'} onClick={() => setViewPurchase(p)}>
                      <Eye size={14} /> عرض
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && rows.length === 0 && <Empty text="لا توجد عمليات شراء مطابقة" />}
        <Pagination page={page} totalPages={pagination?.totalPages} total={pagination?.total} onChange={setPage} />
      </div>

      <Modal open={!!viewPurchase} onClose={() => setViewPurchase(null)} title="فاتورة شراء" wide>
        {viewPurchase && (
          <div className="grid gap-4">
            <InvoiceView sale={formattedPurchaseForInvoice} customer={selectedSupplier} settings={settings} />
            <div className="flex gap-2">
              <button className={btn} onClick={startPrint}>
                <Printer size={16} /> طباعة
              </button>
              <button className={btnOutline} onClick={() => setViewPurchase(null)}>
                إغلاق
              </button>
            </div>
          </div>
        )}
      </Modal>

      {printing && viewPurchase && (
        <PrintPortal>
          <InvoiceView sale={formattedPurchaseForInvoice} customer={selectedSupplier} settings={settings} />
        </PrintPortal>
      )}
    </div>
  );
}

export default PurchaseHistoryPage;
