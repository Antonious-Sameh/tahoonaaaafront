import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { toast } from 'sonner';
import { Search, FileDown, Plus, Eye, Pencil, Trash2, Loader2 } from 'lucide-react';
import { fmtMoney } from '@/lib/formatters';
import { Field } from '@/components/shop/Field';
import { Empty } from '@/components/shop/Empty';
import { Badge } from '@/components/shop/Badge';
import { Modal } from '@/components/shop/Modal';
import { Confirm } from '@/components/shop/Confirm';
import { Pagination } from '@/components/shop/Pagination';
import { ProductImage } from '@/components/shop/ProductImage';
import { ProductImagePicker } from '@/components/shop/ProductImagePicker';
import { useDebounce } from '@/hooks/useDebounce';
import { useApiList } from '@/hooks/useApiList';
import * as productsApi from '@/services/api/products';
import * as settingsApi from '@/services/api/settings';
import { inp, btn, btnOutline, thCls, tdCls } from '@/components/shop/styles';

const emptyProduct = {
  name: '',
  code: '',
  purchasePrice: '',
  salePrice: '',
  quantity: '',
  minQuantity: '5',
  notes: '',
  image: '',
};

export function InventoryPage() {
  const [params, setParams] = useSearchParams();

  const [search, setSearch] = useState(params.get('search') || '');
  const [filter, setFilter] = useState(params.get('filter') || 'all');
  const [sort, setSort] = useState('name');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(params.get('add') === '1');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyProduct);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [details, setDetails] = useState(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  // Settings.lowStockThreshold — used ONLY as the pre-filled default for a
  // brand-new product's own minQuantity below (see openAdd). It was
  // previously stored/editable in Settings but never actually read
  // anywhere, so changing it had zero effect anywhere in the system; this
  // is what makes it do something again, without changing how an existing
  // product's own minQuantity (which always wins once set) is used.
  const [defaultMinQuantity, setDefaultMinQuantity] = useState(5);

  useEffect(() => {
    settingsApi.getSettings()
      .then((res) => {
        const v = Number(res?.data?.lowStockThreshold);
        if (Number.isFinite(v)) setDefaultMinQuantity(v);
      })
      .catch(() => {}); // keep the safe fallback of 5 on any failure
  }, []);

  const debouncedSearch = useDebounce(search, 300);

  // تحديث الـ URL Params مع تغيير البحث أو التصفية
  useEffect(() => {
    const newParams = new URLSearchParams(params);
    if (debouncedSearch) newParams.set('search', debouncedSearch);
    else newParams.delete('search');

    if (filter !== 'all') newParams.set('filter', filter);
    else newParams.delete('filter');

    setParams(newParams, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, filter]);

  // العودة لأول صفحة عند تغيير البحث أو الفلتر أو الترتيب
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filter, sort]);

  const listParams = { page, limit: 20, search: debouncedSearch, filter, sort };
  const { items: rows, pagination, loading, error, reload } = useApiList(productsApi.listProducts, listParams);

  useEffect(() => {
    if (error) toast.error(error.message || 'تعذر تحميل المخزون');
  }, [error]);

  const openAdd = () => {
    setEditing(null);
    setForm({ ...emptyProduct, minQuantity: String(defaultMinQuantity) });
    setFormOpen(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({ ...emptyProduct, ...p });
    setFormOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('يرجى إدخال اسم المنتج');
      return;
    }

    const payload = {
      name: form.name,
      code: form.code,
      notes: form.notes,
      image: form.image,
      purchasePrice: Math.max(0, Number(form.purchasePrice) || 0),
      salePrice: Math.max(0, Number(form.salePrice) || 0),
      quantity: Math.max(0, Number(form.quantity) || 0),
      minQuantity: Math.max(0, Number(form.minQuantity) || 0),
    };

    setSaving(true);
    try {
      if (editing) {
        await productsApi.updateProduct(editing._id, payload);
        toast.success('تم تعديل المنتج بنجاح');
      } else {
        await productsApi.createProduct(payload);
        toast.success('تمت إضافة المنتج بنجاح');
      }
      setFormOpen(false);
      setParams({});
      reload();
    } catch (err) {
      toast.error(err.message || 'تعذر حفظ المنتج');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await productsApi.deleteProduct(deleteTarget._id);
      if (res?.hidden) {
        toast.success('المنتج له فواتير سابقة، فتم إخفاؤه بدل حذفه نهائياً — تقدر تلاقيه من فلتر "مخفي" وتستعيده وقت ما تحتاج');
      } else {
        toast.success('تم حذف المنتج بنجاح');
      }
      setDeleteTarget(null);
      reload();
    } catch (err) {
      toast.error(err.message || 'تعذر حذف المنتج');
    }
  };

  const handleRestore = async (product) => {
    try {
      await productsApi.restoreProduct(product._id);
      toast.success('تم استعادة المنتج، وهيظهر تاني في المخزون والبيع والشراء');
      reload();
    } catch (err) {
      toast.error(err.message || 'تعذر استعادة المنتج');
    }
  };

  // يجلب كل الصفحات المطابقة للفلتر الحالي (لا يقتصر على الصفحة المعروضة
  // فقط) — حتى حد أقصى آمن يغطي حجم المحلات المستهدفة من هذا النظام.
  const exportCsv = async () => {
    setExporting(true);
    try {
      const EXPORT_PAGE_SIZE = 100;
      const EXPORT_MAX_PAGES = 10;
      let all = [];
      for (let p = 1; p <= EXPORT_MAX_PAGES; p += 1) {
        // eslint-disable-next-line no-await-in-loop
        const res = await productsApi.listProducts({ page: p, limit: EXPORT_PAGE_SIZE, search: debouncedSearch, filter, sort });
        all = all.concat(res.data);
        if (!res.pagination || p >= res.pagination.totalPages) break;
      }

      if (all.length === 0) {
        toast.error('لا توجد بيانات للتصدير');
        return;
      }

      const data = [
        ['اسم المنتج', 'كود المنتج', 'الكمية', 'سعر الشراء', 'الإجمالي', 'سعر البيع', 'الحد الأدنى', 'ربح القطعة'],
        ...all.map((p) => [
          `"${p.name || ''}"`,
          `"${p.code || ''}"`,
          p.quantity || 0,
          p.purchasePrice || 0,
          (p.quantity || 0) * (p.purchasePrice || 0),
          p.salePrice || 0,
          p.minQuantity || 0,
          (p.salePrice || 0) - (p.purchasePrice || 0),
        ]),
      ];

      const csvContent = '\uFEFF' + data.map((r) => r.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inventory_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('تم تصدير المخزون بنجاح');
    } catch (err) {
      toast.error(err.message || 'تعذر تصدير المخزون');
    } finally {
      setExporting(false);
    }
  };

  const profit = (Number(form.salePrice) || 0) - (Number(form.purchasePrice) || 0);

  return (
    <div className="grid gap-4">
      <Helmet>
        <title>المخزون — نظام إدارة المحل</title>
        <meta name="description" content="إدارة مخزون قطع الغيار والمنتجات" />
      </Helmet>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 shadow-sm">
        <div className="relative min-w-48 flex-1">
          <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            className={`${inp} ps-9`}
            placeholder="بحث بالاسم أو الكود..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="h-10 rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/20"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">كل المنتجات</option>
          <option value="available">متوفر</option>
          <option value="low">منخفض</option>
          <option value="out">نافذ</option>
          <option value="needsReview">محتاج مراجعة سعر</option>
          <option value="hidden">مخفي (له فواتير سابقة)</option>
        </select>

        <select
          className="h-10 rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/20"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="name">ترتيب: الاسم</option>
          <option value="qtyAsc">الكمية (تصاعدي)</option>
          <option value="qtyDesc">الكمية (تنازلي)</option>
          <option value="profit">الأعلى ربحاً</option>
        </select>

        <button className={btnOutline} onClick={exportCsv} disabled={exporting}>
          {exporting ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />} تصدير
        </button>
        <button className={btn} onClick={openAdd}>
          <Plus size={15} /> إضافة منتج
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full text-start">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className={thCls}>الصورة</th>
              <th className={thCls}>اسم المنتج</th>
              <th className={thCls}>الكود</th>
              <th className={thCls}>الكمية</th>
              <th className={thCls}>سعر الشراء</th>
              <th className={thCls}>الإجمالي</th>
              <th className={thCls}>سعر البيع</th>
              <th className={thCls}>الحد الأدنى</th>
              <th className={thCls}>ربح القطعة</th>
              <th className={thCls}>الحالة</th>
              <th className={thCls}>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 && (
              <tr>
                <td colSpan={11} className="py-14 text-center text-muted-foreground">
                  <Loader2 size={20} className="mx-auto mb-2 animate-spin" />
                  جارِ تحميل المخزون...
                </td>
              </tr>
            )}
            {rows.map((p) => {
              const qty = Number(p.quantity) || 0;
              const min = Number(p.minQuantity) || 0;
              const unitProfit = (Number(p.salePrice) || 0) - (Number(p.purchasePrice) || 0);
              const totalValue = qty * (Number(p.purchasePrice) || 0);

              return (
                <tr key={p._id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className={tdCls}>
                    <ProductImage src={p.image} alt={p.name} size="sm" />
                  </td>
                  <td className={`${tdCls} font-semibold`}>{p.name}</td>
                  <td className={`${tdCls} font-mono text-xs text-muted-foreground`}>{p.code || '—'}</td>
                  <td className={`${tdCls} font-bold font-mono`}>{qty}</td>
                  <td className={`${tdCls} font-mono`}>{fmtMoney(p.purchasePrice)}</td>
                  <td className={`${tdCls} font-mono font-semibold`}>{fmtMoney(totalValue)}</td>
                  <td className={`${tdCls} font-mono`}>{fmtMoney(p.salePrice)}</td>
                  <td className={`${tdCls} font-mono text-muted-foreground`}>{min}</td>
                  <td className={`${tdCls} font-bold font-mono text-emerald-600`}>
                    {fmtMoney(unitProfit)}
                  </td>
                  <td className={tdCls}>
                    {p.isActive === false ? (
                      <Badge tone="slate">مخفي</Badge>
                    ) : qty <= 0 ? (
                      <Badge tone="red">نافذ</Badge>
                    ) : qty <= min ? (
                      <Badge tone="amber">منخفض</Badge>
                    ) : (
                      <Badge tone="green">متوفر</Badge>
                    )}
                  </td>
                  <td className={tdCls}>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setDetails(p)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        title="تفاصيل"
                      >
                        <Eye size={15} />
                      </button>
                      {filter === 'hidden' ? (
                        <button
                          onClick={() => handleRestore(p)}
                          className="flex h-8 items-center justify-center gap-1 rounded-lg px-2 text-xs font-semibold text-emerald-600 transition-colors hover:bg-emerald-50"
                          title="استعادة المنتج"
                        >
                          استعادة
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => openEdit(p)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            title="تعديل"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(p)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                            title="حذف"
                          >
                            <Trash2 size={15} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {!loading && rows.length === 0 && (
          <Empty
            text="لا توجد منتجات مطابقة للبحث"
            {...(pagination?.total === 0 && !debouncedSearch && filter === 'all' ? { actionLabel: 'إضافة أول منتج', onAction: openAdd } : {})}
          />
        )}

        <Pagination page={page} totalPages={pagination?.totalPages} total={pagination?.total} onChange={setPage} />
      </div>

      {/* Modal إضافة وتعديل */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'تعديل بيانات المنتج' : 'إضافة منتج جديد'}>
        <div className="grid gap-3">
          <ProductImagePicker value={form.image} onChange={(image) => setForm({ ...form, image })} />
          <Field label="اسم المنتج *">
            <input
              className={inp}
              placeholder="مثال: زيت موتور 10W40"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="كود المنتج (Barcode / SKU)">
            <input
              className={inp}
              placeholder="مثال: PRD-001"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="سعر الشراء">
              <input
                type="number"
                min="0"
                className={inp}
                value={form.purchasePrice}
                onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })}
              />
            </Field>
            <Field label="سعر البيع">
              <input
                type="number"
                min="0"
                className={inp}
                value={form.salePrice}
                onChange={(e) => setForm({ ...form, salePrice: e.target.value })}
              />
            </Field>
            <Field label="الكمية المتاحة">
              <input
                type="number"
                min="0"
                className={inp}
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
            </Field>
            <Field label="الحد الأدنى (للتنبيه)">
              <input
                type="number"
                min="0"
                className={inp}
                value={form.minQuantity}
                onChange={(e) => setForm({ ...form, minQuantity: e.target.value })}
              />
            </Field>
          </div>
          <Field label="ملاحظات">
            <input
              className={inp}
              placeholder="تفاصيل إضافية..."
              value={form.notes || ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>

          <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-sm font-semibold text-emerald-700">
            <span>ربح القطعة الواحدة:</span>
            <span className="font-mono text-base">{fmtMoney(profit)}</span>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button className={btnOutline} onClick={() => setFormOpen(false)} disabled={saving}>
              إلغاء
            </button>
            <button className={btn} onClick={save} disabled={saving}>
              {saving && <Loader2 size={15} className="animate-spin" />}
              {editing ? 'تحديث البيانات' : 'حفظ المنتج'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal عرض التفاصيل */}
      <Modal open={!!details} onClose={() => setDetails(null)} title="تفاصيل المنتج">
        {details && (
          <div className="grid gap-3 text-sm">
            <div className="flex justify-center pb-2">
              <ProductImage src={details.image} alt={details.name} size="lg" />
            </div>
            {[
              ['اسم المنتج', details.name],
              ['الكود', details.code || '—'],
              ['سعر الشراء', fmtMoney(details.purchasePrice)],
              ['سعر البيع', fmtMoney(details.salePrice)],
              ['الكمية المتاحة', details.quantity || 0],
              ['الحد الأدنى', details.minQuantity || 0],
              ['ربح القطعة', fmtMoney((details.salePrice || 0) - (details.purchasePrice || 0))],
              ['إجمالي قيمة المخزون (شراء)', fmtMoney((details.purchasePrice || 0) * (details.quantity || 0))],
              ['إجمالي قيمة المخزون (بيع)', fmtMoney((details.salePrice || 0) * (details.quantity || 0))],
              ['ملاحظات', details.notes || '—'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-border pb-2 last:border-0">
                <span className="text-muted-foreground">{k}</span>
                <b className="font-mono">{v}</b>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Confirm الحذف */}
      <Confirm
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="حذف منتج من المخزون"
        description={`هل أنت متأكد من حذف المنتج "${deleteTarget?.name || ''}"؟ لو له فواتير بيع أو شراء سابقة، هيتم إخفاؤه فقط (وتقدر تستعيده بعدين من فلتر "مخفي")، ولو مالوش أي فواتير هيتحذف نهائياً.`}
        onConfirm={handleDelete}
      />
    </div>
  );
}

export default InventoryPage;