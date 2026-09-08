import { useMemo, useRef, useState } from 'react';
import { Search, X, ChevronDown } from 'lucide-react';

/**
 * Lightweight searchable dropdown ("combobox") used wherever a plain <select>
 * becomes slow to scan — e.g. picking a customer or a product from a long list.
 * Pure UI: the caller owns the selected id/value and the option list, so it
 * drops in anywhere a <select> was used before without touching data flow.
 */
export function SearchSelect({
  options, // [{ id, label, sublabel }]
  value,
  onChange,
  placeholder = 'اختر...',
  searchPlaceholder = 'ابحث...',
  emptyText = 'لا توجد نتائج',
  clearable = true,
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const inputRef = useRef(null);

  const selected = useMemo(() => options.find((o) => o.id === value) || null, [options, value]);

  const filtered = useMemo(() => {
    const query = q.trim();
    if (!query) return options;
    return options.filter(
      (o) => o.label.includes(query) || (o.sublabel && o.sublabel.includes(query))
    );
  }, [options, q]);

  const openList = () => {
    setOpen(true);
    setQ('');
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const pick = (id) => {
    onChange(id);
    setOpen(false);
    setQ('');
  };

  return (
    <div className="relative">
      {!open ? (
        <button
          type="button"
          onClick={openList}
          className="flex h-10 w-full items-center gap-2 rounded-md border border-input bg-card px-3 text-sm text-foreground outline-none transition-shadow hover:bg-muted/50 focus:border-ring focus:ring-2 focus:ring-ring/20"
        >
          <Search size={14} className="shrink-0 text-muted-foreground" />
          <span className={`flex-1 truncate text-start ${selected ? '' : 'text-muted-foreground/70'}`}>
            {selected ? selected.label : placeholder}
          </span>
          {clearable && selected ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onChange(''); }}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X size={13} />
            </span>
          ) : (
            <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
          )}
        </button>
      ) : (
        <div className="relative">
          <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={inputRef}
            className="h-10 w-full rounded-md border border-ring bg-card ps-9 pe-3 text-sm outline-none ring-2 ring-ring/20 placeholder:text-muted-foreground/60"
            placeholder={searchPlaceholder}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
          />
        </div>
      )}

      {open && (
        <div className="absolute start-0 end-0 top-11 z-50 max-h-56 overflow-y-auto rounded-md border border-border bg-card shadow-xl">
          {clearable && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick('')}
              className={`flex w-full items-center px-3 py-2 text-start text-sm transition-colors hover:bg-muted ${!value ? 'font-semibold text-primary' : 'text-muted-foreground'}`}
            >
              {placeholder}
            </button>
          )}
          {filtered.length === 0 && (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">{emptyText}</div>
          )}
          {filtered.map((o) => (
            <button
              key={o.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(o.id)}
              className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-sm transition-colors hover:bg-muted ${o.id === value ? 'bg-accent/60 font-semibold text-foreground' : 'text-foreground'}`}
            >
              <span className="truncate">{o.label}</span>
              {o.sublabel && <span className="shrink-0 text-xs text-muted-foreground">{o.sublabel}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default SearchSelect;
