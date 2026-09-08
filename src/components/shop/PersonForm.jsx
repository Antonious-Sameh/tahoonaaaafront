import { useState } from 'react';
import { toast } from 'sonner';
import { Modal } from './Modal';
import { Field } from './Field';
import { inp, btn, btnOutline } from './styles';

export function PersonForm({ initial, onSubmit, onClose, title }) {
  const [form, setForm] = useState(initial || { name: '', phone: '', address: '' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <Modal open onClose={onClose} title={title}>
      <div className="grid gap-3">
        <Field label="الاسم"><input className={inp} value={form.name} onChange={set('name')} /></Field>
        <Field label="الهاتف"><input className={inp} value={form.phone} onChange={set('phone')} /></Field>
        <Field label="العنوان"><input className={inp} value={form.address} onChange={set('address')} /></Field>
        <div className="mt-2 flex gap-2">
          <button className={btn} onClick={() => { if (!form.name.trim()) { toast.error('من فضلك أكمل البيانات المطلوبة'); return; } onSubmit(form); }}>حفظ</button>
          <button className={btnOutline} onClick={onClose}>إلغاء</button>
        </div>
      </div>
    </Modal>
  );
}

export default PersonForm;
