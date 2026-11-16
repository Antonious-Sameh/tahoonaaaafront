import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { ArrowLeftRight, Loader2 } from 'lucide-react';
import { fmtMoney } from '@/lib/formatters';
import { Modal } from '@/components/shop/Modal';
import { Field } from '@/components/shop/Field';
import { SearchSelect } from '@/components/shop/SearchSelect';
import { useDebounce } from '@/hooks/useDebounce';
import * as customersApi from '@/services/api/customers';
import * as suppliersApi from '@/services/api/suppliers';
import * as customerDebtTransfersApi from '@/services/api/customerDebtTransfers';
import { inp, btn, btnOutline } from '@/components/shop/styles';

// Same helpers the detail pages use — keeps exactly what was typed on screen
// while only allowing what a decimal amount can contain.
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
const newIdempotencyKey = () => (
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `dt-${Date.now()}-${Math.random().toString(36).slice(2)}`
);

const KINDS = {
  customer: { noun: 'العميل', other: 'عميل آخر', plain: 'عميل', receiver: 'العميل المستلم للمديونية', pick: 'اختر العميل...', empty: 'لا يوجد عملاء مطابقون' },
  supplier: { noun: 'المورد', other: 'مورد آخر', plain: 'مورد', receiver: 'المورد المستلم للمديونية', pick: 'اختر المورد...', empty: 'لا يوجد موردون مطابقون' },
};

/**
 * "What does this person owe the shop" for a row coming back from the list
 * API. A customer's `remaining` is exactly that. A supplier's `remaining` is
 * what the SHOP owes THEM, so what they owe the shop is `creditOwed` and the
 * shop's own debt to them counts as negative — the same convention the
 * backend uses (see customerDebtTransfer.service.js).
 */
const owesShop = (kind, totals) => (
  kind === 'supplier' ? (totals?.creditOwed || 0) - (totals?.remaining || 0) : (totals?.remaining || 0)
);

// Human wording for a signed "owes the shop" figure on a given side.
export function describeOwes(kind, owes) {
  if (kind === 'supplier') {
    if (owes > 0) return `${fmtMoney(owes)} (مستحق على المورد للمحل)`;
    if (owes < 0) return `${fmtMoney(-owes)} (مستحق للمورد عند المحل)`;
    return fmtMoney(0);
  }
  return fmtMoney(Math.max(0, owes));
}

/**
 * One debt-transfer dialog for BOTH the customer and the supplier details
 * pages — so the two can never behave differently. `source` is the party the
 * debt moves OFF: `{ type: 'customer' | 'supplier', id, name, available }`,
 * where `available` is how much that party currently owes the shop (a
 * customer's `remaining`, a supplier's `creditOwed`). The destination can be
 * a customer or a supplier. Not a payment: nothing enters or leaves the
 * cashbox. The server re-validates every rule; the checks here are only a
 * preview.
 */
