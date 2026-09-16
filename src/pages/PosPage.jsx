import { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { Minus, Plus, Trash2, Printer, Share2, Search, PackagePlus, Pencil, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useSettings } from '@/context/SettingsContext';
import { fmtMoney } from '@/lib/formatters';
import { Field } from '@/components/shop/Field';
import { Empty } from '@/components/shop/Empty';
import { Badge } from '@/components/shop/Badge';
import { Modal } from '@/components/shop/Modal';
import { InvoiceView } from '@/components/shop/InvoiceView';
import { PrintPortal } from '@/components/shop/PrintPortal';
import { ProductImage } from '@/components/shop/ProductImage';
import { QuickAddProductModal } from '@/components/shop/QuickAddProductModal';
import { SearchSelect } from '@/components/shop/SearchSelect';
import { usePrint } from '@/hooks/usePrint';
import { useDebounce } from '@/hooks/useDebounce';
import { useApiList } from '@/hooks/useApiList';
import * as productsApi from '@/services/api/products';
import * as customersApi from '@/services/api/customers';
import * as salesApi from '@/services/api/sales';
import { inp, btn, btnOutline } from '@/components/shop/styles';

// POS is a "search then pick" flow, not a browsable catalog — a generous,
// unpaginated result set covers realistic use without needing pager UI here.
const PRODUCT_PICKER_LIMIT = 40;
// Same reasoning, now also true for the customer picker: it searches the
// server as the person types (see the debounced effect below) rather than
// filtering one fixed batch, so a shop with more than 100 customers can
// still find and select any of them — this cap only bounds one search's
// result page, not how many customers are reachable overall.
const CUSTOMER_PICKER_LIMIT = 100;

// Keeps exactly what the person typed on screen (so backspace/clearing feels
// natural and the cursor never jumps to the end), while only allowing the
// characters a decimal amount can actually contain — digits and a single
// decimal point. Used for both the per-line price editor and the discount
// field below; the numeric value used in calculations is derived separately
// from this text, so an empty/partial string never gets silently coerced
// into a "0" that overwrites what the person is mid-way through typing.
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

export function PosPage() {
  const { settings } = useSettings();
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', address: '' });
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paidInput, setPaidInput] = useState('');
  // Flat (fixed-amount) discount on the invoice total — kept as raw typed
  // text (see sanitizeDecimalText above), never as a pre-rounded number, so
  // the input never fights the person while they're typing or clearing it.
  const [discountText, setDiscountText] = useState('');
  const [invoice, setInvoice] = useState(null);
  const [completing, setCompleting] = useState(false);
  const [printing, startPrint] = usePrint();
  const [showAddProduct, setShowAddProduct] = useState(false);
  const debouncedSearch = useDebounce(search);

  const { items: products, loading: productsLoading, error: productsError, reload: reloadProducts } = useApiList(
    productsApi.listProducts,
    { search: debouncedSearch, limit: PRODUCT_PICKER_LIMIT },
  );

  useEffect(() => {
    if (productsError) toast.error(productsError.message || 'تعذر تحميل المنتجات');
  }, [productsError]);

  const debouncedCustomerSearch = useDebounce(customerSearch);
  // Read inside the search effect without being a dependency of it — a
  // customer selection alone must never re-trigger a network search, only
  // the typed query should (see the effect below).
  const customerIdRef = useRef(customerId);
  customerIdRef.current = customerId;

  // Searches the server as the person types (same pattern as the product
  // picker above) instead of loading one fixed batch of the first 100
  // customers up front — a shop with more than 100 customers previously
  // could never find/select anyone past that first batch here, no matter
  // what they typed, since the old one-time fetch never looked at the
  // search text at all.
  useEffect(() => {
    let cancelled = false;
    setCustomersLoading(true);
    customersApi.listCustomers({ search: debouncedCustomerSearch, limit: CUSTOMER_PICKER_LIMIT })
      .then((res) => {
        if (cancelled) return;
        // A fresh search naturally replaces the list — but if the
        // currently-selected customer isn't in these new results (e.g.
        // they were found via an earlier search, then the search box was
        // cleared/reopened), keep them in the list anyway. Otherwise the
        // picker would silently lose track of who's selected — showing
        // the empty placeholder again and breaking the invoice's customer
        // name lookup after the sale completes — the instant the search
        // text changed for any reason, with the selection itself untouched.
        setCustomers((prev) => {
          const id = customerIdRef.current;
          if (!id || res.data.some((c) => c._id === id)) return res.data;
          const stillSelected = prev.find((c) => c._id === id);
          return stillSelected ? [stillSelected, ...res.data] : res.data;
        });
      })
      .catch((err) => { if (!cancelled) toast.error(err.message || 'تعذر تحميل العملاء'); })
      .finally(() => { if (!cancelled) setCustomersLoading(false); });
    return () => { cancelled = true; };
  }, [debouncedCustomerSearch]);

  useEffect(() => {
    const handler = (e) => { if (cart.length > 0) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [cart.length]);

  // Sum of the cart lines (price*quantity) BEFORE the discount — product
  // prices themselves are never touched by the discount, only this invoice
  // total is. `discount` is clamped here ONLY for what's displayed/sent as
  // the running total preview, never on the input's own text (see below),
  // so the field itself always shows exactly what was typed.
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const discount = decimalTextToNumber(discountText);
  const discountExceedsSubtotal = discount > subtotal;
  const total = Math.max(0, subtotal - Math.min(discount, subtotal));
  const paid = paymentMethod === 'cash' ? total : (Number(paidInput) || 0);
  const remaining = total - paid;

  const addToCart = (p) => {
    if (p.quantity <= 0) { toast.warning(`تنبيه: المنتج "${p.name}" نافذ من المخزون`); return; }
    setCart((prev) => {
      const ex = prev.find((i) => i.productId === p._id);
      if (ex) {
        if (ex.quantity >= p.quantity) { toast.warning(`الكمية المتاحة من "${p.name}" هي ${p.quantity} فقط`); return prev; }
        return prev.map((i) => (i.productId === p._id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { productId: p._id, name: p.name, code: p.code, price: p.salePrice, priceText: String(p.salePrice), quantity: 1 }];
    });
  };
  const changeQty = (id, delta) => setCart((prev) => prev.map((i) => {
    if (i.productId !== id) return i;
    const product = products.find((p) => p._id === id);
    const next = i.quantity + delta;
    if (next < 1) return i;
    if (product && next > product.quantity) { toast.warning('وصلت للحد الأقصى المتاح من المخزون'); return i; }
    return { ...i, quantity: next };
  }));
  const removeItem = (id) => setCart((prev) => prev.filter((i) => i.productId !== id));

  // Editable sale price — applies to this transaction's line only, never to
  // the product's own base sale price stored in the catalog. Keeps the raw
  // typed text (priceText) as the input's source of truth and derives the
  // numeric price used in totals separately, so clearing/retyping the field
  // feels natural instead of being forced back to "0" on every keystroke.
  const changePrice = (id, raw) => {
    const text = sanitizeDecimalText(raw);
    setCart((prev) => prev.map((i) => (
      i.productId === id ? { ...i, price: decimalTextToNumber(text), priceText: text } : i
    )));
  };

  // Product created on the fly from within the POS screen: add it straight
  // to the cart using the real document the API just returned, and refresh
  // the grid in the background so it also appears there.
  const handleProductCreated = (product) => {
    addToCart(product);
    setSearch('');
    reloadProducts();
  };

  const saveNewCustomer = async () => {
    if (!newCustomer.name.trim()) { toast.error('يرجى إدخال اسم العميل'); return; }
    setSavingCustomer(true);
    try {
      let res;
      try {
        res = await customersApi.createCustomer(newCustomer);
      } catch (err) {
        if (err.details?.code === 'POSSIBLE_DUPLICATE') {
          const names = err.details.matches.map((m) => `${m.name}${m.phone ? ` (${m.phone})` : ''}`).join('، ');
          const proceed = window.confirm(`فيه عميل موجود بالفعل بنفس الاسم أو رقم الهاتف: ${names}. متأكد عايز تضيف عميل جديد منفصل؟`);
          if (!proceed) { setSavingCustomer(false); return; }
          res = await customersApi.createCustomer({ ...newCustomer, allowDuplicate: true });
        } else {
          throw err;
        }
      }
      setCustomers((prev) => [res.data, ...prev]);
      setCustomerId(res.data._id);
      setShowNewCustomer(false);
      setNewCustomer({ name: '', phone: '', address: '' });
      toast.success('تمت إضافة العميل بنجاح');
    } catch (err) {
      toast.error(err.message || 'تعذر إضافة العميل');
    } finally {
      setSavingCustomer(false);
    }
  };

  const handleComplete = async () => {
    if (cart.length === 0) { toast.error('الفاتورة فارغة، أضف منتجات أولاً'); return; }
    if (discount < 0) { toast.error('قيمة الخصم غير صحيحة'); return; }
    if (discountExceedsSubtotal) { toast.error('الخصم أكبر من إجمالي الفاتورة'); return; }
    setCompleting(true);
    try {
      const res = await salesApi.createSale({
        customerId: customerId || null,
        items: cart.map((i) => ({ productId: i.productId, quantity: i.quantity, price: i.price })),
        paymentMethod,
        paid,
        discount,
      });
      setInvoice(res.data);
      setCart([]); setPaidInput(''); setCustomerId(''); setPaymentMethod('cash'); setDiscountText('');
      reloadProducts(); // stock just changed
    } catch (err) {
      toast.error(err.message || 'تعذر إتمام عملية البيع');
    } finally {
      setCompleting(false);
    }
  };

  const handleShare = () => {
    const text = `فاتورة ${invoice.invoiceNumber} — الإجمالي ${fmtMoney(invoice.total)}`;
    if (navigator.share) navigator.share({ text }).catch(() => {});
    else toast.info('المشاركة غير مدعومة على هذا الجهاز');
  };

  const invoiceCustomer = invoice ? customers.find((c) => c._id === invoice.customerId) : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
      <Helmet><title>نقطة البيع — نظام إدارة المحل</title><meta name="description" content="شاشة البيع السريع POS" /></Helmet>

      {/* Cart */}
      <div className="flex flex-col rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">الفاتورة الحالية</h3>
        </div>

        {/* Customer selection */}
        <div className="border-b border-border p-4">
          <Field label="العميل">
            <SearchSelect
              value={customerId}
              onChange={setCustomerId}
              options={customers.map((c) => ({ id: c._id, label: c.name, sublabel: c.phone }))}
              placeholder="عميل نقدي"
              searchPlaceholder="ابحث بالاسم أو الهاتف..."
              emptyText="لا يوجد عملاء مطابقون"
              onQueryChange={setCustomerSearch}
              searching={customersLoading}
            />
          </Field>
          {!showNewCustomer ? (
            <button onClick={() => setShowNewCustomer(true)} className="mt-2 text-xs font-semibold text-primary hover:underline">
              + إضافة عميل جديد
            </button>
          ) : (
            <div className="mt-3 grid gap-2 rounded-md border border-border bg-muted/30 p-3">
              <input className={inp} placeholder="الاسم" value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} />
              <input className={inp} placeholder="الهاتف" value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} />
              <input className={inp} placeholder="العنوان" value={newCustomer.address} onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })} />
              <div className="flex gap-2">
                <button className={btn} onClick={saveNewCustomer} disabled={savingCustomer}>
                  {savingCustomer && <Loader2 size={14} className="animate-spin" />} حفظ العميل
                </button>
                <button className={btnOutline} onClick={() => setShowNewCustomer(false)} disabled={savingCustomer}>إلغاء</button>
              </div>
            </div>
          )}
        </div>

        {/* Cart items */}
        <div className="max-h-72 flex-1 overflow-y-auto p-4">
          {cart.length === 0 ? <Empty text="الفاتورة فارغة — اختر منتجات من القائمة" /> : (
            <div className="grid gap-2">
              {cart.map((i) => {
                const basePrice = products.find((p) => p._id === i.productId)?.salePrice ?? i.price;
                const isCustomPrice = Number(i.price) !== Number(basePrice);
                return (
                <div key={i.productId} className="flex items-center gap-2 rounded-md border border-border bg-background p-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">{i.name}</div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <Pencil size={10} className="shrink-0 text-muted-foreground/60" />
                      <input
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        title="سعر بيع مختلف لهذه العملية فقط — لا يغير سعر المنتج الأساسي"
                        className="h-6 w-20 rounded border border-border bg-card px-1.5 text-xs font-mono outline-none transition-shadow focus:border-ring focus:ring-2 focus:ring-ring/20"
                        value={i.priceText ?? String(i.price)}
                        onChange={(e) => changePrice(i.productId, e.target.value)}
                      />
                      {isCustomPrice && (
                        <span className="text-[10px] text-muted-foreground line-through">{fmtMoney(basePrice)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => changeQty(i.productId, -1)} className="flex h-6 w-6 items-center justify-center rounded border border-border text-muted-foreground transition-colors hover:bg-muted">
                      <Minus size={12} />
                    </button>
                    <span className="w-7 text-center text-sm font-bold">{i.quantity}</span>
                    <button onClick={() => changeQty(i.productId, 1)} className="flex h-6 w-6 items-center justify-center rounded border border-border text-muted-foreground transition-colors hover:bg-muted">
                      <Plus size={12} />
                    </button>
                  </div>
                  <div className="w-20 text-end text-sm font-bold text-foreground">{fmtMoney(i.price * i.quantity)}</div>
                  <button onClick={() => removeItem(i.productId)} className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-red-50 hover:text-destructive">
                    <Trash2 size={13} />
                  </button>
                </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Payment */}
        <div className="grid gap-3 border-t border-border p-4">
          <div className="flex gap-2">
            <button
              onClick={() => setPaymentMethod('cash')}
              className={`flex-1 rounded-md border py-2 text-sm font-semibold transition-colors ${paymentMethod === 'cash' ? 'border-primary bg-primary text-primary-foreground' : 'border-input hover:bg-muted'}`}
            >
              نقدي
            </button>
            <button
              onClick={() => setPaymentMethod('credit')}
              className={`flex-1 rounded-md border py-2 text-sm font-semibold transition-colors ${paymentMethod === 'credit' ? 'border-primary bg-primary text-primary-foreground' : 'border-input hover:bg-muted'}`}
            >
              آجل
            </button>
          </div>

          {paymentMethod === 'credit' && (
            <Field label="المبلغ المدفوع">
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

          <Field label="الخصم (مبلغ ثابت على إجمالي الفاتورة)">
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
              <p className="mt-1 text-xs font-semibold text-destructive">الخصم أكبر من إجمالي الفاتورة</p>
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
              <span className="text-muted-foreground">المتبقي</span>
              <b className={remaining > 0 ? 'text-destructive' : ''}>{fmtMoney(remaining)}</b>
            </div>
          </div>

          <button
            onClick={handleComplete}
            disabled={cart.length === 0 || completing || discountExceedsSubtotal}
            className={`${btn} h-11 w-full text-base`}
          >
            {completing && <Loader2 size={16} className="animate-spin" />} إتمام البيع
          </button>
        </div>
      </div>

      {/* Products grid */}
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {products.map((p) => (
              <button
                key={p._id}
                onClick={() => addToCart(p)}
                disabled={p.quantity <= 0}
                className="rounded-md border border-border bg-card p-3 text-start transition-colors hover:border-primary/40 hover:bg-accent active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="flex items-start justify-between gap-2">
                  <ProductImage src={p.image} alt={p.name} size="sm" />
                  {p.quantity <= 0
                    ? <Badge tone="red">نافذ</Badge>
                    : p.quantity <= p.minQuantity
                      ? <Badge tone="amber">{p.quantity}</Badge>
                      : <Badge tone="green">{p.quantity}</Badge>
                  }
                </div>
                <div className="mt-2 text-sm font-medium leading-tight text-foreground">{p.name}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{p.code}</div>
                <div className="mt-2 text-sm font-bold text-primary">{fmtMoney(p.salePrice)}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      <Modal open={!!invoice} onClose={() => setInvoice(null)} title="معاينة الفاتورة" wide>
        {invoice && (
          <div className="grid gap-4">
            <InvoiceView sale={invoice} customer={invoiceCustomer} settings={settings} />
            <div className="flex flex-wrap gap-2">
              <button className={btn} onClick={startPrint}><Printer size={16} /> طباعة</button>
              <button className={btnOutline} onClick={handleShare}><Share2 size={16} /> مشاركة</button>
              <button className={btnOutline} onClick={() => setInvoice(null)}>إغلاق</button>
            </div>
          </div>
        )}
      </Modal>
      {printing && invoice && <PrintPortal><InvoiceView sale={invoice} customer={invoiceCustomer} settings={settings} /></PrintPortal>}

      <QuickAddProductModal
        open={showAddProduct}
        onClose={() => setShowAddProduct(false)}
        onCreated={handleProductCreated}
        initialName={search}
      />
    </div>
  );
}

export default PosPage;