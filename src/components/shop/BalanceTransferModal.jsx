import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Loader2, ArrowLeftRight } from 'lucide-react';
import { fmtMoney } from '@/lib/formatters';
import { Modal } from '@/components/shop/Modal';
import { Field } from '@/components/shop/Field';
import { SearchSelect } from '@/components/shop/SearchSelect';
import { useDebounce } from '@/hooks/useDebounce';
import * as customersApi from '@/services/api/customers';
import * as suppliersApi from '@/services/api/suppliers';
import * as accountBalanceTransfersApi from '@/services/api/accountBalanceTransfers';
import { inp, btn, btnOutline } from '@/components/shop/styles';

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
const round2 = (n) => Math.round(n * 100) / 100;
// More than 2 decimals is rejected by the server too (never silently rounded).
const hasTooManyDecimals = (text) => /\.\d{3,}/.test(text);
const newIdempotencyKey = () => (
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `abt-${Date.now()}-${Math.random().toString(36).slice(2)}`
);

/**
 * Offsets (مقاصة) part or all of THIS account's balance against an account of
 * the other kind:
 *  - source = customer (owes the shop)  -> destination = supplier the shop owes
 *  - source = supplier (owes the shop)  -> destination = customer the shop owes
 * Not a payment: nothing enters or leaves the cashbox, no stock moves. The
 * server re-checks every rule (accountBalanceTransfer.service.js); everything
 * here is only a preview so the person sees the effect before confirming.
 *
 * `sourceTotals` is the source's `totals` from the API: `remaining` (customer
 * owes) or `creditOwed` (supplier owes) is what can be moved.
 */
