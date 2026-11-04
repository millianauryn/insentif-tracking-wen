import { useState } from 'react';

// Searchable multi-select checkbox picker.
// variant: 'inline'  → panel always visible (cabang pickers)
//          'dropdown' → collapsed until trigger clicked (produk)
// items: [{ id, name, subtitle? }] — subtitle renders as group header when present.
export default function PickerChips({
  label,
  hint,
  required = false,
  items,
  selected,
  onChange,
  searchPlaceholder = 'Cari...',
  variant = 'inline',
  canEdit = true,
}) {
  const [open, setOpen] = useState(variant === 'inline');
  const [q, setQ] = useState('');

  const filtered = items.filter((i) =>
    `${i.name} ${i.subtitle || ''}`.toLowerCase().includes(q.trim().toLowerCase())
  );
  const allSelected = items.length > 0 && items.every((i) => selected.includes(i.id));

  const toggle = (id) => {
    if (!canEdit) return;
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };
  const toggleAll = () => {
    if (!canEdit) return;
    onChange(allSelected ? [] : items.map((i) => i.id));
  };

  // group by subtitle (preserves item order)
  const groups = [];
  for (const it of filtered) {
    const key = it.subtitle || '';
    let last = groups[groups.length - 1];
    if (!last || last.key !== key) {
      last = { key, items: [] };
      groups.push(last);
    }
    last.items.push(it);
  }

  const header = (
    <div className="flex items-center justify-between gap-2 mb-2">
      <label className="text-[13px] font-semibold">
        {label}{required ? ' *' : ''}{hint ? <span className="text-ink-400 font-normal"> {hint}</span> : null}{' '}
        <span className="text-ink-500 font-normal">({selected.length} terpilih)</span>
      </label>
      <div className="flex gap-1.5">
        <button type="button" className="button secondary text-[11px] px-2 py-1" onClick={toggleAll} disabled={!canEdit}>
          {allSelected ? 'Lepas Semua' : 'Semua'}
        </button>
        <button type="button" className="button secondary text-[11px] px-2 py-1" onClick={() => onChange([])} disabled={!canEdit}>
          Kosongkan
        </button>
        {variant === 'dropdown' && (
          <button type="button" className="button secondary text-[11px] px-2 py-1" onClick={() => setOpen((o) => !o)}>
            {open ? 'Tutup' : 'Pilih ▾'}
          </button>
        )}
      </div>
    </div>
  );

  const panel = (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={searchPlaceholder}
          disabled={!canEdit}
          className="w-full border-0 bg-transparent text-[13px] focus:outline-none disabled:cursor-not-allowed"
        />
      </div>
      <div className="max-h-[260px] overflow-y-auto p-2 space-y-2.5">
        {groups.map((g, gi) => (
          <div key={g.key || `g${gi}`}>
            {g.key && <p className="text-[11px] font-bold uppercase tracking-wide text-ink-400 mb-1.5 px-1">{g.key}</p>}
            <div className="flex flex-wrap gap-1.5">
              {g.items.map((item) => {
                const checked = selected.includes(item.id);
                return (
                  <label
                    key={String(item.id)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[12px] cursor-pointer transition ${checked ? 'bg-brand-50 border-brand-600 text-brand-800 font-semibold' : 'bg-white border-slate-200 text-ink-700 hover:bg-slate-50'}`}
                  >
                    <input type="checkbox" checked={checked} onChange={() => toggle(item.id)} disabled={!canEdit} className="sr-only" />
                    {item.name}
                  </label>
                );
              })}
            </div>
          </div>
        ))}
        {!filtered.length && <p className="text-[12px] text-ink-400 text-center py-3">Tidak ada yang cocok.</p>}
      </div>
    </div>
  );

  return (
    <div>
      {header}
      {open && panel}
    </div>
  );
}
