import { useEffect, useState } from 'react';

// Debounces a fast-changing value (e.g. a search input) so filtering only
// runs after the user pauses typing, instead of on every keystroke.
export function useDebounce(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default useDebounce;
