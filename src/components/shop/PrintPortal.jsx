import { createPortal } from 'react-dom';

export function PrintPortal({ children }) {
  const el = document.getElementById('print-portal');
  if (!el) return null;
  return createPortal(children, el);
}

export default PrintPortal;
