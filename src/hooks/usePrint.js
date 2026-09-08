import { useState } from 'react';

export function usePrint() {
  const [printing, setPrinting] = useState(false);
  const startPrint = () => {
    setPrinting(true);
    setTimeout(() => { window.print(); setPrinting(false); }, 150);
  };
  return [printing, startPrint];
}

export default usePrint;
