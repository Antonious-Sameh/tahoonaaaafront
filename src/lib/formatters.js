export const fmtMoney = (n) => `${Number(n || 0).toLocaleString('en-US')} ج.م`;

export const fmtNum = (n) => Number(n || 0).toLocaleString('en-US');

export const fmtDate = (d) => new Date(d).toLocaleDateString('en-GB');

export const fmtTime = (d) => {
  const t = new Date(d);
  let h = t.getHours();
  const m = String(t.getMinutes()).padStart(2, '0');
  const period = h >= 12 ? 'م' : 'ص';
  h = h % 12 || 12;
  return `${h}:${m} ${period}`;
};

export const fmtDateTime = (d) => `${fmtDate(d)} - ${fmtTime(d)}`;

export const isToday = (d) => {
  const t = new Date(d);
  const n = new Date();
  return t.getFullYear() === n.getFullYear() && t.getMonth() === n.getMonth() && t.getDate() === n.getDate();
};

export const todayInputValue = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

export const PAYMENT_LABELS = { cash: 'نقدي', credit: 'آجل' };

export const ACTIVITY_TYPE_LABELS = {
  sale: 'مبيعات',
  purchase: 'مشتريات',
  expense: 'مصروفات',
  cash: 'صندوق',
  product: 'مخزون',
  customer: 'عملاء',
  supplier: 'موردين',
  settings: 'إعدادات',
};

export const EXPENSE_SUGGESTIONS = ['مرتبات', 'أجور', 'كهرباء', 'إيجار', 'نقل', 'أكل', 'صيانة', 'أخرى'];
