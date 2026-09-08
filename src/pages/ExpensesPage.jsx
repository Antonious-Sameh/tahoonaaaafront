import { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { toast } from 'sonner';
import { Plus, Trash2, Receipt, Calendar, CreditCard, Loader2 } from 'lucide-react';
import { fmtMoney, fmtDate, todayInputValue, EXPENSE_SUGGESTIONS } from '@/lib/formatters';
import { Field } from '@/components/shop/Field';
import { Empty } from '@/components/shop/Empty';
import { Badge } from '@/components/shop/Badge';
import { Stat } from '@/components/shop/Stat';
import { Confirm } from '@/components/shop/Confirm';
import { Pagination } from '@/components/shop/Pagination';
import { useApiList } from '@/hooks/useApiList';
import * as expensesApi from '@/services/api/expenses';
import { inp, btn, btnDanger, thCls, tdCls } from '@/components/shop/styles';

export function ExpensesPage() {
  const [form, setForm] = useState({ reason: '', amount: '', date: todayInputValue(), notes: '' });
  const [saving, setSaving] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [summary, setSummary] = useState(null);

  // The full list of reasons ever used can't be derived from a single
  // (paginated) page anymore — the filter/datalist uses the static
  // suggestions only now. See FRONTEND_INTEGRATION.md for the trade-off.
  const reasons = EXPENSE_SUGGESTIONS;

  useEffect(() => setPage(1), [typeFilter, from, to]);

  const reloadSummary = useCallback(() => {
    expensesApi.getExpensesSummary()
      .then((res) => setSummary(res.data))
      .catch(() => { /* stat cards are a nice-to-have; a failure here shouldn't block the page */ });
  }, []);

  useEffect(() => { reloadSummary(); }, [reloadSummary]);

  const { items: rows, pagination, extra, loading, error, reload } = useApiList(expensesApi.listExpenses, {
    page, limit: 20, reason: typeFilter, from, to,
  });

  useEffect(() => {
    if (error) toast.error(error.message || 'تعذر تحميل المصروفات');
  }, [error]);

  const filteredTotal = extra?.totalAmount || 0;

  const save = async () => {
    if (!form.reason.trim()) {
      toast.error('من فضلك اذكر سبب المصروف');
      return;
    }
    if (!form.amount || Number(form.amount) <= 0) {
      toast.error('من فضلك أدخل مبلغاً صحيحاً');
      return;
    }

    setSaving(true);
    try {
      await expensesApi.createExpense({ ...form, amount: Number(form.amount) });
      toast.success('تم تسجيل المصروف وخسمه من الصندوق بنجاح');
      setForm({ reason: '', amount: '', date: todayInputValue(), notes: '' });
      reload();
      reloadSummary();
    } catch (err) {
      toast.error(err.message || 'تعذر تسجيل المصروف');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await expensesApi.deleteExpense(deleteTarget._id);
      toast.success('تم حذف المصروف وإعادة المبلغ للصندوق');
      setDeleteTarget(null);
      reload();
      reloadSummary();
    } catch (err) {
      toast.error(err.message || 'تعذر حذف المصروف');
    }
  };

  return (
    <div className="grid gap-4">
      <Helmet>
        <title>المصروفات — نظام إدارة المحل</title>
        <meta name="description" content="إدارة مصروفات المحل النثرية والتشغيلية" />
      </Helmet>

      {/* الإحصائيات السريعة */}
      <div className="grid gap-3 md:grid-cols-3">
        <Stat
          title="مصروفات اليوم"
          value={summary ? fmtMoney(summary.todayTotal) : '—'}
          icon={Receipt}
          tone="bg-amber-500/10 text-amber-600 border-amber-200/50"
        />
        <Stat
          title="مصروفات هذا الشهر"
          value={summary ? fmtMoney(summary.monthTotal) : '—'}
          icon={Calendar}
          tone="bg-red-500/10 text-red-600 border-red-200/50"
        />
        <Stat
          title="إجمالي النتيجة الحالية"
          value={fmtMoney(filteredTotal)}
          icon={CreditCard}
          tone="bg-slate-500/10 text-slate-700 border-slate-200/50"
        />
      </div>

      {/* نموذج إضافة مصروف جديد */}
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">تسجيل مصروف جديد</h3>
        <div className="grid gap-3 md:grid-cols-5">
          <Field label="سبب المصروف">
            <input
              className={inp}
              list="expense-reasons"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="اختر أو اكتب سبباً"
            />
            <datalist id="expense-reasons">
              {reasons.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </Field>
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
              placeholder="تفاضيل إضافية..."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
          <div className="flex items-end">
            <button className={`${btn} w-full gap-1.5`} onClick={save} disabled={saving}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} تسجيل المصروف
            </button>
          </div>
        </div>
      </div>

      {/* شريط الفلترة والبحث */}
      <div className="flex flex-col gap-2 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <select className={`${inp} w-full sm:w-44`} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">كل الأنواع</option>
            {reasons.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">من:</span>
            <input type="date" className={`${inp} w-auto`} value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">إلى:</span>
            <input type="date" className={`${inp} w-auto`} value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <div className="text-end text-sm font-bold sm:ps-4 border-t sm:border-t-0 pt-2 sm:pt-0">
          المجموع: <span className="text-destructive font-mono">{fmtMoney(filteredTotal)}</span>
        </div>
      </div>

      {/* جدول المصروفات */}
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-start">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className={thCls}>السبب</th>
              <th className={thCls}>المبلغ</th>
              <th className={thCls}>التاريخ</th>
              <th className={thCls}>ملاحظات</th>
              <th className={`${thCls} text-end`}>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 && (
              <tr><td colSpan={5} className="py-14 text-center text-muted-foreground"><Loader2 size={20} className="mx-auto mb-2 animate-spin" />جارِ تحميل المصروفات...</td></tr>
            )}
            {rows.map((e) => (
              <tr key={e._id} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                <td className={tdCls}>
                  <Badge tone="slate">{e.reason}</Badge>
                </td>
                <td className={`${tdCls} font-bold font-mono text-destructive`}>
                  {fmtMoney(e.amount)}
                </td>
                <td className={tdCls}>{fmtDate(e.date)}</td>
                <td className={tdCls}>{e.notes || '—'}</td>
                <td className={`${tdCls} text-end`}>
                  <button
                    onClick={() => setDeleteTarget(e)}
                    className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10 transition-colors"
                    title="حذف المصروف"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && rows.length === 0 && <Empty text="لا توجد مصروفات مطابقة للبحث" />}
        <Pagination page={page} totalPages={pagination?.totalPages} total={pagination?.total} onChange={setPage} />
      </div>

      {/* تأكيد الحذف */}
      <Confirm
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="حذف مصروف"
        description={`سيتم حذف المصروف "${deleteTarget ? deleteTarget.reason : ''}" بقيمة ${fmtMoney(deleteTarget?.amount || 0)} وإعادة المبلغ للصندوق. هل أنت متأكد؟`}
        onConfirm={handleDelete}
      />
    </div>
  );
}

export default ExpensesPage;
