import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { toast } from 'sonner';
import { Trash2, Search, PackagePlus, Pencil, UserPlus, CheckCircle2, Loader2 } from 'lucide-react';
import { fmtMoney, todayInputValue } from '@/lib/formatters';
import { Field } from '@/components/shop/Field';
import { Empty } from '@/components/shop/Empty';
import { Badge } from '@/components/shop/Badge';
import { ProductImage } from '@/components/shop/ProductImage';
import { QuickAddProductModal } from '@/components/shop/QuickAddProductModal';
import { SearchSelect } from '@/components/shop/SearchSelect';
import { useDebounce } from '@/hooks/useDebounce';
import { useInfiniteList, useInfiniteScrollTrigger } from '@/hooks/useInfiniteList';
import * as suppliersApi from '@/services/api/suppliers';
import * as productsApi from '@/services/api/products';
import * as purchasesApi from '@/services/api/purchases';
import { inp, btn, btnOutline } from '@/components/shop/styles';

// Same reasoning as PosPage.jsx's product/customer pickers: the grid loads
// page by page as it's scrolled (see useInfiniteList) rather than one fixed
// batch, and the supplier picker searches the server as typed rather than
// filtering one fixed batch — so neither one has a hard ceiling on how much
// of the catalog/supplier list is actually reachable here.
const PRODUCT_PAGE_SIZE = 40;
const SUPPLIER_PICKER_LIMIT = 100;

// Keeps exactly what the person typed on screen (so backspace/clearing feels
// natural and the cursor never jumps to the end), while only allowing the
// characters a decimal amount can actually contain — digits and a single
// decimal point. Used for the per-line purchase-price editor and the
// discount field below; the numeric value used in calculations is derived
// separately from this text, so an empty/partial string never gets silently
// coerced into a "0" that overwrites what the person is mid-way through
// typing. (Same helper as PosPage.jsx — duplicated rather than shared to
// keep this change contained to the files that actually need it.)
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

// Purchase quantities are always whole units, and — unlike POS's +/- cart
// stepper — often need to be typed directly (a purchase line is commonly
// dozens or hundreds of units), so this stays a free-text field rather than
// switching to POS's stepper: same "never force to 0 while typing, no
// cursor jump" principle as sanitizeDecimalText, just digits only.
const sanitizeIntegerText = (raw) => String(raw).replace(/[^0-9]/g, '');
const integerTextToNumber = (text) => (text === '' ? 0 : parseInt(text, 10) || 0);

const newIdempotencyKey = () => (
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `pur-${Date.now()}-${Math.random().toString(36).slice(2)}`
);

