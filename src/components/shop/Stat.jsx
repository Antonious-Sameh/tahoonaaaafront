export function Stat({ title, value, icon: Icon, tone = 'bg-blue-50 text-blue-600' }) {
  return (
    <div className="group flex items-center gap-3.5 rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md hover:border-slate-300">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg shadow-xs transition-transform group-hover:scale-105 ${tone}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold text-muted-foreground truncate">{title}</div>
        <div className="mt-0.5 truncate text-xl font-bold tracking-tight text-foreground">{value}</div>
      </div>
    </div>
  );
}

export default Stat;