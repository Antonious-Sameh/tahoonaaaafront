import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { toast } from 'sonner';
import { Search, Plus, Pencil, Trash2, Loader2, Truck, Wallet, AlertTriangle } from 'lucide-react';
import { fmtMoney, fmtDate } from '@/lib/formatters';
import { Empty } from '@/components/shop/Empty';
import { Confirm } from '@/components/shop/Confirm';
import { PersonForm } from '@/components/shop/PersonForm';
import { Pagination } from '@/components/shop/Pagination';
import { Stat } from '@/components/shop/Stat';
import { useDebounce } from '@/hooks/useDebounce';
import { useApiList } from '@/hooks/useApiList';
import * as suppliersApi from '@/services/api/suppliers';
import * as reportsApi from '@/services/api/reports';
import { inp, btn, thCls, tdCls } from '@/components/shop/styles';

export function SuppliersPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(params.get('add') === '1');
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState(null);

  const debouncedSearch = useDebounce(search);

  useEffect(() => setPage(1), [debouncedSearch]);

  const { items: rows, pagination, loading, error, reload } = useApiList(
    suppliersApi.listSuppliers,
    { page, limit: 20, search: debouncedSearch },
  );

  // Summary stat cards need all-time totals across EVERY supplier, not just
  // the current page — the reports endpoint (built in the backend's Reports
  // phase) already computes exactly that in one aggregation.
  const reloadSummary = useCallback(() => {
    reportsApi.getSuppliersReport({ limit: 1 })
      .then((res) => setSummary(res.data))
      .catch(() => { /* stat cards are a nice-to-have; a failure here shouldn't block the page */ });
  }, []);

  useEffect(() => { reloadSummary(); }, [reloadSummary]);

  useEffect(() => {
    if (error) toast.error(error.message || 'تعذر تحميل قائمة الموردين');
  }, [error]);

  const handleSubmit = async (formData) => {
    setSaving(true);
    try {
      const payload = { name: formData.name, phone: formData.phone, address: formData.address };
      if (editing) {
        await suppliersApi.updateSupplier(editing._id, payload);
        toast.success('تم تحديث بيانات المورد بنجاح');
      } else {
        await suppliersApi.createSupplier(payload);
        toast.success('تمت إضافة المورد بنجاح');
      }
      setFormOpen(false);
      setParams({});
      reload();
      reloadSummary();
    } catch (err) {
      toast.error(err.message || 'تعذر حفظ بيانات المورد');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await suppliersApi.deleteSupplier(deleteTarget._id);
      toast.success('تم حذف المورد بنجاح');
      setDeleteTarget(null);
      reload();
      reloadSummary();
    } catch (err) {
      toast.error(err.message || 'تعذر حذف المورد');
    }
  };

  return (
    <div className="grid gap-4">
      <Helmet><title>الموردون — نظام إدارة المحل</title><meta name="description" content="إدارة الموردين وأرصدتهم" /></Helmet>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat icon={Truck} title="إجمالي الموردين" value={summary?.count ?? '—'} tone="bg-blue-100 text-blue-700" />
        <Stat icon={Wallet} title="إجمالي المستحق للموردين" value={fmtMoney(summary?.totalOutstanding ?? 0)} tone="bg-amber-100 text-amber-700" />
        <Stat icon={AlertTriangle} title="موردون عليهم مستحقات" value={summary?.withBalanceCount ?? '—'} tone="bg-red-100 text-red-700" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 rounded-lg border border-border bg-card p-3">
        <div className="relative min-w-48 flex-1">
          <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input className={`${inp} ps-9`} placeholder="بحث بالاسم أو الهاتف..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button className={btn} onClick={() => { setEditing(null); setFormOpen(true); }}><Plus size={15} /> إضافة مورد</button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className={thCls}>الاسم</th>
              <th className={thCls}>الهاتف</th>
              <th className={thCls}>إجمالي المشتريات منه</th>
              <th className={thCls}>المدفوع</th>
              <th className={thCls}>المتبقي له</th>
              <th className={thCls}>آخر عملية</th>
              <th className={thCls}>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 && (
              <tr><td colSpan={7} className="py-14 text-center text-muted-foreground"><Loader2 size={20} className="mx-auto mb-2 animate-spin" />جارِ تحميل الموردين...</td></tr>
            )}
            {rows.map((s) => {
              const t = s.totals || {};
              return (
                <tr key={s._id} className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/30" onClick={() => navigate(`/suppliers/${s._id}`)}>
                  <td className={`${tdCls} font-semibold`}>{s.name}</td>
                  <td className={`${tdCls} text-muted-foreground`}>{s.phone || '—'}</td>
                  <td className={tdCls}>{fmtMoney(t.total)}</td>
                  <td className={tdCls}>{fmtMoney(t.paid)}</td>
                  <td className={tdCls}>
                    {t.remaining > 0
                      ? <span className="font-semibold text-destructive">{fmtMoney(t.remaining)}</span>
                      : <span className="text-muted-foreground">—</span>
                    }
                  </td>
                  <td className={`${tdCls} text-muted-foreground`}>{t.lastPurchase ? fmtDate(t.lastPurchase) : '—'}</td>
                  <td className={tdCls} onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditing(s); setFormOpen(true); }} className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => setDeleteTarget(s)} className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-red-50 hover:text-destructive">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && rows.length === 0 && (
          <Empty
            text="لا يوجد موردون مطابقون"
            {...(pagination?.total === 0 && !debouncedSearch ? { actionLabel: 'إضافة أول مورد', onAction: () => { setEditing(null); setFormOpen(true); } } : {})}
          />
        )}
        <Pagination page={page} totalPages={pagination?.totalPages} total={pagination?.total} onChange={setPage} />
      </div>

      {formOpen && (
        <PersonForm
          title={editing ? 'تعديل مورد' : 'إضافة مورد جديد'}
          initial={editing}
          onClose={() => { if (!saving) { setFormOpen(false); setParams({}); } }}
          onSubmit={handleSubmit}
        />
      )}

      <Confirm
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="حذف مورد"
        description={`هل أنت متأكد من حذف المورد "${deleteTarget ? deleteTarget.name : ''}"؟`}
        onConfirm={handleDelete}
      />
    </div>
  );
}

export default SuppliersPage;
