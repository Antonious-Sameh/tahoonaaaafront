export function Badge({ tone, children }) {
  const tones = {
    green: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    red: 'bg-red-50 text-red-700 ring-1 ring-red-200',
    amber: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
    blue: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
    slate: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
  };
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${tones[tone] || tones.slate}`}>
      {children}
    </span>
  );
}

export default Badge;
