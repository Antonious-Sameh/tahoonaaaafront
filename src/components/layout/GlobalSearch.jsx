import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Package, Users, Truck, Receipt, Loader2 } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { fmtMoney } from '@/lib/formatters';
import * as productsApi from '@/services/api/products';
import * as customersApi from '@/services/api/customers';
import * as suppliersApi from '@/services/api/suppliers';
import * as salesApi from '@/services/api/sales';

const RESULT_LIMIT = 4;

export function GlobalSearch() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const query = useDebounce(q.trim());

  useEffect(() => {
    if (!query) { setResults(null); return; }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      productsApi.listProducts({ search: query, limit: RESULT_LIMIT }),
      customersApi.listCustomers({ search: query, limit: RESULT_LIMIT }),
      suppliersApi.listSuppliers({ search: query, limit: RESULT_LIMIT }),
      salesApi.listSales({ search: query, limit: RESULT_LIMIT }),
    ])
      .then(([productsRes, customersRes, suppliersRes, salesRes]) => {
        if (cancelled) return;
        setResults({
          products: productsRes.data,
          customers: customersRes.data,
          suppliers: suppliersRes.data,
          sales: salesRes.data,
        });
      })
      .catch(() => {
        if (!cancelled) setResults({ products: [], customers: [], suppliers: [], sales: [] });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [query]);

  const hasAny = results && (results.products.length + results.customers.length + results.suppliers.length + results.sales.length > 0);
  const go = (path) => { setOpen(false); setQ(''); navigate(path); };

  return (
    <div className="relative min-w-0 flex-1 max-w-sm">
      <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <input
        className="h-9 w-full rounded-md border border-input bg-background ps-8 pe-3 text-sm outline-none transition-shadow focus:border-ring focus:ring-2 focus:ring-ring/20 placeholder:text-muted-foreground/60"
        placeholder="بحث..."
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
      />
      {open && query && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute start-0 end-0 top-11 z-50 max-h-80 overflow-y-auto rounded-lg border border-border bg-card shadow-xl">
            {loading && !results && (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground"><Loader2 size={16} className="mx-auto mb-1 animate-spin" />جارِ البحث...</div>
            )}
            {results && !hasAny && <div className="px-4 py-6 text-center text-sm text-muted-foreground">لا توجد نتائج لـ «{query}»</div>}

            {results?.products.length > 0 && (
              <>
                <div className="border-b border-border px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">منتجات</div>
                {results.products.map((p) => (
                  <button key={p._id} onClick={() => go(`/inventory?search=${encodeURIComponent(p.name)}`)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-start text-sm text-foreground transition-colors hover:bg-muted">
                    <Package size={14} className="shrink-0 text-primary" />
                    <span className="flex-1">{p.name}</span>
                    <span className="text-xs text-muted-foreground">{p.code}</span>
                  </button>
                ))}
              </>
            )}

            {results?.customers.length > 0 && (
              <>
                <div className="border-b border-border px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">عملاء</div>
                {results.customers.map((c) => (
                  <button key={c._id} onClick={() => go(`/customers/${c._id}`)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-start text-sm text-foreground transition-colors hover:bg-muted">
                    <Users size={14} className="shrink-0 text-primary" />
                    {c.name}
                  </button>
                ))}
              </>
            )}

            {results?.suppliers.length > 0 && (
              <>
                <div className="border-b border-border px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">موردون</div>
                {results.suppliers.map((s) => (
                  <button key={s._id} onClick={() => go(`/suppliers/${s._id}`)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-start text-sm text-foreground transition-colors hover:bg-muted">
                    <Truck size={14} className="shrink-0 text-primary" />
                    {s.name}
                  </button>
                ))}
              </>
            )}

            {results?.sales.length > 0 && (
              <>
                <div className="border-b border-border px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">فواتير</div>
                {results.sales.map((s) => (
                  <button key={s._id} onClick={() => go(`/sales/history?search=${s.invoiceNumber}`)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-start text-sm text-foreground transition-colors hover:bg-muted">
                    <Receipt size={14} className="shrink-0 text-primary" />
                    <span className="flex-1">{s.invoiceNumber}</span>
                    <span className="text-xs text-muted-foreground">{fmtMoney(s.total)}</span>
                  </button>
                ))}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default GlobalSearch;