export function PurchasesPage() {
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [lines, setLines] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: '', phone: '', address: '' });
  const [savingSupplier, setSavingSupplier] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paidInput, setPaidInput] = useState('');
  // Flat (fixed-amount) discount on the purchase total — kept as raw typed
  // text (see sanitizeDecimalText above), never as a pre-rounded number, so
  // the input never fights the person while they're typing or clearing it.
  const [discountText, setDiscountText] = useState('');
  const [date, setDate] = useState(todayInputValue());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const debouncedSearch = useDebounce(search);

  // Loads products page by page as the grid is scrolled (see
  // useInfiniteList) instead of one fixed batch — a shop with more
  // products than that batch could hold previously had products that were
  // simply unreachable by scrolling, findable only by typing a search that
  // matched them exactly.
  const [productsRefreshToken, setProductsRefreshToken] = useState(0);
  const {
    items: products, loading: productsLoading, loadingMore: productsLoadingMore,
    hasMore: productsHasMore, error: productsError, loadMore: loadMoreProducts,
  } = useInfiniteList(productsApi.listProducts, { search: debouncedSearch, _refresh: productsRefreshToken }, PRODUCT_PAGE_SIZE);
  const productsSentinelRef = useInfiniteScrollTrigger(loadMoreProducts, {
    hasMore: productsHasMore, loading: productsLoading, loadingMore: productsLoadingMore,
  });

  useEffect(() => {
    if (productsError) toast.error(productsError.message || 'تعذر تحميل المنتجات');
  }, [productsError]);

  const debouncedSupplierSearch = useDebounce(supplierSearch);
  // Read inside the search effect without being a dependency of it — a
  // supplier selection alone must never re-trigger a network search, only
  // the typed query should (see the effect below). Same pattern as
  // PosPage.jsx's customer picker.
  const supplierIdRef = useRef(supplierId);
  supplierIdRef.current = supplierId;

  useEffect(() => {
    let cancelled = false;
    setSuppliersLoading(true);
    suppliersApi.listSuppliers({ search: debouncedSupplierSearch, limit: SUPPLIER_PICKER_LIMIT })
      .then((res) => {
        if (cancelled) return;
        setSuppliers((prev) => {
          const id = supplierIdRef.current;
          if (!id || res.data.some((s) => s._id === id)) return res.data;
          const stillSelected = prev.find((s) => s._id === id);
          return stillSelected ? [stillSelected, ...res.data] : res.data;
        });
      })
      .catch((err) => { if (!cancelled) toast.error(err.message || 'تعذر تحميل الموردين'); })
      .finally(() => { if (!cancelled) setSuppliersLoading(false); });
    return () => { cancelled = true; };
  }, [debouncedSupplierSearch]);

  useEffect(() => {
    const handler = (e) => { if (lines.length > 0) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [lines.length]);

  // Sum of the lines (price*quantity) BEFORE the discount — product prices
  // themselves are never touched by the discount, only this purchase's own
  // total is. `discount` is clamped here ONLY for what's displayed/sent as
  // the running total preview, never on the input's own text (see below),
  // so the field itself always shows exactly what was typed.
  const subtotal = lines.reduce((s, l) => s + (Number(l.price) || 0) * (Number(l.quantity) || 0), 0);
  const discount = decimalTextToNumber(discountText);
  const discountExceedsSubtotal = discount > subtotal;
  const total = Math.max(0, subtotal - Math.min(discount, subtotal));
  const paid = paymentMethod === 'cash' ? total : Math.min(total, Number(paidInput) || 0);
  const remaining = Math.max(0, total - paid);

  const addLine = (p) => {
    if (lines.some((l) => l.productId === p._id)) {
      setLines((prev) => prev.map((l) => (l.productId === p._id ? { ...l, quantity: l.quantity + 1, quantityText: String(l.quantity + 1) } : l)));
      return;
    }
    setLines((prev) => [
      ...prev,
      {
        productId: p._id,
        name: p.name,
        code: p.code,
        price: p.purchasePrice || 0,
        priceText: String(p.purchasePrice || 0),
        quantity: 1,
        quantityText: '1',
      },
    ]);
  };

  // Editable purchase quantity per line — free-text (see
  // sanitizeIntegerText above for why, unlike POS's cart stepper).
  const updateQuantity = (id, raw) => {
    const text = sanitizeIntegerText(raw);
    setLines((prev) => prev.map((l) => (
      l.productId === id ? { ...l, quantity: integerTextToNumber(text), quantityText: text } : l
    )));
  };

  // Editable purchase price per line — keeps the raw typed text (priceText)
  // as the input's source of truth and derives the numeric price used in
  // totals separately, so clearing/retyping the field feels natural instead
  // of being forced back to "0" on every keystroke.
  const updatePrice = (id, raw) => {
    const text = sanitizeDecimalText(raw);
    setLines((prev) => prev.map((l) => (
      l.productId === id ? { ...l, price: decimalTextToNumber(text), priceText: text } : l
    )));
  };
  const removeLine = (id) => setLines((prev) => prev.filter((l) => l.productId !== id));

  // Product created on the fly from within the purchase screen: add it
  // straight to the lines using the real document the API just returned,
  // and refresh the grid in the background so it also appears there.
  const handleProductCreated = (product) => {
    addLine(product);
    setSearch('');
    setProductsRefreshToken((t) => t + 1);
  };

  const saveNewSupplier = async () => {
    if (!newSupplier.name.trim()) { toast.error('يرجى إدخال اسم المورد'); return; }
    setSavingSupplier(true);
    try {
      let res;
      try {
        res = await suppliersApi.createSupplier(newSupplier);
      } catch (err) {
        if (err.details?.code === 'POSSIBLE_DUPLICATE') {
          const names = err.details.matches.map((m) => `${m.name}${m.phone ? ` (${m.phone})` : ''}`).join('، ');
          const proceed = window.confirm(`فيه مورد موجود بالفعل بنفس الاسم أو رقم الهاتف: ${names}. متأكد عايز تضيف مورد جديد منفصل؟`);
          if (!proceed) { setSavingSupplier(false); return; }
          res = await suppliersApi.createSupplier({ ...newSupplier, allowDuplicate: true });
        } else {
          throw err;
        }
      }
      setSuppliers((prev) => [res.data, ...prev]);
      setSupplierId(res.data._id);
      setShowNewSupplier(false);
      setNewSupplier({ name: '', phone: '', address: '' });
      toast.success('تمت إضافة المورد بنجاح');
    } catch (err) {
      toast.error(err.message || 'تعذر إضافة المورد');
    } finally {
      setSavingSupplier(false);
    }
  };

  const save = async () => {
    if (!supplierId) { toast.error('يرجى اختيار المورد أولاً'); return; }
    if (lines.length === 0) { toast.error('يرجى إضافة منتج واحد على الأقل للعملية'); return; }
    if (discount < 0) { toast.error('قيمة الخصم غير صحيحة'); return; }
    if (discountExceedsSubtotal) { toast.error('الخصم أكبر من إجمالي العملية'); return; }

    setSaving(true);
    try {
      const res = await purchasesApi.createPurchase({
        supplierId,
        paymentMethod,
        paid,
        date,
        notes,
        discount,
        items: lines.map((l) => ({
          productId: l.productId,
          quantity: Number(l.quantity),
          price: Number(l.price),
        })),
      });
      toast.success('تم تسجيل عملية الشراء بنجاح');
      if (res.data?.priceWarnings?.length) {
        res.data.priceWarnings.forEach((w) => {
          toast.warning(
            `سعر شراء "${w.name}" بقى ${fmtMoney(w.purchasePrice)}، وده أعلى من أو يساوي سعر بيعه الحالي (${fmtMoney(w.salePrice)}) — يُنصح بمراجعة سعر البيع`,
            { duration: 8000 },
          );
        });
      }
      setLines([]);
      setSupplierId('');
      setPaidInput('');
      setNotes('');
      setDate(todayInputValue());
      setPaymentMethod('cash');
      setDiscountText('');
      navigate('/purchases/history');
    } catch (err) {
      toast.error(err.message || 'تعذر تسجيل عملية الشراء');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
      <Helmet>
        <title>عملية شراء جديدة — نظام إدارة المحل</title>
        <meta name="description" content="تسجيل فاتورة شراء جديدة من مورد" />
      </Helmet>

      {/* Purchase panel — same shape as PosPage.jsx's cart panel: supplier
          picker, then the lines, then payment + save. */}
      <div className="flex flex-col rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">عملية الشراء الحالية</h3>
        </div>

        {/* Supplier selection */}
        <div className="border-b border-border p-4">
          <Field label="المورد">
            <SearchSelect
              value={supplierId}
              onChange={setSupplierId}
              options={suppliers.map((s) => ({ id: s._id, label: s.name, sublabel: s.phone }))}
              placeholder="اختر المورد..."
              searchPlaceholder="ابحث بالاسم أو الهاتف..."
              emptyText="لا يوجد موردون مطابقون"
              onQueryChange={setSupplierSearch}
              searching={suppliersLoading}
            />
          </Field>
          {!showNewSupplier ? (
            <button onClick={() => setShowNewSupplier(true)} className="mt-2 flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
              <UserPlus size={13} /> إضافة مورد جديد
            </button>
          ) : (
            <div className="mt-3 grid gap-2 rounded-md border border-border bg-muted/30 p-3">
              <input className={inp} placeholder="الاسم" value={newSupplier.name} onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })} />
              <input className={inp} placeholder="الهاتف" value={newSupplier.phone} onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })} />
              <input className={inp} placeholder="العنوان" value={newSupplier.address} onChange={(e) => setNewSupplier({ ...newSupplier, address: e.target.value })} />
              <div className="flex gap-2">
                <button className={btn} onClick={saveNewSupplier} disabled={savingSupplier}>
                  {savingSupplier && <Loader2 size={14} className="animate-spin" />} حفظ المورد
                </button>
                <button className={btnOutline} onClick={() => setShowNewSupplier(false)} disabled={savingSupplier}>إلغاء</button>
              </div>
            </div>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Field label="تاريخ العملية">
              <input type="date" className={`${inp} text-sm`} value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="ملاحظات">
              <input className={`${inp} text-sm`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="اختياري" />
            </Field>
          </div>
        </div>

        {/* Purchase lines */}
        <div className="max-h-72 flex-1 overflow-y-auto p-4">
          {lines.length === 0 ? <Empty text="لم تتم إضافة أية منتجات بعد — اختر منتجات من القائمة" /> : (
            <div className="grid gap-2">
              {lines.map((l) => (
                <div key={l.productId} className="flex items-center gap-2 rounded-md border border-border bg-background p-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">{l.name}</div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <Pencil size={10} className="shrink-0 text-muted-foreground/60" />
                      <input
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        title="سعر الشراء لهذه العملية"
                        className="h-6 w-20 rounded border border-border bg-card px-1.5 text-xs font-mono outline-none transition-shadow focus:border-ring focus:ring-2 focus:ring-ring/20"
                        value={l.priceText ?? String(l.price)}
                        onChange={(e) => updatePrice(l.productId, e.target.value)}
                      />
                      <span className="text-[10px] text-muted-foreground">/ قطعة</span>
                    </div>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    title="الكمية"
                    className="h-8 w-16 rounded border border-border bg-card px-1.5 text-center text-sm font-bold font-mono outline-none transition-shadow focus:border-ring focus:ring-2 focus:ring-ring/20"
                    value={l.quantityText ?? String(l.quantity)}
                    onChange={(e) => updateQuantity(l.productId, e.target.value)}
                  />
                  <div className="w-20 text-end text-sm font-bold text-foreground">
                    {fmtMoney((Number(l.price) || 0) * (Number(l.quantity) || 0))}
                  </div>
                  <button onClick={() => removeLine(l.productId)} className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-red-50 hover:text-destructive">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payment */}
        <div className="grid gap-3 border-t border-border p-4">
          <div className="flex gap-2">
            <button
              onClick={() => { setPaymentMethod('cash'); setPaidInput(''); }}
              className={`flex-1 rounded-md border py-2 text-sm font-semibold transition-colors ${paymentMethod === 'cash' ? 'border-primary bg-primary text-primary-foreground' : 'border-input hover:bg-muted'}`}
            >
              نقدي
            </button>
            <button
              onClick={() => setPaymentMethod('credit')}
              className={`flex-1 rounded-md border py-2 text-sm font-semibold transition-colors ${paymentMethod === 'credit' ? 'border-primary bg-primary text-primary-foreground' : 'border-input hover:bg-muted'}`}
            >
              آجل / جزئي
            </button>
          </div>

          {paymentMethod === 'credit' && (
            <Field label="المبلغ المدفوع حاصلاً">
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                className={inp}
                value={paidInput}
                onChange={(e) => setPaidInput(sanitizeDecimalText(e.target.value))}
                placeholder="0"
              />
            </Field>
          )}

          <Field label="الخصم (مبلغ ثابت على إجمالي العملية)">
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              className={inp}
              value={discountText}
              onChange={(e) => setDiscountText(sanitizeDecimalText(e.target.value))}
              placeholder="0"
            />
            {discountExceedsSubtotal && (
              <p className="mt-1 text-xs font-semibold text-destructive">الخصم أكبر من إجمالي العملية</p>
            )}
          </Field>

          <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
            {discount > 0 ? (
              <>
                <div className="flex justify-between py-0.5">
                  <span className="text-muted-foreground">إجمالي المنتجات</span>
                  <b>{fmtMoney(subtotal)}</b>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-muted-foreground">الخصم</span>
                  <b className="text-destructive">- {fmtMoney(Math.min(discount, subtotal))}</b>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-muted-foreground">الإجمالي النهائي</span>
                  <b className="text-base text-primary">{fmtMoney(total)}</b>
                </div>
              </>
            ) : (
              <div className="flex justify-between py-0.5">
                <span className="text-muted-foreground">الإجمالي</span>
                <b className="text-base text-primary">{fmtMoney(total)}</b>
              </div>
            )}
            <div className="flex justify-between py-0.5">
              <span className="text-muted-foreground">المدفوع</span>
              <b>{fmtMoney(paid)}</b>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-muted-foreground">المتبقي (دين للمورد)</span>
              <b className={remaining > 0 ? 'text-destructive' : ''}>{fmtMoney(remaining)}</b>
            </div>
          </div>

          <button
            onClick={save}
            disabled={lines.length === 0 || saving || discountExceedsSubtotal}
            className={`${btn} h-11 w-full text-base gap-2`}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} حفظ عملية الشراء
          </button>
        </div>
      </div>

      {/* Products grid — same shape/behavior as PosPage.jsx's, including the
          scroll-to-load-more grid (see useInfiniteList). */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-4 flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input className={`${inp} ps-9`} placeholder="ابحث بالاسم أو الكود..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button className={`${btnOutline} shrink-0`} onClick={() => setShowAddProduct(true)} title="إضافة منتج جديد">
            <PackagePlus size={16} /> <span className="hidden sm:inline">منتج جديد</span>
          </button>
        </div>
        {productsLoading && products.length === 0 ? (
          <div className="py-14 text-center text-muted-foreground"><Loader2 size={20} className="mx-auto mb-2 animate-spin" />جارِ تحميل المنتجات...</div>
        ) : products.length === 0 ? (
          <Empty
            text="لا توجد منتجات مطابقة"
            actionLabel="إضافة هذا المنتج الآن"
            onAction={() => setShowAddProduct(true)}
          />
        ) : (
          <div className="max-h-[calc(100vh-260px)] overflow-y-auto pe-1">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {products.map((p) => {
                const inLines = lines.find((l) => l.productId === p._id);
                return (
                  <button
                    key={p._id}
                    onClick={() => addLine(p)}
                    className={`rounded-md border p-3 text-start transition-colors hover:border-primary/40 hover:bg-accent active:scale-[0.98] ${inLines ? 'border-primary/50 bg-primary/5' : 'border-border bg-card'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <ProductImage src={p.image} alt={p.name} size="sm" />
                      {inLines ? <Badge tone="blue">× {inLines.quantity}</Badge> : (
                        p.quantity <= p.minQuantity ? <Badge tone="amber">{p.quantity}</Badge> : <Badge tone="green">{p.quantity}</Badge>
                      )}
                    </div>
                    <div className="mt-2 text-sm font-medium leading-tight text-foreground">{p.name}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{p.code}</div>
                    <div className="mt-2 text-sm font-bold text-primary">{fmtMoney(p.purchasePrice || 0)}</div>
                  </button>
                );
              })}
            </div>
            {productsHasMore && (
              <div ref={productsSentinelRef} className="flex justify-center py-4">
                {productsLoadingMore && <Loader2 size={18} className="animate-spin text-muted-foreground" />}
              </div>
            )}
          </div>
        )}
      </div>

      <QuickAddProductModal
        open={showAddProduct}
        onClose={() => setShowAddProduct(false)}
        onCreated={handleProductCreated}
        initialName={search}
        lockQuantityToZero
      />
    </div>
  );
}

export default PurchasesPage;