export function BalanceTransferModal({ open, onClose, sourceType, sourceId, sourceName, sourceTotals, onDone }) {
  const isCustomerSource = sourceType === 'customer';
  const targetType = isCustomerSource ? 'supplier' : 'customer';
  const sourceWord = isCustomerSource ? 'العميل' : 'المورد';
  const targetWord = isCustomerSource ? 'المورد' : 'العميل';

  // What the SOURCE can give: a customer's debt / a supplier's debt to the shop.
  const sourceAvailable = isCustomerSource ? (sourceTotals?.remaining || 0) : (sourceTotals?.creditOwed || 0);
  // What the DESTINATION can absorb: what the shop owes that supplier / customer.
  const targetAvailableOf = (a) => (isCustomerSource ? (a?.totals?.remaining || 0) : (a?.totals?.creditOwed || 0));

  const [step, setStep] = useState('form');
  const [amountText, setAmountText] = useState('');
  const [note, setNote] = useState('');
  const [toId, setToId] = useState('');
  const [targets, setTargets] = useState([]);
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [idemKey, setIdemKey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const debouncedSearch = useDebounce(search);
  const toIdRef = useRef(toId);
  toIdRef.current = toId;
  const submittingRef = useRef(false);

  // Reset every time the modal opens (new attempt = new idempotency key).
  useEffect(() => {
    if (!open) return;
    setStep('form'); setAmountText(''); setNote(''); setToId(''); setTargets([]); setSearch('');
    setIdemKey(newIdempotencyKey());
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setSearching(true);
    const request = isCustomerSource
      ? suppliersApi.listSuppliers({ search: debouncedSearch, limit: 50 })
      : customersApi.listCustomers({ search: debouncedSearch, limit: 50 });
    request
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
  }, [open, debouncedSearch, isCustomerSource]);

  const amount = decimalTextToNumber(amountText);
  const target = targets.find((c) => c._id === toId) || null;
  const targetAvailable = targetAvailableOf(target);
  const transferable = target ? round2(Math.min(sourceAvailable, targetAvailable)) : round2(sourceAvailable);
  const tooPrecise = hasTooManyDecimals(amountText);
  const exceeds = !!target && amount > transferable;
  const valid = !!target && targetAvailable > 0 && sourceAvailable > 0 && amount > 0 && !exceeds && !tooPrecise;
  const sourceAfter = round2(sourceAvailable - Math.min(amount, sourceAvailable));
  const targetAfter = round2(targetAvailable - Math.min(amount, targetAvailable));

  const close = () => { if (!submitting) onClose(); };

  const submit = async () => {
    if (submittingRef.current) return; // blocks a fast double-click before state flushes
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await accountBalanceTransfersApi.createAccountBalanceTransfer({
        fromAccountType: sourceType,
        fromAccountId: sourceId,
        toAccountType: targetType,
        toAccountId: toId,
        amount,
        note,
        idempotencyKey: idemKey,
      });
      toast.success('تمت المقاصة بنجاح');
      onClose();
      await onDone?.(); // page refreshes balances + histories
    } catch (err) {
      toast.error(err.message || 'تعذر تنفيذ المقاصة');
      setStep('form'); // back to the input step so they can adjust and retry (same key is safe)
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const explain = isCustomerSource
    ? 'تخفيض مديونية العميل للمحل مقابل تخفيض المبلغ اللي المحل مديون بيه للمورد (زي ما العميل سدّد للمورد بدالنا).'
    : 'تخفيض مديونية المورد للمحل مقابل تخفيض المبلغ اللي المحل مديون بيه للعميل.';

  return (
    <Modal open={open} onClose={close} title={isCustomerSource ? 'مقاصة مديونية العميل مع مورد' : 'مقاصة مديونية المورد مع عميل'}>
      {step === 'form' ? (
        <div className="grid gap-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
            {explain} ده مش سداد ومش تحصيل، ومش هيدخل أو يخرج أي فلوس من الصندوق ولا هيأثر على المخزون.
          </div>

          <div className="rounded-lg bg-muted/40 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{sourceWord} (المصدر)</span>
              <b className="text-foreground">{sourceName}</b>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-muted-foreground">{isCustomerSource ? 'مديونيته للمحل' : 'مديونيته للمحل (مستحق لنا)'}</span>
              <b className="font-mono text-destructive">{fmtMoney(sourceAvailable)}</b>
            </div>
          </div>

          <Field label={`${targetWord} (المستلم)`}>
            <SearchSelect
              value={toId}
              onChange={setToId}
              options={targets.map((c) => ({
                id: c._id,
                label: c.name,
                sublabel: `${c.phone || ''}${c.phone ? ' • ' : ''}${isCustomerSource ? 'مستحق له' : 'مستحق له'} ${fmtMoney(targetAvailableOf(c))}`,
              }))}
              placeholder={`اختر ${targetWord}...`}
              searchPlaceholder="ابحث بالاسم أو الهاتف..."
              emptyText="لا توجد نتائج مطابقة"
              onQueryChange={setSearch}
              searching={searching}
              clearable={false}
            />
            {target && targetAvailable <= 0 && (
              <p className="mt-1 text-xs font-semibold text-destructive">
                {isCustomerSource
                  ? 'المحل مش مديون للمورد ده بأي مبلغ — مفيش حاجة تتقاص عليها.'
                  : 'المحل مش مديون للعميل ده بأي مبلغ — مفيش حاجة تتقاص عليها.'}
              </p>
            )}
            {target && targetAvailable > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                الحد الأقصى للمقاصة: <b className="font-mono">{fmtMoney(transferable)}</b> (الأقل بين الطرفين)
              </p>
            )}
          </Field>

          <Field label="المبلغ">
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              className={`${inp} font-mono`}
              value={amountText}
              onChange={(e) => setAmountText(sanitizeDecimalText(e.target.value))}
              placeholder="0"
            />
            {tooPrecise && <p className="mt-1 text-xs font-semibold text-destructive">المبلغ لا يجوز أن يحتوي على أكثر من خانتين عشريتين</p>}
            {exceeds && <p className="mt-1 text-xs font-semibold text-destructive">المبلغ أكبر من الرصيد القابل للمقاصة</p>}
            {target && targetAvailable > 0 && transferable > 0 && (
              <button type="button" onClick={() => setAmountText(String(transferable))} className="mt-1 text-xs font-semibold text-primary hover:underline">
                مقاصة بأقصى مبلغ ممكن ({fmtMoney(transferable)})
              </button>
            )}
          </Field>

          <Field label="ملاحظة (اختياري)">
            <input
              type="text"
              autoComplete="off"
              maxLength={500}
              className={inp}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="مثلاً: اتفاق ثلاثي بين الأطراف"
            />
          </Field>

          {amount > 0 && target && !exceeds && !tooPrecise && (
            <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
              <div className="flex justify-between py-0.5">
                <span className="text-muted-foreground">{sourceName} بعد المقاصة</span>
                <b className="font-mono text-primary">{fmtMoney(sourceAfter)}</b>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-muted-foreground">{target.name} — المستحق له بعد المقاصة</span>
                <b className="font-mono text-primary">{fmtMoney(targetAfter)}</b>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button className={btnOutline} onClick={close}>إلغاء</button>
            <button className={btn} disabled={!valid} onClick={() => setStep('confirm')}>متابعة</button>
          </div>
        </div>
      ) : (
        <div className="grid gap-5">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-50">
              <ArrowLeftRight size={16} className="text-violet-600" />
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              هل تريد إجراء مقاصة بقيمة <b className="font-mono text-foreground">{fmtMoney(amount)}</b> من {sourceWord}{' '}
              <b className="text-foreground">{sourceName}</b> إلى {targetWord} <b className="text-foreground">{target?.name}</b>؟
              <br />
              سيصبح {isCustomerSource ? 'المتبقي على' : 'المستحق من'} {sourceName} <b className="font-mono text-foreground">{fmtMoney(sourceAfter)}</b>،
              والمستحق لـ {target?.name} <b className="font-mono text-foreground">{fmtMoney(targetAfter)}</b>.
              <br />
              العملية مش سداد ومش هتأثر على الصندوق أو المخزون، وهتتسجل بشكل دائم في كشف حساب الطرفين (مش بتتحذف).
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <button className={btnOutline} onClick={() => setStep('form')} disabled={submitting}>رجوع</button>
            <button className={btn} onClick={submit} disabled={submitting}>
              {submitting && <Loader2 size={14} className="animate-spin" />} تأكيد المقاصة
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default BalanceTransferModal;
