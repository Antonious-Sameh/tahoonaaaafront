import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { fmtMoney, fmtDate, fmtTime, ACTIVITY_TYPE_LABELS } from '@/lib/formatters';
import { Empty } from '@/components/shop/Empty';
import { Badge } from '@/components/shop/Badge';
import { Pagination } from '@/components/shop/Pagination';
import { useApiList } from '@/hooks/useApiList';
import * as activityApi from '@/services/api/activity';
import { thCls, tdCls } from '@/components/shop/styles';

export function ActivityPage() {
  const [type, setType] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => setPage(1), [type, from, to]);

  const { items: rows, pagination, loading, error } = useApiList(activityApi.listActivity, {
    page, limit: 20, type, from, to,
  });

  useEffect(() => {
    if (error) toast.error(error.message || 'تعذر تحميل سجل النشاط');
  }, [error]);

  return (
    <div className="grid gap-4">
      <Helmet><title>سجل النشاط — نظام إدارة المحل</title><meta name="description" content="سجل كل العمليات على النظام" /></Helmet>
      <div className="flex flex-wrap gap-2 rounded-xl border bg-card p-4">
        <select className="h-10 rounded-lg border border-input bg-background px-3 text-sm" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="all">كل الأنواع</option>
          {Object.entries(ACTIVITY_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input type="date" className="h-10 rounded-lg border border-input bg-background px-3 text-sm" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" className="h-10 rounded-lg border border-input bg-background px-3 text-sm" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full">
          <thead><tr className="border-b bg-muted/50"><th className={thCls}>النوع</th><th className={thCls}>الحدث</th><th className={thCls}>المبلغ</th><th className={thCls}>التاريخ</th><th className={thCls}>الوقت</th></tr></thead>
          <tbody>
            {loading && rows.length === 0 && (
              <tr><td colSpan={5} className="py-14 text-center text-muted-foreground"><Loader2 size={20} className="mx-auto mb-2 animate-spin" />جارِ تحميل سجل النشاط...</td></tr>
            )}
            {rows.map((a) => (
              <tr key={a._id} className="border-b last:border-0 hover:bg-muted/40">
                <td className={tdCls}><Badge tone="slate">{ACTIVITY_TYPE_LABELS[a.type] || a.type}</Badge></td>
                <td className={tdCls}>{a.description}</td>
                <td className={tdCls}>{a.amount > 0 ? fmtMoney(a.amount) : '—'}</td>
                <td className={tdCls}>{fmtDate(a.date)}</td>
                <td className={tdCls}>{fmtTime(a.date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && rows.length === 0 && <Empty text="لا توجد نشاطات مطابقة" />}
        <Pagination page={page} totalPages={pagination?.totalPages} total={pagination?.total} onChange={setPage} />
      </div>
    </div>
  );
}

export default ActivityPage;
