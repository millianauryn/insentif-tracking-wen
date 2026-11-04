import { useEffect, useState } from 'react';

// Debounce value — berguna untuk search input (hindari request berlebihan saat mengetik).
export default function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return debounced;
}