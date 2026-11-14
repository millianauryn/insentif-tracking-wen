import { useState } from 'react';

// Combobox: type free text OR pick from the list. Panel opens directly below the
// input, with a searchbar on top of the option list (same UX as the cabang picker).
// options: [{ value, hint? }] — hint shows right-aligned (e.g. position type).
export default function ComboSelect({
  value,
  onChange,
  options,
  placeholder = 'Pilih atau ketik...',
  disabled = false,
  emptyHint = 'Tidak ada pilihan.',
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  // Also match on the query without a trailing year, so "Februari 2027" still shows "Februari"
  const q = query.trim().toLowerCase();
  const qBase = q.replace(/\s+\d{4}$/, '');
  const filtered = options.filter((o) => {
    const v = o.value.toLowerCase();
    return v.includes(q) || (qBase !== q && v.includes(qBase));
  });

  // picked=true only when chosen from the list — lets callers tell "pick" from "free typing"
  const pick = (v) => {
    onChange(v, true);
    setOpen(false);
    setQuery('');
  };

  return (
    <span
      className="relative block"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <input
        value={value}
        onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => { setOpen(true); setQuery(''); }}
        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && (
        <span data-ui className="absolute left-0 right-0 top-full mt-1 z-20 block rounded-xl border border-slate-200 bg-white shadow-lg">
          <span className="block border-b border-slate-100 px-3 py-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari..."
              disabled={disabled}
              className="w-full border-0 bg-transparent text-[13px] focus:outline-none disabled:cursor-not-allowed"
            />
          </span>
          <span className="block max-h-[220px] overflow-y-auto">
            {filtered.map((o, i) => (
              <button
                key={`${o.value}-${i}`}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); pick(o.value); }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] hover:bg-slate-50"
              >
                <span className="font-medium text-ink-900">{o.value}</span>
                {o.hint && <span className="text-[11px] text-ink-400">{o.hint}</span>}
              </button>
            ))}
            {!filtered.length && <span className="block px-3 py-3 text-[12px] text-ink-400">{emptyHint}</span>}
          </span>
        </span>
      )}
    </span>
  );
}
