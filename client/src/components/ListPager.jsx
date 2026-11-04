import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function ListPager({ page, pages, total, limit, onPage, onLimit }) {
  if (pages <= 1 && total <= limit) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 mt-3 text-[13px] text-ink-600">
      <p>
        Menampilkan <span className="font-semibold">{((page - 1) * limit) + 1}</span>–{' '}
        <span className="font-semibold">{Math.min(page * limit, total)}</span> dari{' '}
        <span className="font-semibold">{total}</span> data
      </p>
      <div className="flex items-center gap-1.5">
        <select value={limit} onChange={(e) => onLimit(Number(e.target.value))} className="input w-auto py-1.5 text-[12.5px]">
          {[10, 25, 50, 100].map((l) => (
            <option key={l} value={l}>{l} per halaman</option>
          ))}
        </select>
        <button
          className="btn-ghost p-1.5"
          onClick={() => onPage(page - 1)}
          disabled={page === 1}
          aria-label="Halaman sebelumnya"
        >
          <ChevronLeft size={15} />
        </button>
        <span className="px-2 font-semibold text-ink-900">{page} / {pages}</span>
        <button
          className="btn-ghost p-1.5"
          onClick={() => onPage(page + 1)}
          disabled={page === pages}
          aria-label="Halaman selanjutnya"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}