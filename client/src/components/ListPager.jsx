import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function ListPager({ page, pages, total, limit, onPage, onLimit }) {
  if (total <= 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 mt-3 text-[13px] text-ink-600">
      <p className="whitespace-nowrap">
        Menampilkan <span className="font-semibold">{((page - 1) * limit) + 1}</span>–{' '}
        <span className="font-semibold">{Math.min(page * limit, total)}</span> dari{' '}
        <span className="font-semibold">{total}</span> data
      </p>
      <div className="flex flex-nowrap items-center gap-1.5 shrink-0">
        <select value={limit} onChange={(e) => onLimit(Number(e.target.value))} className="input h-[26px] w-[112px] px-2 text-[12px] leading-none" style={{ minHeight: 26, padding: '0 6px' }}>
          {[10, 25, 50, 100].map((l) => (
            <option key={l} value={l}>{l} per halaman</option>
          ))}
        </select>
        <button
          className="btn-ghost h-7 w-7 p-0 flex items-center justify-center shrink-0"
          onClick={() => onPage(page - 1)}
          disabled={page === 1}
          aria-label="Halaman sebelumnya"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="shrink-0 whitespace-nowrap tabular-nums px-1 font-semibold text-ink-900">{page}&nbsp;/&nbsp;{pages}</span>
        <button
          className="btn-ghost h-7 w-7 p-0 flex items-center justify-center shrink-0"
          onClick={() => onPage(page + 1)}
          disabled={page === pages}
          aria-label="Halaman selanjutnya"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}