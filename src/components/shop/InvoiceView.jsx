import { fmtMoney, fmtDate, fmtTime, PAYMENT_LABELS } from '@/lib/formatters';

export function InvoiceView({ sale, customer, settings }) {
  if (!sale) return null;

  const paymentText = (sale.paymentMethod && PAYMENT_LABELS[sale.paymentMethod]) 
    ? PAYMENT_LABELS[sale.paymentMethod] 
    : (sale.paymentMethod || 'نقداً');

  return (
    <div 
      dir="rtl" 
      className="mx-auto w-full max-w-[360px] rounded-2xl border border-slate-200 bg-white p-5 font-mono text-slate-800 shadow-lg relative select-none"
    >
      {/* Top Accent Stripe */}
      <div className="absolute top-0 inset-x-0 h-1.5 bg-slate-900 rounded-t-2xl" />

      {/* Store Header */}
      <div className="mb-4 text-center border-b border-dashed border-slate-300 pb-4 pt-1">
        <h2 className="text-xl font-black tracking-tight text-slate-900 font-sans">
          {settings?.shopName || 'اسم المتجر'}
        </h2>
        
        {(settings?.address || settings?.phone) && (
          <p className="mt-1 text-[11px] font-sans font-medium text-slate-500 leading-relaxed">
            {settings?.address}
            {settings?.address && settings?.phone && ' — '}
            {settings?.phone && <span dir="ltr">{settings.phone}</span>}
          </p>
        )}
      </div>

      {/* Invoice Meta Data */}
      <div className="mb-4 rounded-xl bg-slate-50/80 p-3 text-[11px] font-sans space-y-1.5 border border-slate-100">
        <div className="flex justify-between items-center">
          <span className="text-slate-400 font-medium">رقم الفاتورة:</span>
          <span className="font-mono font-bold text-slate-900 bg-slate-200/60 px-2 py-0.5 rounded">
            #{sale.invoiceNumber}
          </span>
        </div>
        
        <div className="flex justify-between items-center text-slate-500">
          <span className="text-slate-400 font-medium">التاريخ والوقت:</span>
          <span className="font-medium text-slate-700">
            {fmtDate(sale.date)} • {fmtTime(sale.date)}
          </span>
        </div>

        <div className="flex justify-between items-center border-t border-slate-200/60 pt-1.5 mt-1">
          <span className="text-slate-400 font-medium">العميل:</span>
          <span className="font-bold text-slate-800">
            {customer ? customer.name : 'عميل نقدي'}
            {customer?.phone && <span className="font-normal text-slate-400 text-[10px] pr-1">({customer.phone})</span>}
          </span>
        </div>
      </div>

      {/* Items List */}
      <div className="mb-4">
        <div className="flex justify-between border-b border-slate-300 pb-1.5 px-1 text-[11px] font-bold text-slate-400 font-sans">
          <span>الصنف</span>
          <div className="flex gap-4">
            <span>الكمية</span>
            <span className="w-16 text-end">الإجمالي</span>
          </div>
        </div>

        <div className="divide-y divide-slate-100 text-xs">
          {sale.items.map((i, idx) => (
            <div key={idx} className="py-2.5 flex justify-between items-center px-1 font-sans">
              <div className="pr-1 min-w-0 flex-1">
                <div className="font-bold text-slate-800 truncate text-[13px]">{i.name}</div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                  {i.code ? `${i.code} | ` : ''}{fmtMoney(i.price)}
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                <span className="font-bold text-slate-700 font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                  ×{i.quantity}
                </span>
                <span className="w-16 text-end font-bold text-slate-900 font-mono text-[13px]">
                  {fmtMoney(i.price * i.quantity)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Totals Section */}
      <div className="rounded-xl border border-dashed border-slate-300 p-3.5 space-y-2 text-xs font-sans bg-slate-50/50">
        {sale.discount > 0 && (
          <>
            <div className="flex justify-between text-slate-500">
              <span>إجمالي المنتجات</span>
              <span className="font-bold font-mono text-slate-700">{fmtMoney(sale.subtotal ?? sale.total + sale.discount)}</span>
            </div>
            <div className="flex justify-between text-red-600">
              <span>الخصم</span>
              <span className="font-bold font-mono">- {fmtMoney(sale.discount)}</span>
            </div>
          </>
        )}

        <div className="flex justify-between text-slate-600">
          <span>{sale.discount > 0 ? 'الإجمالي النهائي' : 'الإجمالي الكلي'}</span>
          <span className="font-bold font-mono text-slate-900 text-sm">{fmtMoney(sale.total)}</span>
        </div>

        <div className="flex justify-between text-slate-600">
          <span>المدفوع</span>
          <span className="font-bold font-mono text-emerald-600">{fmtMoney(sale.paid)}</span>
        </div>

        {sale.remaining > 0 ? (
          <div className="flex justify-between text-red-600 bg-red-50 p-1.5 rounded-lg font-bold border border-red-100">
            <span>المتبقي (آجل)</span>
            <span className="font-mono">{fmtMoney(sale.remaining)}</span>
          </div>
        ) : (
          <div className="flex justify-between text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg font-bold text-[11px]">
            <span>حالة الفاتورة</span>
            <span>مدفوع بالكامل</span>
          </div>
        )}

        <div className="flex justify-between border-t border-slate-200 pt-2 text-[11px] text-slate-500">
          <span>طريقة الدفع:</span>
          <span className="font-semibold text-slate-800">{paymentText}</span>
        </div>
      </div>

      {/* Thermal Receipt Barcode Visual & Footer */}
      <div className="mt-5 text-center font-sans space-y-3">
        {settings?.invoiceFooter && (
          <p className="text-[11px] text-slate-500 font-medium px-2 leading-relaxed border-t border-dashed border-slate-200 pt-3">
            {settings.invoiceFooter}
          </p>
        )}
        
        {/* Visual Barcode Pattern */}
        <div className="flex flex-col items-center justify-center gap-1 pt-1 opacity-60">
          <div className="h-7 w-40 bg-[repeating-linear-gradient(90deg,#000_0px,#000_2px,transparent_2px,transparent_4px,#000_4px,#000_6px,transparent_6px,transparent_7px,#000_7px,#000_10px)]" />
          <span className="text-[9px] font-mono text-slate-400 tracking-widest">#{sale.invoiceNumber}</span>
        </div>

        <p className="text-[9px] text-slate-400">تطوير: م. أنطونيوس سامح — 01223307593</p>
      </div>
    </div>
  );
}

export default InvoiceView;