export function DebtTransferModal({ open, onClose, source, onDone }) {
  const [step, setStep] = useState('form'); // 'form' -> 'confirm'
  const [toType, setToType] = useState(source.type);
  const [amountText, setAmountText] = useState('');
  const [note, setNote] = useState('');
  const [toId, setToId] = useState('');
  const [targets, setTargets] = useState([]);
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [idemKey, setIdemKey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Synchronous guard: a fast double-tap can fire twice before the
  // `submitting` state has re-rendered the button as disabled.
  const submittingRef = useRef(false);
  const debouncedSearch = useDebounce(search);
  const toIdRef = useRef(toId);
  toIdRef.current = toId;

  // Fresh form every time the dialog opens, defaulting to the same kind as the
  // source (customer page -> customer, supplier page -> supplier).
  useEffect(() => {
    if (!open) return;
    setStep('form');
    setToType(source.type);
    setAmountText('');
    setNote('');
    setToId('');
    setTargets([]);
    setSearch('');
    setIdemKey(newIdempotencyKey());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pickType = (type) => {
    if (type === toType || submitting) return;
    setToType(type);
    setToId('');
    setTargets([]);
    setSearch('');
  };

  // Destination is searched on the server as the person types.
  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setSearching(true);
    const list = toType === 'supplier' ? suppliersApi.listSuppliers : customersApi.listCustomers;
    list({ search: debouncedSearch, limit: 50 })
      .then((res) => {
        if (cancelled) return;
        setTargets((prev) => {
          const selectedId = toIdRef.current;
          if (!selectedId || res.data.some((c) => c._id === selectedId)) return res.data;
          const keep = prev.find((c) => c._id === selectedId);
          return keep ? [keep, ...res.data] : res.data;
        });
      })
      .catch((err) => { if (!cancelled) toast.error(err.message || 'تعذر تحميل القائمة'); })
      .finally(() => { if (!cancelled) setSearching(false); });
    return () => { cancelled = true; };
  }, [open, toType, debouncedSearch]);

  const srcKind = KINDS[source.type];
  const dstKind = KINDS[toType];
  const available = source.available || 0;

  const amount = decimalTextToNumber(amountText);
  const target = targets.find((c) => c._id === toId) || null;
  const targetOwes = owesShop(toType, target?.totals);
  const targetCreditBlocked = toType === 'customer' && (target?.totals?.creditOwed || 0) > 0;
  const exceeds = amount > available;
  const valid = !!toId && amount > 0 && !exceeds && !targetCreditBlocked;
  const sourceAfter = Math.max(0, available - Math.min(amount, available));
  const targetAfter = targetOwes + amount;

  const close = () => {
    if (submitting) return;
    onClose();
  };

  const submit = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await customerDebtTransfersApi.createCustomerDebtTransfer({
        ...(source.type === 'customer' ? { fromCustomerId: source.id } : { fromSupplierId: source.id }),
        ...(toType === 'customer' ? { toCustomerId: toId } : { toSupplierId: toId }),
        amount,
        note,
        idempotencyKey: idemKey,
      });
      toast.success('تم نقل المديونية بنجاح');
      onClose();
      if (onDone) await onDone();
    } catch (err) {
      toast.error(err.message || 'تعذر نقل المديونية');
      setStep('form'); // back to the input step so they can adjust and retry
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  // The kinds are shown in a fixed, page-specific order: the page's own kind first.
  const typeOrder = source.type === 'customer' ? ['customer', 'supplier'] : ['supplier', 'customer'];

  return (
    <Modal open={open} onClose={close} title={`نقل مديونية إلى ${toType === source.type ? dstKind.other : dstKind.plain}`}>
      {step === 'form' ? (
        <div className="grid gap-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            ده نقل مديونية بس — مش سداد ومش تحصيل ومش هيدخل أو يخرج أي فلوس من الصندوق، والفواتير القديمة مش هتتغير.
          </div>

          <div className="rounded-lg bg-muted/40 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">المتاح للنقل من {source.name}</span>
              <b className="font-mono text-destructive">{fmtMoney(available)}</b>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted/40 p-1" role="tablist" aria-label="نوع الطرف المستلم">
            {typeOrder.map((type) => (
              <button
                key={type}
                type="button"
                role="tab"
                aria-selected={toType === type}
                onClick={() => pickType(type)}
                className={`h-8 rounded-md text-sm font-semibold transition-colors ${toType === type ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {KINDS[type].receiver.replace(' للمديونية', '')}
              </button>
            ))}
          </div>

          <Field label={dstKind.receiver}>
            <SearchSelect
              value={toId}
              onChange={setToId}
              options={targets
                .filter((c) => !(toType === source.type && c._id === source.id))
                .map((c) => ({ id: c._id, label: c.name, sublabel: c.phone }))}
              placeholder={dstKind.pick}
              searchPlaceholder="ابحث بالاسم أو الهاتف..."
              emptyText={dstKind.empty}
              onQueryChange={setSearch}
              searching={searching}
              clearable={false}
            />
            {targetCreditBlocked && (
              <p className="mt-1 text-xs font-semibold text-destructive">
                العميل ده له رصيد مستحق عند المحل ({fmtMoney(target.totals.creditOwed)}) — مينفعش النقل إليه قبل تسوية رصيده.
              </p>
            )}
            {toType === 'supplier' && target && targetOwes < 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                المحل مدين لهذا المورد بـ {fmtMoney(-targetOwes)} — المبلغ المنقول هيتخصم منه والباقي (لو في) هيبقى مستحق على المورد للمحل.
              </p>
            )}
          </Field>

          <Field label="المبلغ المنقول">
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              className={`${inp} font-mono`}
              value={amountText}
              onChange={(e) => setAmountText(sanitizeDecimalText(e.target.value))}
              placeholder="0"
            />
            {exceeds && (
              <p className="mt-1 text-xs font-semibold text-destructive">المبلغ أكبر من المديونية المتاحة على {srcKind.noun}</p>
            )}
            {available > 0 && (
              <button
                type="button"
                onClick={() => setAmountText(String(available))}
                className="mt-1 text-xs font-semibold text-primary hover:underline"
              >
                نقل كل المديونية ({fmtMoney(available)})
              </button>
            )}
          </Field>

          <Field label="ملاحظة (اختياري)">
            <input
              type="text"
              autoComplete="off"
              className={inp}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="مثلاً: اتفاق بين الطرفين"
            />
          </Field>

          {amount > 0 && target && (
            <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
              <div className="flex justify-between gap-3 py-0.5">
                <span className="text-muted-foreground">{source.name} بعد النقل</span>
                <b className="font-mono text-primary">{describeOwes(source.type, sourceAfter)}</b>
              </div>
              <div className="flex justify-between gap-3 py-0.5">
                <span className="text-muted-foreground">{target.name} بعد النقل</span>
                <b className="font-mono text-primary">{describeOwes(toType, targetAfter)}</b>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button className={btnOutline} onClick={close}>إلغاء</button>
            <button className={btn} disabled={!valid} onClick={() => setStep('confirm')}>
              متابعة
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-5">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-50">
              <ArrowLeftRight size={16} className="text-violet-600" />
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              هل تريد نقل مديونية بقيمة <b className="font-mono text-foreground">{fmtMoney(amount)}</b> من {srcKind.plain}{' '}
              <b className="text-foreground">{source.name}</b> إلى {dstKind.plain} <b className="text-foreground">{target?.name}</b>؟
              <br />
              سيصبح الرصيد على {source.name}: <b className="font-mono text-foreground">{describeOwes(source.type, sourceAfter)}</b>،
              وعلى {target?.name}: <b className="font-mono text-foreground">{describeOwes(toType, targetAfter)}</b>.
              <br />
              العملية مش سداد ومش هتأثر على الصندوق، وهتتسجل بشكل دائم (مش بتتحذف — التصحيح بنقل عكسي).
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <button className={btnOutline} onClick={() => setStep('form')} disabled={submitting}>رجوع</button>
            <button className={btn} onClick={submit} disabled={submitting}>
              {submitting && <Loader2 size={14} className="animate-spin" />} تأكيد النقل
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default DebtTransferModal;
