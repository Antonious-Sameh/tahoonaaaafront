import { fmtMoney, fmtDateTime } from '@/lib/formatters';
import { thCls, tdCls } from '@/components/shop/styles';

const TYPE_LABEL = { customer: 'العميل', supplier: 'المورد' };

// Raw balance as the backend stores it: customer > 0 = customer owes the shop,
// supplier > 0 = the shop owes the supplier (opposite orientations).
export const describeBalance = (accountType, raw) => {
  const abs = fmtMoney(Math.abs(raw));
  if (!raw) return fmtMoney(0);
  if (accountType === 'customer') return raw > 0 ? `عليه ${abs}` : `له ${abs}`;
  return raw > 0 ? `له ${abs}` : `عليه ${abs}`;
};

// What the offset did to THIS account, in plain words.
const effectLabel = (accountType, effect) => {
  if (accountType === 'customer') return effect < 0 ? 'تخفيض مديونية العميل' : 'تخفيض المستحق للعميل';
  return effect < 0 ? 'تخفيض المستحق للمورد' : 'تخفيض مديونية المورد';
};

const rowParts = (tr, accountType) => ({
  counterpartLabel: `${TYPE_LABEL[tr.counterpart.type]} ${tr.counterpart.name}`,
  direction: tr.isSource ? 'منقولة إلى' : 'منقولة من',
  balanceAfter: describeBalance(accountType, tr.isSource ? tr.fromBalanceAfter : tr.toBalanceAfter),
  effect: effectLabel(accountType, tr.accountEffect),
});

/**
 * Statement section for Customer <-> Supplier offsets (see
 * accountBalanceTransfer.service.js). Presentational: the page fetches
 * `transfers` (each row already carries `isSource`, `accountEffect` and
 * `counterpart` for this account). The reference number is the same on both
 * accounts' statements.
 */
export function BalanceTransferHistory({ transfers, accountType }) {
  if (!transfers || transfers.length === 0) return null;
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">سجل المقاصة بين العملاء والموردين</h3>
      </div>
      <table className="w-full text-start">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className={thCls}>التاريخ والوقت</th>
            <th className={thCls}>رقم المرجع</th>
            <th className={thCls}>العملية</th>
            <th className={thCls}>المبلغ</th>
            <th className={thCls}>الأثر على رصيده</th>
            <th className={thCls}>رصيده بعد العملية</th>
            <th className={thCls}>ملاحظة</th>
          </tr>
        </thead>
        <tbody>
          {transfers.map((tr) => {
            const p = rowParts(tr, accountType);
            return (
              <tr key={tr._id} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className={`${tdCls} text-muted-foreground`}>{fmtDateTime(tr.date)}</td>
                <td className={`${tdCls} font-mono text-xs`}>{tr.reference}</td>
                <td className={tdCls}>{p.direction} <b className="text-foreground">{p.counterpartLabel}</b></td>
                <td className={`${tdCls} font-mono font-semibold text-violet-700`}>{fmtMoney(tr.amount)}</td>
                <td className={`${tdCls} text-muted-foreground`}>{p.effect}</td>
                <td className={`${tdCls} font-mono`}>{p.balanceAfter}</td>
                <td className={`${tdCls} text-muted-foreground`}>{tr.note || '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
        المقاصة دي مش سداد ومش فاتورة ومش بتأثر على الصندوق ولا المخزون، والفواتير القديمة لسه باسم صاحبها الأصلي (فمجموع "المتبقي" فيها ممكن ما يساويش الرصيد الحالي). العملية مثبتة ومش بتتحذف.
      </p>
    </div>
  );
}

/** Same data for the printed account statement. */
export function BalanceTransferPrintSection({ transfers, accountType }) {
  if (!transfers || transfers.length === 0) return null;
  return (
    <>
      <h2 className="mb-2 mt-6 text-base font-bold">سجل المقاصة بين العملاء والموردين</h2>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-black/20">
            <th className="p-2 text-start">التاريخ والوقت</th>
            <th className="p-2 text-start">رقم المرجع</th>
            <th className="p-2 text-start">العملية</th>
            <th className="p-2 text-start">المبلغ</th>
            <th className="p-2 text-start">الأثر</th>
            <th className="p-2 text-start">الرصيد بعد العملية</th>
          </tr>
        </thead>
        <tbody>
          {transfers.map((tr) => {
            const p = rowParts(tr, accountType);
            return (
              <tr key={tr._id} className="border-b border-black/10">
                <td className="p-2">{fmtDateTime(tr.date)}</td>
                <td className="p-2 font-mono">{tr.reference}</td>
                <td className="p-2">{p.direction} {p.counterpartLabel}</td>
                <td className="p-2 font-mono">{fmtMoney(tr.amount)}</td>
                <td className="p-2">{p.effect}</td>
                <td className="p-2 font-mono">{p.balanceAfter}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
