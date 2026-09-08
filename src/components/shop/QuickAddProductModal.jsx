import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { fmtMoney } from '@/lib/formatters';
import * as productsApi from '@/services/api/products';
import { Field } from './Field';
import { Modal } from './Modal';
import { ProductImagePicker } from './ProductImagePicker';
import { inp, btn, btnOutline } from './styles';

const emptyForm = {
  name: '',
  code: '',
  purchasePrice: '',
  salePrice: '',
  quantity: '',
  minQuantity: '5',
  notes: '',
  image: '',
};

/**
 * Inline "quick add product" modal — reused from POS and Purchases pages so the
 * user never has to leave the current sale/purchase operation to register a new
 * product. On success it hands the freshly created product back via onCreated
 * so the caller can immediately use it in the same operation (add to cart / add
 * to purchase lines), exactly like it already exists in the products list.
 */
export function QuickAddProductModal({ open, onClose, onCreated, initialName = '' }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm({ ...emptyForm, name: initialName || '' });
  }, [open, initialName]);

  const profit = (Number(form.salePrice) || 0) - (Number(form.purchasePrice) || 0);

  const save = async () => {
    if (!form.name.trim()) { toast.error('يرجى إدخال اسم المنتج'); return; }
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
      const res = await productsApi.createProduct(payload);
      setForm(emptyForm);
      onClose();
      onCreated && onCreated(res.data);
    } catch (err) {
      toast.error(err.message || 'تعذر إضافة المنتج');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="إضافة منتج جديد">
      <div className="grid gap-3">
        <ProductImagePicker value={form.image} onChange={(image) => setForm({ ...form, image })} />
        <Field label="اسم المنتج *">
          <input
            className={inp}
            placeholder="مثال: زيت موتور 10W40"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            autoFocus
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
              type="number" min="0" className={inp}
              value={form.purchasePrice}
              onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })}
            />
          </Field>
          <Field label="سعر البيع">
            <input
              type="number" min="0" className={inp}
              value={form.salePrice}
              onChange={(e) => setForm({ ...form, salePrice: e.target.value })}
            />
          </Field>
          <Field label="الكمية المتاحة">
            <input
              type="number" min="0" className={inp}
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            />
          </Field>
          <Field label="الحد الأدنى (للتنبيه)">
            <input
              type="number" min="0" className={inp}
              value={form.minQuantity}
              onChange={(e) => setForm({ ...form, minQuantity: e.target.value })}
            />
          </Field>
        </div>
        <Field label="ملاحظات">
          <input
            className={inp}
            placeholder="تفاصيل إضافية..."
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>

        <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-sm font-semibold text-emerald-700">
          <span>ربح القطعة الواحدة:</span>
          <span className="font-mono text-base">{fmtMoney(profit)}</span>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button className={btnOutline} onClick={onClose} disabled={saving}>إلغاء</button>
          <button className={btn} onClick={save} disabled={saving}>
            {saving && <Loader2 size={15} className="animate-spin" />}
            حفظ واستخدام المنتج
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default QuickAddProductModal;
