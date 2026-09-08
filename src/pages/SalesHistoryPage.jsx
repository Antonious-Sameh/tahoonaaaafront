import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import * as salesApi from '@/services/api/sales';
import * as customersApi from '@/services/api/customers';
import { inp, btn, btnOutline, thCls, tdCls } from '@/components/shop/styles';

// Same reasoning as the POS customer picker: one batch instead of an
// async-searchable dropdown, for this filter's list of customers.
const CUSTOMER_FILTER_LIMIT = 100;

export function SalesHistoryPage() {
  const { settings } = useSettings();
  const [params] = useSearchParams();
  const [search, setSearch] = useState(params.get('search') || '');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [viewSale, setViewSale] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [printing, startPrint] = usePrint();

  const debouncedSearch = useDebounce(search);

  useEffect(() => setPage(1), [debouncedSearch, customerFilter, paymentFilter, from, to]);

  useEffect(() => {
    customersApi.listCustomers({ limit: CUSTOMER_FILTER_LIMIT })
      .then((res) => setCustomers(res.data))
      .catch((err) => toast.error(err.message || 'تعذر تحميل العملاء'));
  }, []);

  const { items: rows, pagination, loading, error } = useApiList(salesApi.listSales, {
    page, limit: 20, search: debouncedSearch, customerId: customerFilter, paymentMethod: paymentFilter, from, to,
  });

  useEffect(() => {
    if (error) toast.error(error.message || 'تعذر تحميل سجل المبيعات');
  }, [error]);

  const viewCustomer = viewSale ? customers.find((c) => c._id === viewSale.customerId) : null;

  return (
    <div className="grid gap-4">
      <Helmet>
        <title>سجل المبيعات — نظام إدارة المحل</title>
        <meta name="description" content="سجل فواتير البيع" />
      </Helmet>

      <div className="grid grid-cols-2 gap-2 rounded-xl border bg-card p-4 md:grid-cols-5">
        <input
          className={inp}
          placeholder="بحث برقم الفاتورة أو العميل"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className={inp} value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)}>
          <option value="all">كل العملاء</option>
          {customers.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
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
              <th className={thCls}>رقم الفاتورة</th>
              <th className={thCls}>العميل</th>
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
              <tr><td colSpan={9} className="py-14 text-center text-muted-foreground"><Loader2 size={20} className="mx-auto mb-2 animate-spin" />جارِ تحميل سجل المبيعات...</td></tr>
            )}
            {rows.map((s) => {
              const customer = customers.find((c) => c._id === s.customerId);
              return (
                <tr key={s._id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className={`${tdCls} font-semibold font-mono`}>#{s.invoiceNumber}</td>
                  <td className={tdCls}>{customer ? customer.name : 'عميل نقدي'}</td>
                  <td className={tdCls}>{fmtDate(s.date)}</td>
                  <td className={tdCls}>{fmtTime(s.date)}</td>
                  <td className={`${tdCls} font-bold`}>{fmtMoney(s.total)}</td>
                  <td className={tdCls}>{fmtMoney(s.paid)}</td>
                  <td className={tdCls}>
                    {s.remaining > 0 ? (
                      <span className="font-semibold text-destructive">{fmtMoney(s.remaining)}</span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className={tdCls}>
                    <Badge tone={s.paymentMethod === 'cash' ? 'green' : 'amber'}>
                      {PAYMENT_LABELS[s.paymentMethod] || s.paymentMethod}
                    </Badge>
                  </td>
                  <td className={tdCls}>
                    <button className={btnOutline + ' !h-8 !px-3'} onClick={() => setViewSale(s)}>
                      <Eye size={14} /> عرض
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && rows.length === 0 && <Empty text="لا توجد فواتير مطابقة" />}
        <Pagination page={page} totalPages={pagination?.totalPages} total={pagination?.total} onChange={setPage} />
      </div>

      <Modal open={!!viewSale} onClose={() => setViewSale(null)} title="فاتورة بيع" wide>
        {viewSale && (
          <div className="grid gap-4">
            <InvoiceView sale={viewSale} customer={viewCustomer} settings={settings} />
            <div className="flex gap-2">
              <button className={btn} onClick={startPrint}>
                <Printer size={16} /> طباعة
              </button>
              <button className={btnOutline} onClick={() => setViewSale(null)}>
                إغلاق
              </button>
            </div>
          </div>
        )}
      </Modal>

      {printing && viewSale && (
        <PrintPortal>
          <InvoiceView sale={viewSale} customer={viewCustomer} settings={settings} />
        </PrintPortal>
      )}
    </div>
  );
}

export default SalesHistoryPage;
