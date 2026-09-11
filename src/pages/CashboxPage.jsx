import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { toast } from 'sonner';
import { Search, Plus, Minus, ArrowDownCircle, ArrowUpCircle, Wallet, FileText, Loader2, Trash2 } from 'lucide-react';
import { fmtMoney, fmtDate, fmtTime, todayInputValue } from '@/lib/formatters';
import { Field } from '@/components/shop/Field';
import { Empty } from '@/components/shop/Empty';
import { Stat } from '@/components/shop/Stat';
import { Badge } from '@/components/shop/Badge';
import { Modal } from '@/components/shop/Modal';
import { Confirm } from '@/components/shop/Confirm';
import { Pagination } from '@/components/shop/Pagination';
import { useDebounce } from '@/hooks/useDebounce';
import { useApiList } from '@/hooks/useApiList';
import * as cashboxApi from '@/services/api/cashbox';
import { inp, btn, btnOutline, btnDanger, thCls, tdCls } from '@/components/shop/styles';

export function CashboxPage() {
  const [params, setParams] = useSearchParams();
  const [modal, setModal] = useState(params.get('add') === '1' ? 'in' : null);
  const [form, setForm] = useState({ amount: '', reason: '', date: todayInputValue(), notes: '' });
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [summary, setSummary] = useState(null);

  const debouncedSearch = useDebounce(search);

  useEffect(() => setPage(1), [debouncedSearch, typeFilter]);

  const reloadSummary = useCallback(() => {
    cashboxApi.getCashboxSummary()
      .then((res) => setSummary(res.data))
      .catch(() => { /* stat cards are a nice-to-have; a failure here shouldn't block the page */ });
  }, []);

  useEffect(() => { reloadSummary(); }, [reloadSummary]);

  const { items: rows, pagination, loading, error, reload } = useApiList(cashboxApi.listCashboxTransactions, {
    page, limit: 20, type: typeFilter, search: debouncedSearch,
  });

  useEffect(() => {
    if (error) toast.error(error.message || 'تعذر تحميل حركة الصندوق');
  }, [error]);

  const openModal = (type) => {
    setForm({ amount: '', reason: '', date: todayInputValue(), notes: '' });
    setModal(type);
  };

  const handleValidationAndSubmit = () => {
    if (!form.amount || Number(form.amount) <= 0) {
      toast.error('من فضلك أدخل مبلغاً صحيحاً');
      return false;
    }
    if (!form.reason.trim()) {
      toast.error('من فضلك اذكر سبب الحركة');
      return false;
    }
    return true;
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      await cashboxApi.createCashTransaction({ type: modal, ...form, amount: Number(form.amount) });
      toast.success(modal === 'in' ? 'تمت إضافة المبلغ بنجاح' : 'تم سحب المبلغ بنجاح');
      setModal(null);
      setConfirmWithdraw(false);
      setParams({});
      reload();
      reloadSummary();
    } catch (err) {
      toast.error(err.message || 'تعذر تنفيذ العملية');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await cashboxApi.deleteCashTransaction(deleteTarget._id);
      toast.success('تم حذف الحركة وتحديث رصيد الصندوق');
      setDeleteTarget(null);
      reload();
      reloadSummary();
    } catch (err) {
      toast.error(err.message || 'تعذر حذف الحركة');
    }
  };

  return (
    <div className="grid gap-4">
      <Helmet>
        <title>الصندوق — نظام إدارة المحل</title>
        <meta name="description" content="إدارة الصندوق والخزينة" />
      </Helmet>

      {/* الهيدر الرئيسي مع الرصيد والإحصائيات */}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border bg-slate-900 p-5 text-white flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">الرصيد الحالي بالخزينة</span>
            <Wallet className="size-5 text-emerald-400" />
          </div>
          <div className="mt-2 text-3xl font-extrabold text-emerald-400 tracking-tight">
            {summary ? fmtMoney(summary.balance) : '—'}
          </div>
        </div>

        <Stat
          title="إجمالي الداخل اليوم"
          value={summary ? fmtMoney(summary.todayIn) : '—'}
          icon={ArrowDownCircle}
          tone="bg-emerald-500/10 text-emerald-600 border-emerald-200/50"
        />
        <Stat
          title="إجمالي الخارج اليوم"
          value={summary ? fmtMoney(summary.todayOut) : '—'}
          icon={ArrowUpCircle}
          tone="bg-red-500/10 text-red-600 border-red-200/50"
        />
      </div>

      {/* أزرار الإجراءات والشريط الأفق للفلترة */}
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button className={`${btn} gap-1.5`} onClick={() => openModal('in')}>
            <Plus size={16} /> إضافة مبلغ
          </button>
          <button className={`${btnDanger} gap-1.5`} onClick={() => openModal('out')}>
            <Minus size={16} /> سحب مبلغ
          </button>
        </div>

        <div className="flex flex-1 items-center gap-2 sm:max-w-md">
          <div className="relative flex-1">
            <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              className={`${inp} ps-9`}
              placeholder="بحث في سبب الحركة..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className={`${inp} w-32 shrink-0`}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">كل الحركات</option>
            <option value="in">إيداع (داخل)</option>
            <option value="out">سحب (خارج)</option>
          </select>
        </div>
      </div>

      {/* جدول حركة الخزينة */}
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-start">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className={thCls}>النوع</th>
              <th className={thCls}>المبلغ</th>
              <th className={thCls}>السبب</th>
              <th className={thCls}>التاريخ</th>
              <th className={thCls}>الوقت</th>
              <th className={thCls}>العملية المرتبطة</th>
              <th className={thCls}></th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 && (
              <tr><td colSpan={7} className="py-14 text-center text-muted-foreground"><Loader2 size={20} className="mx-auto mb-2 animate-spin" />جارِ تحميل حركة الصندوق...</td></tr>
            )}
            {rows.map((t) => (
              <tr key={t._id} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                <td className={tdCls}>
                  <Badge tone={t.type === 'in' ? 'green' : 'red'}>
                    {t.type === 'in' ? 'إيداع' : 'سحب'}
                  </Badge>
                </td>
                <td className={`${tdCls} font-bold font-mono ${t.type === 'in' ? 'text-emerald-600' : 'text-destructive'}`}>
                  {t.type === 'in' ? '+' : '-'}{fmtMoney(t.amount)}
                </td>
                <td className={`${tdCls} font-medium`}>{t.reason || '—'}</td>
                <td className={tdCls}>{fmtDate(t.date)}</td>
                <td className={tdCls}>{fmtTime(t.date)}</td>
                <td className={tdCls}>
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md border">
                    <FileText size={12} />
                    {t.refType === 'sale'
                      ? 'فاتورة بيع'
                      : t.refType === 'purchase'
                      ? 'عملية شراء'
                      : t.refType === 'expense'
                      ? 'مصروفات'
                      : 'حركة يدوية'}
                  </span>
                </td>
                <td className={`${tdCls} text-end`}>
                  {/* Only a manual entry (no refType, entered directly from
                      this page) can be deleted from here — a sale/purchase/
                      expense/payment-linked row must be deleted through its
                      OWN record instead, so the two always stay in sync
                      (see deleteCashTransaction's docstring). */}
                  {(!t.refType || t.refType === 'manual') && (
                    <button
                      onClick={() => setDeleteTarget(t)}
                      className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10 transition-colors"
                      title="حذف الحركة (تسجيل غلط)"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && rows.length === 0 && <Empty text="لا توجد حركات مطابقة في الخزينة" />}
        <Pagination page={page} totalPages={pagination?.totalPages} total={pagination?.total} onChange={setPage} />
      </div>

      {/* مودال إيداع/سحب مبلغ */}
      <Modal
        open={!!modal}
        onClose={() => { if (!submitting) setModal(null); }}
        title={modal === 'in' ? 'إيداع مبلغ في الصندوق' : 'سحب مبلغ من الصندوق'}
      >
        <div className="grid gap-3 pt-2">
          <Field label="المبلغ">
            <input
              type="number"
              min="0"
              placeholder="0.00"
              className={inp}
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </Field>
          <Field label="السبب">
            <input
              className={inp}
              placeholder={modal === 'in' ? 'مثال: رأس مال إضافي، توريد نقدية' : 'مثال: مسحوبات شخصية، نثريات'}
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
            />
          </Field>
          <Field label="التاريخ">
            <input
              type="date"
              className={inp}
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </Field>
          <Field label="ملاحظات (اختياري)">
            <input
              className={inp}
              placeholder="أي تفاصيل إضافية..."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>

          <div className="flex gap-2 pt-2">
            {modal === 'out' ? (
              <button
                className={btnDanger}
                disabled={submitting}
                onClick={() => {
                  if (handleValidationAndSubmit()) setConfirmWithdraw(true);
                }}
              >
                تأكيد السحب
              </button>
            ) : (
              <button
                className={btn}
                disabled={submitting}
                onClick={() => {
                  if (handleValidationAndSubmit()) submit();
                }}
              >
                {submitting && <Loader2 size={15} className="animate-spin" />} حفظ الإيداع
              </button>
            )}
            <button className={btnOutline} onClick={() => setModal(null)} disabled={submitting}>
              إلغاء
            </button>
          </div>
        </div>
      </Modal>

      {/* تأكيد السحب */}
      <Confirm
        open={confirmWithdraw}
        onClose={() => setConfirmWithdraw(false)}
        title="تأكيد سحب مبلغ"
        description={`سيتم سحب مبلغ ${fmtMoney(Number(form.amount) || 0)} من الصندوق بداعي (${form.reason}). هل أنت متأكد؟`}
        onConfirm={submit}
      />

      <Confirm
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="حذف حركة خزينة"
        description={`سيتم حذف حركة "${deleteTarget?.reason || ''}" بقيمة ${fmtMoney(deleteTarget?.amount || 0)} وتحديث رصيد الصندوق تبعًا لذلك. هل أنت متأكد؟`}
        onConfirm={handleDelete}
      />
    </div>
  );
}

export default CashboxPage;