import { useState } from 'react';
import { toast } from 'sonner';
import { Modal } from './Modal';
import { Field } from './Field';
import { inp, btn, btnOutline } from './styles';

/**
 * `personType` ('customer' | 'supplier') only changes the opening-balance
 * direction labels below — everything else about the form is identical
 * between the two, same as the rest of this shared component.
 *
 * The opening-balance section only appears when `initial` is falsy (i.e.
 * adding a brand-new person, not editing an existing one) — matching the
 * backend, which only accepts `openingBalance` on create; the normal PATCH
 * this form sends for an edit can never carry it (see personService.js /
 * personRoutes.js). Correcting an existing person's opening balance later
 * goes through a separate, deliberately more guarded flow elsewhere (see
 * CustomerDetailsPage/SupplierDetailsPage), not this form.
 */
export function PersonForm({ initial, onSubmit, onClose, title, personType = 'customer' }) {
  const [form, setForm] = useState(initial || { name: '', phone: '', address: '' });
  const [obAmountText, setObAmountText] = useState('');
  const [obDirection, setObDirection] = useState('they_owe_us');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const isNew = !initial;
  const theyOweUsLabel = personType === 'supplier' ? 'المورد عليه فلوس للمحل' : 'العميل عليه فلوس للمحل';
  const weOweThemLabel = personType === 'supplier' ? 'المحل عليه فلوس للمورد' : 'المحل عليه فلوس للعميل';

  const submit = () => {
    if (!form.name.trim()) { toast.error('من فضلك أكمل البيانات المطلوبة'); return; }
    const amount = Number(obAmountText);
    const openingBalance = isNew && amount > 0 ? { amount, direction: obDirection } : undefined;
    onSubmit(openingBalance ? { ...form, openingBalance } : form);
  };

  return (
    <Modal open onClose={onClose} title={title}>
      <div className="grid gap-3">
        <Field label="الاسم"><input className={inp} value={form.name} onChange={set('name')} /></Field>
        <Field label="الهاتف"><input className={inp} value={form.phone} onChange={set('phone')} /></Field>
        <Field label="العنوان"><input className={inp} value={form.address} onChange={set('address')} /></Field>

        {isNew && (
          <div className="mt-1 rounded-lg border border-dashed border-border p-3">
            <div className="mb-2 text-xs font-semibold text-muted-foreground">
              رصيد افتتاحي (اختياري) — لو نقلت رصيد من دفاتر قديمة قبل استخدام النظام
            </div>
            <Field label="المبلغ">
              <input
                type="text"
                inputMode="decimal"
                className={`${inp} font-mono`}
                value={obAmountText}
                onChange={(e) => setObAmountText(e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder="0"
              />
            </Field>
            {Number(obAmountText) > 0 && (
              <div className="mt-2 grid gap-1.5">
                <button
                  type="button"
                  onClick={() => setObDirection('they_owe_us')}
                  className={`rounded-lg border px-3 py-2 text-start text-sm transition-colors ${obDirection === 'they_owe_us' ? 'border-primary bg-primary/5 font-semibold text-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}
                >
                  {theyOweUsLabel}
                </button>
                <button
                  type="button"
                  onClick={() => setObDirection('we_owe_them')}
                  className={`rounded-lg border px-3 py-2 text-start text-sm transition-colors ${obDirection === 'we_owe_them' ? 'border-primary bg-primary/5 font-semibold text-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}
                >
                  {weOweThemLabel}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="mt-2 flex gap-2">
          <button className={btn} onClick={submit}>حفظ</button>
          <button className={btnOutline} onClick={onClose}>إلغاء</button>
        </div>
      </div>
    </Modal>
  );
}

export default PersonForm;