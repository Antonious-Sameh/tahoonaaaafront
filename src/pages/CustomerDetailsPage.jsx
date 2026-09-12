import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { toast } from 'sonner';
import { ArrowRight, Phone, MapPin, Printer, Loader2, Wallet, CheckCircle2, Undo2, ChevronRight, Trash2 } from 'lucide-react';
import { fmtMoney, fmtDate, fmtDateTime } from '@/lib/formatters';
import { Empty } from '@/components/shop/Empty';
import { Badge } from '@/components/shop/Badge';
import { Modal } from '@/components/shop/Modal';
import { Confirm } from '@/components/shop/Confirm';
import { Field } from '@/components/shop/Field';
import { PrintPortal } from '@/components/shop/PrintPortal';
import { usePrint } from '@/hooks/usePrint';
import * as customersApi from '@/services/api/customers';
import * as salesApi from '@/services/api/sales';
import * as customerPaymentsApi from '@/services/api/customerPayments';
import * as customerCreditPayoutsApi from '@/services/api/customerCreditPayouts';
import * as salesReturnsApi from '@/services/api/salesReturns';
import { inp, btn, btnOutline, thCls, tdCls } from '@/components/shop/styles';

// Fetched in one call (the backend's max page size) rather than paginated —
// keeps this page's design close to the original (no pager UI here) while
// comfortably covering the realistic scale this system targets. A customer
// with more than 100 invoices/payments/returns ever would only see the most
// recent 100 of each here.
const HISTORY_LIMIT = 100;

// Keeps exactly what the person typed on screen (so backspace/clearing feels
// natural and the cursor never jumps to the end), while only allowing the
// characters a decimal amount can actually contain — digits and a single
// decimal point. Same helper as PosPage.jsx/PurchasesPage.jsx — duplicated
// rather than shared to keep this change contained to the file that needs it.
const sanitizeDecimalText = (raw) => {
  let value = String(raw).replace(/[^0-9.]/g, '');
  const dot = value.indexOf('.');
  if (dot !== -1) value = value.slice(0, dot + 1) + value.slice(dot + 1).replace(/\./g, '');
  return value;
};
const decimalTextToNumber = (text) => {
  if (text === '' || text === '.') return 0;
  const n = parseFloat(text);
  return Number.isNaN(n) ? 0 : n;
};

// Return quantities are always whole units — same "never force to 0 while
// typing, no cursor jump" principle as sanitizeDecimalText, just digits only
// (no decimal point) since you can't return a fractional item.
const sanitizeIntegerText = (raw) => String(raw).replace(/[^0-9]/g, '');
const integerTextToNumber = (text) => (text === '' ? 0 : parseInt(text, 10) || 0);

// One id per return ATTEMPT (not per keystroke/render) — generated when the
// person opens the confirm step for a given invoice, and reused if the
// submit is retried (network error, etc.) without closing the modal. The
// backend's unique index on this key is what makes a double-tap/network
// retry produce exactly one return instead of two (see the phase's backend
// design note).
const newIdempotencyKey = () => (
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `ret-${Date.now()}-${Math.random().toString(36).slice(2)}`
);

