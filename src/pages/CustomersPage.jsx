import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { toast } from 'sonner';
import { Search, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { fmtMoney, fmtDate } from '@/lib/formatters';
import { Empty } from '@/components/shop/Empty';
import { Confirm } from '@/components/shop/Confirm';
import { PersonForm } from '@/components/shop/PersonForm';
import { Pagination } from '@/components/shop/Pagination';
import { useDebounce } from '@/hooks/useDebounce';
import { useApiList } from '@/hooks/useApiList';
import * as customersApi from '@/services/api/customers';
import { inp, btn, thCls, tdCls } from '@/components/shop/styles';

export function CustomersPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(params.get('add') === '1');
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  // Searches by customer name and phone — the identifiers actually present on the customer record.
  const debouncedSearch = useDebounce(search);

  useEffect(() => setPage(1), [debouncedSearch]);

  const { items: rows, pagination, loading, error, reload } = useApiList(
    customersApi.listCustomers,
    { page, limit: 20, search: debouncedSearch },
  );

  useEffect(() => {
    if (error) toast.error(error.message || 'تعذر تحميل قائمة العملاء');
  }, [error]);

  const handleSubmit = async (formData) => {
    setSaving(true);
    try {
      const payload = { name: formData.name, phone: formData.phone, address: formData.address };
      if (editing) {
        await customersApi.updateCustomer(editing._id, payload);
        toast.success('تم تحديث بيانات العميل بنجاح');
      } else {
        const createPayload = formData.openingBalance ? { ...payload, openingBalance: formData.openingBalance } : payload;
        try {
          await customersApi.createCustomer(createPayload);
        } catch (err) {
          if (err.details?.code === 'POSSIBLE_DUPLICATE') {
            const names = err.details.matches.map((m) => `${m.name}${m.phone ? ` (${m.phone})` : ''}`).join('، ');
            const proceed = window.confirm(`فيه عميل موجود بالفعل بنفس الاسم أو رقم الهاتف: ${names}. متأكد عايز تضيف عميل جديد منفصل؟`);
            if (!proceed) { setSaving(false); return; }
            await customersApi.createCustomer({ ...createPayload, allowDuplicate: true });
          } else {
            throw err;
          }
        }
        toast.success('تمت إضافة العميل بنجاح');
      }
      setFormOpen(false);
      setParams({});
      reload();
    } catch (err) {
      toast.error(err.message || 'تعذر حفظ بيانات العميل');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await customersApi.deleteCustomer(deleteTarget._id);
      toast.success('تم حذف العميل بنجاح');
      setDeleteTarget(null);
      reload();
    } catch (err) {
      toast.error(err.message || 'تعذر حذف العميل');
    }
  };

  return (
    <div className="grid gap-4">
      <Helmet><title>العملاء — نظام إدارة المحل</title><meta name="description" content="إدارة العملاء وأرصدتهم" /></Helmet>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 rounded-lg border border-border bg-card p-3">
        <div className="relative min-w-48 flex-1">
          <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input className={`${inp} ps-9`} placeholder="بحث بالاسم أو الهاتف..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button className={btn} onClick={() => { setEditing(null); setFormOpen(true); }}><Plus size={15} /> إضافة عميل</button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className={thCls}>الاسم</th>
              <th className={thCls}>الهاتف</th>
              <th className={thCls}>إجمالي المشتريات</th>
              <th className={thCls}>المدفوع</th>
              <th className={thCls}>المتبقي</th>
              <th className={thCls}>آخر شراء</th>
              <th className={thCls}>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 && (
              <tr><td colSpan={7} className="py-14 text-center text-muted-foreground"><Loader2 size={20} className="mx-auto mb-2 animate-spin" />جارِ تحميل العملاء...</td></tr>
            )}
            {rows.map((c) => {
              const t = c.totals || {};
              return (
                <tr key={c._id} className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/30" onClick={() => navigate(`/customers/${c._id}`)}>
                  <td className={`${tdCls} font-semibold`}>{c.name}</td>
                  <td className={`${tdCls} text-muted-foreground`}>{c.phone || '—'}</td>
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
                      <button onClick={() => { setEditing(c); setFormOpen(true); }} className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => setDeleteTarget(c)} className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-red-50 hover:text-destructive">
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
            text="لا يوجد عملاء مطابقون"
            {...(pagination?.total === 0 && !debouncedSearch ? { actionLabel: 'إضافة أول عميل', onAction: () => { setEditing(null); setFormOpen(true); } } : {})}
          />
        )}
        <Pagination page={page} totalPages={pagination?.totalPages} total={pagination?.total} onChange={setPage} />
      </div>

      {formOpen && (
        <PersonForm
          title={editing ? 'تعديل عميل' : 'إضافة عميل جديد'}
          initial={editing}
          personType="customer"
          onClose={() => { if (!saving) { setFormOpen(false); setParams({}); } }}
          onSubmit={handleSubmit}
        />
      )}

      <Confirm
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="حذف عميل"
        description={`هل أنت متأكد من حذف العميل "${deleteTarget ? deleteTarget.name : ''}"؟`}
        onConfirm={handleDelete}
      />
    </div>
  );
}

export default CustomersPage;