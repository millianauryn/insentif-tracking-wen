// Move item at fromIndex to toIndex. Returns the same reference for no-ops
// and out-of-range indexes so callers can skip state updates.
export function reorder(items, from, to) {
  if (from === to) return items;
  if (from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
