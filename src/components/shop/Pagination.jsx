import { ChevronRight, ChevronLeft } from 'lucide-react';

/**
 * Simple prev/next pager for API-backed lists (see useApiList). Renders
 * nothing for a single page — most pages won't need to reserve layout space
 * for a pager that never applies.
 */
export function Pagination({ page, totalPages, onChange, total }) {
  if (!totalPages || totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between border-t border-border px-3 py-3 text-sm">
      <span className="text-muted-foreground">
        {typeof total === 'number' ? `${total} نتيجة — ` : ''}صفحة {page} من {totalPages}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
          title="السابق"
        >
          <ChevronRight size={15} />
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
          title="التالي"
        >
          <ChevronLeft size={15} />
        </button>
      </div>
    </div>
  );
}

export default Pagination;
