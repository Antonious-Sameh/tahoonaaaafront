import { Inbox } from 'lucide-react';
import { btn } from './styles';

export function Empty({ text, actionLabel, onAction, icon: Icon = Inbox }) {
  return (
    <div className="flex flex-col items-center gap-3 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Icon size={22} className="text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground">{text}</p>
      {actionLabel && onAction && (
        <button className={`${btn} !h-9`} onClick={onAction}>{actionLabel}</button>
      )}
    </div>
  );
}

export default Empty;