export function CustomerDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [sales, setSales] = useState([]);
  const [payments, setPayments] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [printing, startPrint] = usePrint();

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmountText, setPaymentAmountText] = useState('');
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentIdemKey, setPaymentIdemKey] = useState('');
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutAmountText, setPayoutAmountText] = useState('');
  const [confirmingPayout, setConfirmingPayout] = useState(false);
  const [submittingPayout, setSubmittingPayout] = useState(false);
  const [payoutIdemKey, setPayoutIdemKey] = useState('');
  const [deletePaymentTarget, setDeletePaymentTarget] = useState(null);
  const [deletingPayment, setDeletingPayment] = useState(false);
  const [deletePayoutTarget, setDeletePayoutTarget] = useState(null);
  const [deletingPayout, setDeletingPayout] = useState(false);

  // Returns flow: 'pick-invoice' -> 'pick-items' -> 'confirm'
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnStep, setReturnStep] = useState('pick-invoice');
  const [returnable, setReturnable] = useState(null); // { saleId, invoiceNumber, items: [...] }
  const [loadingReturnable, setLoadingReturnable] = useState(false);
  const [returnQtyText, setReturnQtyText] = useState({}); // { [productId]: rawText }
  const [returnIdemKey, setReturnIdemKey] = useState('');
  const [submittingReturn, setSubmittingReturn] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const [customerRes, salesRes, paymentsRes, returnsRes, payoutsRes] = await Promise.all([
        customersApi.getCustomer(id),
        salesApi.listSales({ customerId: id, limit: HISTORY_LIMIT }),
        customerPaymentsApi.listCustomerPayments({ customerId: id, limit: HISTORY_LIMIT }),
        salesReturnsApi.listSalesReturns({ customerId: id, limit: HISTORY_LIMIT }),
        customerCreditPayoutsApi.listCustomerCreditPayouts({ customerId: id, limit: HISTORY_LIMIT }),
      ]);
      setCustomer(customerRes.data);
      setSales(salesRes.data);
      setPayments(paymentsRes.data);
      setReturns(returnsRes.data);
      setPayouts(payoutsRes.data);
    } catch (err) {
      if (err.status === 404) setNotFound(true);
      else toast.error(err.message || 'تعذر تحميل بيانات العميل');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 size={22} className="animate-spin" />
      </div>
    );
  }

  if (notFound || !customer) {
    return <Empty text="العميل غير موجود" actionLabel="العودة للعملاء" onAction={() => navigate('/customers')} />;
  }

  const t = customer.totals || { total: 0, paid: 0, remaining: 0, count: 0, lastPurchase: null, returned: 0 };

  const paymentAmount = decimalTextToNumber(paymentAmountText);
  const paymentExceedsRemaining = paymentAmount > t.remaining;
  const paymentValid = paymentAmount > 0 && !paymentExceedsRemaining;
  const newBalancePreview = Math.max(0, t.remaining - Math.min(paymentAmount, t.remaining));

  const payoutAmount = decimalTextToNumber(payoutAmountText);
  const payoutExceedsCreditOwed = payoutAmount > (t.creditOwed || 0);
  const payoutValid = payoutAmount > 0 && !payoutExceedsCreditOwed;
  const newCreditOwedPreview = Math.max(0, (t.creditOwed || 0) - Math.min(payoutAmount, t.creditOwed || 0));

  const openPaymentModal = () => {
    setPaymentAmountText('');
    setConfirmingPayment(false);
    setPaymentIdemKey(newIdempotencyKey());
    setShowPaymentModal(true);
  };
  const closePaymentModal = () => {
    if (submittingPayment) return;
    setShowPaymentModal(false);
    setConfirmingPayment(false);
    setPaymentAmountText('');
  };

  const openPayoutModal = () => {
    setPayoutAmountText('');
    setConfirmingPayout(false);
    setPayoutIdemKey(newIdempotencyKey());
    setShowPayoutModal(true);
  };
  const closePayoutModal = () => {
    if (submittingPayout) return;
    setShowPayoutModal(false);
    setConfirmingPayout(false);
    setPayoutAmountText('');
  };

  const submitPayment = async () => {
    setSubmittingPayment(true);
    try {
      await customerPaymentsApi.createCustomerPayment({ customerId: id, amount: paymentAmount, idempotencyKey: paymentIdemKey });
      toast.success('تم تسجيل السداد بنجاح');
      setShowPaymentModal(false);
      setConfirmingPayment(false);
      setPaymentAmountText('');
      await load(); // refresh totals + sales + payments from the server
    } catch (err) {
      toast.error(err.message || 'تعذر تسجيل السداد');
      setConfirmingPayment(false); // back to the input step so they can adjust and retry
    } finally {
      setSubmittingPayment(false);
    }
  };

  const submitPayout = async () => {
    setSubmittingPayout(true);
    try {
      await customerCreditPayoutsApi.createCustomerCreditPayout({ customerId: id, amount: payoutAmount, idempotencyKey: payoutIdemKey });
      toast.success('تم دفع المستحق للعميل، وتم خصمه من الصندوق');
      setShowPayoutModal(false);
      setConfirmingPayout(false);
      setPayoutAmountText('');
      await load(); // refresh totals + payouts from the server
    } catch (err) {
      toast.error(err.message || 'تعذر تسجيل الدفع');
      setConfirmingPayout(false); // back to the input step so they can adjust and retry
    } finally {
      setSubmittingPayout(false);
    }
  };

  const handleDeletePayment = async () => {
    if (!deletePaymentTarget) return;
    setDeletingPayment(true);
    try {
      await customerPaymentsApi.deleteCustomerPayment(deletePaymentTarget._id);
      toast.success('تم حذف السداد وإعادة المبلغ للصندوق');
      setDeletePaymentTarget(null);
      await load(); // refresh totals + payments from the server
    } catch (err) {
      toast.error(err.message || 'تعذر حذف السداد');
    } finally {
      setDeletingPayment(false);
    }
  };

  const handleDeletePayout = async () => {
    if (!deletePayoutTarget) return;
    setDeletingPayout(true);
    try {
      await customerCreditPayoutsApi.deleteCustomerCreditPayout(deletePayoutTarget._id);
      toast.success('تم حذف عملية الدفع، ورجع المبلغ لرصيد الصندوق');
      setDeletePayoutTarget(null);
      await load(); // refresh totals + payouts from the server
    } catch (err) {
      toast.error(err.message || 'تعذر حذف العملية');
    } finally {
      setDeletingPayout(false);
    }
  };

  // ---- Returns flow ----

  const openReturnModal = () => {
    setReturnStep('pick-invoice');
    setReturnable(null);
    setReturnQtyText({});
    setShowReturnModal(true);
  };
  const closeReturnModal = () => {
    if (submittingReturn) return;
    setShowReturnModal(false);
    setReturnStep('pick-invoice');
    setReturnable(null);
    setReturnQtyText({});
  };

  const pickInvoiceForReturn = async (sale) => {
    setLoadingReturnable(true);
    try {
      const res = await salesReturnsApi.getReturnableForSale(sale._id);
      setReturnable(res.data);
      setReturnQtyText({});
      setReturnIdemKey(newIdempotencyKey());
      setReturnStep('pick-items');
    } catch (err) {
      toast.error(err.message || 'تعذر تحميل بيانات الفاتورة');
    } finally {
      setLoadingReturnable(false);
    }
  };

  // Lines the person actually entered a quantity for (>0), each carrying its
  // own validity against that specific product's availableToReturn — a
  // typo on one line never silently blocks or corrupts another.
  const returnLines = (returnable?.items || [])
    .map((it) => {
      const qty = integerTextToNumber(returnQtyText[it.productId] || '');
      return { ...it, quantity: qty, exceedsAvailable: qty > it.availableToReturn, amount: qty * (it.effectiveUnitPrice ?? it.originalUnitPrice) };
    })
    .filter((l) => l.quantity > 0);

  const returnTotalAmount = returnLines.reduce((s, l) => s + l.amount, 0);
  const returnHasInvalidLine = returnLines.some((l) => l.exceedsAvailable);
  const returnStepValid = returnLines.length > 0 && !returnHasInvalidLine;
  const returnNewBalancePreview = Math.max(0, t.remaining - Math.min(returnTotalAmount, t.remaining));

  const submitReturn = async () => {
    setSubmittingReturn(true);
    try {
      await salesReturnsApi.createSalesReturn({
        saleId: returnable.saleId,
        items: returnLines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        idempotencyKey: returnIdemKey,
      });
      toast.success('تم تسجيل المرتجع بنجاح');
      closeReturnModal();
      await load(); // refresh totals + stock-affecting views + history from the server
    } catch (err) {
      toast.error(err.message || 'تعذر تسجيل المرتجع');
      setReturnStep('pick-items'); // back to the input step so they can adjust and retry (same idempotency key)
    } finally {
      setSubmittingReturn(false);
    }
  };

  return (
    <div className="grid gap-4">
      <Helmet><title>{customer.name} — نظام إدارة المحل</title><meta name="description" content={`تفاصيل العميل ${customer.name}`} /></Helmet>

      <Link to="/customers" className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowRight size={15} /> العودة للعملاء
      </Link>

      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">{customer.name}</h1>
            <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
              {customer.phone && <span className="flex items-center gap-1.5"><Phone size={14} /> {customer.phone}</span>}
              {customer.address && <span className="flex items-center gap-1.5"><MapPin size={14} /> {customer.address}</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={openPaymentModal}
              disabled={t.remaining <= 0}
              title={t.remaining <= 0 ? 'لا يوجد مبلغ مستحق على هذا العميل' : ''}
              className={`${btn} !h-9`}
            >
              <Wallet size={15} /> تسجيل سداد
            </button>
            {t.creditOwed > 0 && (
              <button
                onClick={openPayoutModal}
                className={`${btn} !h-9 !bg-emerald-600 hover:!bg-emerald-700`}
              >
                <Wallet size={15} /> دفع مستحق للعميل
              </button>
            )}
            <button
              onClick={openReturnModal}
              disabled={sales.length === 0}
              title={sales.length === 0 ? 'لا توجد فواتير لهذا العميل' : ''}
              className={`${btnOutline} !h-9`}
            >
              <Undo2 size={15} /> مرتجع
            </button>
            <button onClick={startPrint} className="flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted">
              <Printer size={15} /> طباعة كشف حساب
            </button>
          </div>
        </div>

        <div className={`mt-5 grid grid-cols-2 gap-3 ${t.creditOwed > 0 ? 'sm:grid-cols-6' : t.returned > 0 ? 'sm:grid-cols-5' : 'sm:grid-cols-4'}`}>
          <div className="rounded-lg bg-muted/40 p-3">
            <div className="text-xs text-muted-foreground">إجمالي المشتريات</div>
            <div className="mt-1 text-lg font-bold text-foreground">{fmtMoney(t.total)}</div>
          </div>
          <div className="rounded-lg bg-muted/40 p-3">
            <div className="text-xs text-muted-foreground">المدفوع</div>
            <div className="mt-1 text-lg font-bold text-emerald-600">{fmtMoney(t.paid)}</div>
          </div>
          {t.returned > 0 && (
            <div className="rounded-lg bg-muted/40 p-3">
              <div className="text-xs text-muted-foreground">إجمالي المرتجعات</div>
              <div className="mt-1 text-lg font-bold text-amber-600">{fmtMoney(t.returned)}</div>
            </div>
          )}
          <div className="rounded-lg bg-muted/40 p-3">
            <div className="text-xs text-muted-foreground">المتبقي</div>
            <div className="mt-1 text-lg font-bold text-destructive">{fmtMoney(t.remaining)}</div>
          </div>
          {t.creditOwed > 0 && (
            <div className="rounded-lg bg-emerald-50 p-3" title="مبلغ زائد ناتج عن مرتجع بقيمة أكبر من المديونية — مستحق للعميل (استرداد نقدي أو ترحيل لعملية قادمة)">
              <div className="text-xs text-muted-foreground">رصيد مستحق للعميل</div>
              <div className="mt-1 text-lg font-bold text-emerald-700">{fmtMoney(t.creditOwed)}</div>
            </div>
          )}
          <div className="rounded-lg bg-muted/40 p-3">
            <div className="text-xs text-muted-foreground">عدد الفواتير</div>
            <div className="mt-1 text-lg font-bold text-foreground">{t.count}</div>
          </div>
        </div>
      </div>

      {/* Sales history */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full text-start">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className={thCls}>رقم الفاتورة</th>
              <th className={thCls}>التاريخ</th>
              <th className={thCls}>المنتجات</th>
              <th className={thCls}>الإجمالي</th>
              <th className={thCls}>المدفوع</th>
              <th className={thCls}>المتبقي</th>
              <th className={thCls}>طريقة الدفع</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s._id} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className={`${tdCls} font-mono text-xs`}>{s.invoiceNumber}</td>
                <td className={`${tdCls} text-muted-foreground`}>{fmtDate(s.date)}</td>
                <td className={`${tdCls} text-muted-foreground`}>{s.items?.map((i) => i.name).join('، ')}</td>
                <td className={`${tdCls} font-mono`}>{fmtMoney(s.total)}</td>
                <td className={`${tdCls} font-mono`}>{fmtMoney(s.paid)}</td>
                <td className={`${tdCls} font-mono`}>{s.remaining > 0 ? <span className="text-destructive">{fmtMoney(s.remaining)}</span> : '—'}</td>
                <td className={tdCls}><Badge tone={s.paymentMethod === 'cash' ? 'green' : 'amber'}>{s.paymentMethod === 'cash' ? 'كاش' : 'آجل'}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
        {sales.length === 0 && <Empty text="لا توجد فواتير مسجلة لهذا العميل" />}
      </div>

      {/* Payment (settlement) history — standalone from the sales above:
          each row here reduces the customer's running balance without
          changing any invoice's own recorded paid/remaining. */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">سجل السداد</h3>
        </div>
        <table className="w-full text-start">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className={thCls}>التاريخ والوقت</th>
              <th className={thCls}>المبلغ المسدد</th>
              <th className={thCls}>الرصيد بعد السداد</th>
              <th className={thCls}></th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p._id} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className={`${tdCls} text-muted-foreground`}>{fmtDateTime(p.date)}</td>
                <td className={`${tdCls} font-mono font-semibold text-emerald-600`}>{fmtMoney(p.amount)}</td>
                <td className={`${tdCls} font-mono`}>{fmtMoney(p.balanceAfter)}</td>
                <td className={`${tdCls} text-end`}>
                  <button
                    onClick={() => setDeletePaymentTarget(p)}
                    className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10 transition-colors"
                    title="حذف السداد (تسجيل غلط)"
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {payments.length === 0 && <Empty text="لا توجد عمليات سداد مسجلة لهذا العميل" />}
      </div>

      {/* Credit payout history — money the shop has paid BACK to the
          customer against a creditOwed balance (see
          customerCreditPayout.service.js). Only rendered when relevant. */}
      {(payouts.length > 0 || t.creditOwed > 0) && (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">سجل دفع المستحق للعميل</h3>
          </div>
          <table className="w-full text-start">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className={thCls}>التاريخ والوقت</th>
                <th className={thCls}>المبلغ المدفوع</th>
                <th className={thCls}>المستحق بعد الدفع</th>
                <th className={thCls}></th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p._id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className={`${tdCls} text-muted-foreground`}>{fmtDateTime(p.date)}</td>
                  <td className={`${tdCls} font-mono font-semibold text-destructive`}>{fmtMoney(p.amount)}</td>
                  <td className={`${tdCls} font-mono`}>{fmtMoney(p.creditOwedAfter)}</td>
                  <td className={`${tdCls} text-end`}>
                    <button
                      onClick={() => setDeletePayoutTarget(p)}
                      className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10 transition-colors"
                      title="حذف عملية الدفع (تسجيل غلط)"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {payouts.length === 0 && <Empty text="لا توجد عمليات دفع مستحق مسجلة لهذا العميل" />}
        </div>
      )}

      {/* Returns history — standalone from the sales above: each row here
          restores stock and reduces the customer's running balance without
          changing the original sale's own recorded items/paid/remaining. */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">سجل المرتجعات</h3>
        </div>
        <table className="w-full text-start">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className={thCls}>التاريخ والوقت</th>
              <th className={thCls}>رقم الفاتورة الأصلية</th>
              <th className={thCls}>المنتجات المرتجعة</th>
              <th className={thCls}>قيمة المرتجع</th>
            </tr>
          </thead>
          <tbody>
            {returns.map((r) => {
              const originalSale = sales.find((s) => s._id === r.saleId);
              return (
                <tr key={r._id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className={`${tdCls} text-muted-foreground`}>{fmtDateTime(r.date)}</td>
                  <td className={`${tdCls} font-mono text-xs`}>{originalSale?.invoiceNumber || '—'}</td>
                  <td className={`${tdCls} text-muted-foreground`}>
                    {r.items?.map((i) => `${i.name} × ${i.returnedQuantity}`).join('، ')}
                  </td>
                  <td className={`${tdCls} font-mono font-semibold text-amber-600`}>{fmtMoney(r.totalReturnAmount)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {returns.length === 0 && <Empty text="لا توجد مرتجعات مسجلة لهذا العميل" />}
      </div>

      {/* Record payment modal */}
      <Modal open={showPaymentModal} onClose={closePaymentModal} title="تسجيل سداد">
        {!confirmingPayment ? (
          <div className="grid gap-4">
            <div className="rounded-lg bg-muted/40 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">المتبقي الحالي</span>
                <b className="font-mono text-destructive">{fmtMoney(t.remaining)}</b>
              </div>
            </div>

            <Field label="مبلغ السداد">
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                autoFocus
                className={`${inp} font-mono`}
                value={paymentAmountText}
                onChange={(e) => setPaymentAmountText(sanitizeDecimalText(e.target.value))}
                placeholder="0"
              />
              {paymentExceedsRemaining && (
                <p className="mt-1 text-xs font-semibold text-destructive">مبلغ السداد أكبر من المتبقي على العميل</p>
              )}
            </Field>

            <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">المتبقي الجديد بعد السداد</span>
                <b className="font-mono text-primary">{fmtMoney(newBalancePreview)}</b>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button className={btnOutline} onClick={closePaymentModal}>إلغاء</button>
              <button className={btn} disabled={!paymentValid} onClick={() => setConfirmingPayment(true)}>
                متابعة
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-5">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50">
                <CheckCircle2 size={16} className="text-emerald-600" />
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                هل تريد تسجيل سداد بقيمة <b className="font-mono text-foreground">{fmtMoney(paymentAmount)}</b> من
                العميل <b className="text-foreground">{customer.name}</b>؟
                <br />
                سيصبح المتبقي عليه <b className="font-mono text-foreground">{fmtMoney(newBalancePreview)}</b>.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button className={btnOutline} onClick={() => setConfirmingPayment(false)} disabled={submittingPayment}>رجوع</button>
              <button className={btn} onClick={submitPayment} disabled={submittingPayment}>
                {submittingPayment && <Loader2 size={14} className="animate-spin" />} تأكيد السداد
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Pay out credit owed to the customer */}
      <Modal open={showPayoutModal} onClose={closePayoutModal} title="دفع مستحق للعميل">
        {!confirmingPayout ? (
          <div className="grid gap-4">
            <div className="rounded-lg bg-muted/40 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">المستحق للعميل حاليًا</span>
                <b className="font-mono text-emerald-700">{fmtMoney(t.creditOwed || 0)}</b>
              </div>
            </div>

            <Field label="المبلغ اللي هتدفعه">
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                autoFocus
                className={`${inp} font-mono`}
                value={payoutAmountText}
                onChange={(e) => setPayoutAmountText(sanitizeDecimalText(e.target.value))}
                placeholder="0"
              />
              {payoutExceedsCreditOwed && (
                <p className="mt-1 text-xs font-semibold text-destructive">المبلغ أكبر من المستحق الفعلي لهذا العميل</p>
              )}
            </Field>

            <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">المستحق الجديد بعد الدفع</span>
                <b className="font-mono text-primary">{fmtMoney(newCreditOwedPreview)}</b>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button className={btnOutline} onClick={closePayoutModal}>إلغاء</button>
              <button className={btn} disabled={!payoutValid} onClick={() => setConfirmingPayout(true)}>
                متابعة
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-5">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50">
                <CheckCircle2 size={16} className="text-emerald-600" />
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                هل تريد دفع <b className="font-mono text-foreground">{fmtMoney(payoutAmount)}</b> نقدًا من الصندوق
                للعميل <b className="text-foreground">{customer.name}</b>؟
                <br />
                سيصبح المستحق له <b className="font-mono text-foreground">{fmtMoney(newCreditOwedPreview)}</b>.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button className={btnOutline} onClick={() => setConfirmingPayout(false)} disabled={submittingPayout}>رجوع</button>
              <button className={btn} onClick={submitPayout} disabled={submittingPayout}>
                {submittingPayout && <Loader2 size={14} className="animate-spin" />} تأكيد الدفع
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Return flow modal: pick invoice -> pick quantities per product -> confirm */}
      <Modal open={showReturnModal} onClose={closeReturnModal} title="تسجيل مرتجع" wide={returnStep !== 'pick-invoice'}>
        {returnStep === 'pick-invoice' && (
          <div className="grid gap-3">
            <p className="text-sm text-muted-foreground">اختر الفاتورة المطلوب إرجاع منتجات منها:</p>
            <div className="grid max-h-96 gap-2 overflow-y-auto">
              {sales.map((s) => (
                <button
                  key={s._id}
                  onClick={() => pickInvoiceForReturn(s)}
                  disabled={loadingReturnable}
                  className="flex items-center justify-between rounded-lg border border-border p-3 text-start transition-colors hover:bg-muted disabled:opacity-60"
                >
                  <div>
                    <div className="font-mono text-sm font-semibold">{s.invoiceNumber}</div>
                    <div className="text-xs text-muted-foreground">{fmtDate(s.date)} — {s.items?.map((i) => i.name).join('، ')}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold">{fmtMoney(s.total)}</span>
                    {loadingReturnable ? <Loader2 size={16} className="animate-spin text-muted-foreground" /> : <ChevronRight size={16} className="rotate-180 text-muted-foreground" />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {returnStep === 'pick-items' && returnable && (
          <div className="grid gap-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">الفاتورة</span>
              <b className="font-mono">{returnable.invoiceNumber}</b>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-start text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className={thCls}>المنتج</th>
                    <th className={thCls}>الكمية الأصلية</th>
                    <th className={thCls}>مرتجع سابقًا</th>
                    <th className={thCls}>المتاح للإرجاع</th>
                    <th className={thCls}>سعر البيع</th>
                    <th className={thCls}>الكمية المرتجعة</th>
                  </tr>
                </thead>
                <tbody>
                  {returnable.items.map((it) => {
                    const line = returnLines.find((l) => l.productId === it.productId);
                    const qtyText = returnQtyText[it.productId] || '';
                    const exceeds = line?.exceedsAvailable;
                    return (
                      <tr key={it.productId} className="border-b border-border last:border-0">
                        <td className={tdCls}>{it.name}</td>
                        <td className={`${tdCls} font-mono`}>{it.originalQuantity}</td>
                        <td className={`${tdCls} font-mono`}>{it.alreadyReturnedQuantity}</td>
                        <td className={`${tdCls} font-mono ${it.availableToReturn === 0 ? 'text-muted-foreground' : 'text-primary'}`}>{it.availableToReturn}</td>
                        <td className={`${tdCls} font-mono`}>
                          {fmtMoney(it.originalUnitPrice)}
                          {it.effectiveUnitPrice != null && it.effectiveUnitPrice !== it.originalUnitPrice && (
                            <div className="text-xs font-normal text-muted-foreground">
                              بعد نصيبه من الخصم: {fmtMoney(it.effectiveUnitPrice)}
                            </div>
                          )}
                        </td>
                        <td className={tdCls}>
                          <input
                            type="text"
                            inputMode="numeric"
                            autoComplete="off"
                            disabled={it.availableToReturn === 0}
                            className={`h-9 w-20 rounded-lg border bg-background px-2 font-mono text-sm ${exceeds ? 'border-destructive' : 'border-border'}`}
                            value={qtyText}
                            onChange={(e) => setReturnQtyText((prev) => ({ ...prev, [it.productId]: sanitizeIntegerText(e.target.value) }))}
                            placeholder="0"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {returnHasInvalidLine && (
              <p className="text-xs font-semibold text-destructive">هناك كمية مطلوب إرجاعها أكبر من المتاح للإرجاع</p>
            )}
            {returnTotalAmount > t.remaining && !returnHasInvalidLine && (
              <p className="text-xs font-semibold text-amber-600">
                قيمة المرتجع أكبر من المتبقي على العميل — الفرق ({fmtMoney(returnTotalAmount - t.remaining)}) سيُسجَّل كرصيد
                مستحق للعميل بعد تنفيذ المرتجع
              </p>
            )}

            <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">قيمة المرتجع</span>
                <b className="font-mono text-primary">{fmtMoney(returnTotalAmount)}</b>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">المتبقي على العميل بعد المرتجع</span>
                <b className="font-mono">{fmtMoney(returnNewBalancePreview)}</b>
              </div>
            </div>

            <div className="flex justify-between gap-2">
              <button className={btnOutline} onClick={() => setReturnStep('pick-invoice')}>رجوع</button>
              <div className="flex gap-2">
                <button className={btnOutline} onClick={closeReturnModal}>إلغاء</button>
                <button className={btn} disabled={!returnStepValid} onClick={() => setReturnStep('confirm')}>متابعة</button>
              </div>
            </div>
          </div>
        )}

        {returnStep === 'confirm' && returnable && (
          <div className="grid gap-5">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-50">
                <Undo2 size={16} className="text-amber-600" />
              </div>
              <div className="text-sm leading-relaxed text-muted-foreground">
                <p className="mb-2">
                  هل تريد تسجيل مرتجع من الفاتورة <b className="font-mono text-foreground">{returnable.invoiceNumber}</b>؟
                </p>
                <ul className="mb-2 list-inside list-disc">
                  {returnLines.map((l) => (
                    <li key={l.productId}>
                      {l.name} × {l.quantity} = <span className="font-mono text-foreground">{fmtMoney(l.amount)}</span>
                    </li>
                  ))}
                </ul>
                <p>
                  إجمالي قيمة المرتجع <b className="font-mono text-foreground">{fmtMoney(returnTotalAmount)}</b>، وسيصبح
                  المتبقي على العميل <b className="font-mono text-foreground">{fmtMoney(returnNewBalancePreview)}</b>.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button className={btnOutline} onClick={() => setReturnStep('pick-items')} disabled={submittingReturn}>رجوع</button>
              <button className={btn} onClick={submitReturn} disabled={submittingReturn}>
                {submittingReturn && <Loader2 size={14} className="animate-spin" />} تأكيد المرتجع
              </button>
            </div>
          </div>
        )}
      </Modal>

      {printing && (
        <PrintPortal>
          <div className="p-8" dir="rtl">
            <h1 className="mb-1 text-xl font-bold">كشف حساب — {customer.name}</h1>
            <p className="mb-4 text-sm text-muted-foreground">{customer.phone}</p>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-black/20">
                  <th className="p-2 text-start">رقم الفاتورة</th>
                  <th className="p-2 text-start">التاريخ</th>
                  <th className="p-2 text-start">الإجمالي</th>
                  <th className="p-2 text-start">المدفوع</th>
                  <th className="p-2 text-start">المتبقي</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s._id} className="border-b border-black/10">
                    <td className="p-2 font-mono">{s.invoiceNumber}</td>
                    <td className="p-2">{fmtDate(s.date)}</td>
                    <td className="p-2 font-mono">{fmtMoney(s.total)}</td>
                    <td className="p-2 font-mono">{fmtMoney(s.paid)}</td>
                    <td className="p-2 font-mono">{fmtMoney(s.remaining)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {payments.length > 0 && (
              <>
                <h2 className="mb-2 mt-6 text-base font-bold">سجل السداد</h2>
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-black/20">
                      <th className="p-2 text-start">التاريخ والوقت</th>
                      <th className="p-2 text-start">المبلغ المسدد</th>
                      <th className="p-2 text-start">الرصيد بعد السداد</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p._id} className="border-b border-black/10">
                        <td className="p-2">{fmtDateTime(p.date)}</td>
                        <td className="p-2 font-mono">{fmtMoney(p.amount)}</td>
                        <td className="p-2 font-mono">{fmtMoney(p.balanceAfter)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {returns.length > 0 && (
              <>
                <h2 className="mb-2 mt-6 text-base font-bold">سجل المرتجعات</h2>
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-black/20">
                      <th className="p-2 text-start">التاريخ والوقت</th>
                      <th className="p-2 text-start">المنتجات المرتجعة</th>
                      <th className="p-2 text-start">قيمة المرتجع</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returns.map((r) => (
                      <tr key={r._id} className="border-b border-black/10">
                        <td className="p-2">{fmtDateTime(r.date)}</td>
                        <td className="p-2">{r.items?.map((i) => `${i.name} × ${i.returnedQuantity}`).join('، ')}</td>
                        <td className="p-2 font-mono">{fmtMoney(r.totalReturnAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {payouts.length > 0 && (
              <>
                <h2 className="mb-2 mt-6 text-base font-bold">سجل دفع المستحق للعميل</h2>
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-black/20">
                      <th className="p-2 text-start">التاريخ والوقت</th>
                      <th className="p-2 text-start">المبلغ المدفوع</th>
                      <th className="p-2 text-start">المستحق بعد الدفع</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payouts.map((p) => (
                      <tr key={p._id} className="border-b border-black/10">
                        <td className="p-2">{fmtDateTime(p.date)}</td>
                        <td className="p-2 font-mono">{fmtMoney(p.amount)}</td>
                        <td className="p-2 font-mono">{fmtMoney(p.creditOwedAfter)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            <div className="mt-4 flex justify-end gap-8 text-sm font-bold">
              <span>الإجمالي: {fmtMoney(t.total)}</span>
              <span>المدفوع: {fmtMoney(t.paid)}</span>
              <span>المتبقي: {fmtMoney(t.remaining)}</span>
              {t.creditOwed > 0 && <span>المستحق للعميل: {fmtMoney(t.creditOwed)}</span>}
            </div>
          </div>
        </PrintPortal>
      )}

      <Confirm
        open={!!deletePaymentTarget}
        onClose={() => { if (!deletingPayment) setDeletePaymentTarget(null); }}
        title="حذف سداد"
        description={`هل أنت متأكد من حذف سداد بقيمة ${fmtMoney(deletePaymentTarget?.amount || 0)}؟ سيتم إعادة المبلغ للصندوق ورصيد العميل سيرتفع بنفس القيمة.`}
        onConfirm={handleDeletePayment}
      />

      <Confirm
        open={!!deletePayoutTarget}
        onClose={() => { if (!deletingPayout) setDeletePayoutTarget(null); }}
        title="حذف عملية دفع مستحق"
        description={`هل أنت متأكد من حذف عملية دفع بقيمة ${fmtMoney(deletePayoutTarget?.amount || 0)}؟ سيرجع المبلغ لرصيد الصندوق، والمستحق للعميل سيرتفع بنفس القيمة.`}
        onConfirm={handleDeletePayout}
      />
    </div>
  );
}

export default CustomerDetailsPage;