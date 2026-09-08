import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
import { btnDanger, btnOutline } from './styles';

export function Confirm({ open, onClose, onConfirm, title, description }) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-50">
            <AlertTriangle size={16} className="text-destructive" />
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
        </div>
        <div className="flex justify-end gap-2">
          <button className={btnOutline} onClick={onClose}>إلغاء</button>
          <button className={btnDanger} onClick={() => { onConfirm(); onClose(); }}>تأكيد الحذف</button>
        </div>
      </div>
    </Modal>
  );
}

export default Confirm;
