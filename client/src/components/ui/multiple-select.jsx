import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

// Pemilih produk: klik box → panel pencarian berisi tag produk.
// Klik tag pada panel → tag berpindah ke box produk; klik × pada box → kembali ke panel.
// Kontrak onChange tetap sama: array item { key, name }.
export const MultipleSelect = ({
  tags,
  onChange,
  defaultValue,
  label = 'Produk',
}) => {
  const [selected, setSelected] = useState(defaultValue ?? []);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);
  const searchRef = useRef(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onChangeRef.current?.(selected);
  }, [selected]);

  useEffect(() => {
    if (!open) return undefined;
    searchRef.current?.focus();
    const onDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const add = (item) => setSelected((prev) => [...prev, item]);
  const remove = (item) => setSelected((prev) => prev.filter((i) => i.key !== item.key));

  const available = tags.filter((item) =>
    !selected.some((i) => i.key === item.key)
    && item.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="relative flex w-full flex-col gap-[7px]" ref={rootRef}>
      <span className="text-xs font-semibold text-ink-700">{label}</span>

      <button
        type="button"
        className="flex min-h-[37px] w-full items-center gap-1.5 rounded-md border border-solid border-gray-200 bg-gray-50 p-1 text-left hover:border-gray-300"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto whitespace-nowrap">
          {selected.length ? selected.map((item) => (
            <span key={item.key} className="inline-flex shrink-0 items-center gap-1 rounded-md bg-white px-1.5 py-0.5 text-[13px] shadow-sm">
              <span>{item.name}</span>
              <span
                role="button"
                tabIndex={0}
                aria-label={`Hapus ${item.name}`}
                className="cursor-pointer text-gray-500 hover:text-gray-800"
                onClick={(event) => { event.stopPropagation(); remove(item); }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    event.stopPropagation();
                    remove(item);
                  }
                }}
              >
                <X size={12} />
              </span>
            </span>
          )) : (
            <span className="px-1 text-[13px] text-gray-400">Cari atau pilih produk...</span>
          )}
        </span>
        <ChevronDown size={15} className="mr-1 shrink-0 text-gray-500" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1.5 rounded-md border border-gray-200 bg-white p-2 shadow-lg">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari produk..."
              aria-label="Cari produk"
              className="w-full rounded-md border border-gray-200 bg-white py-1.5 text-[13px] outline-none focus:border-[#0c5848]"
              style={{ paddingLeft: 34, paddingRight: 8 }}
            />
          </div>
          <div className="mt-2 flex max-h-52 flex-wrap gap-1.5 overflow-y-auto" role="listbox" aria-label="Daftar produk">
            {available.length ? available.map((item) => (
              <button
                key={item.key}
                type="button"
                className="rounded-md bg-gray-200 px-2 py-1 text-[13px] text-ink-700 hover:bg-gray-300"
                onClick={() => add(item)}
              >
                {item.name}
              </button>
            )) : (
              <p className="px-1 py-2 text-[13px] text-gray-500">
                {query ? 'Tidak ada produk cocok.' : 'Semua produk sudah dipilih.'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
