import { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ open, onClose, title, subtitle, children, width = 'max-w-xl' }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-ink-900/40" onClick={onClose} />
      <div className={`panel relative w-full ${width} max-h-[92vh] overflow-y-auto rounded-b-none shadow-pop animate-fadeUp sm:rounded-2xl`}>
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white px-4 py-4 sm:px-6 sm:rounded-t-2xl">
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-bold leading-snug text-ink-900 break-words">{title}</h3>
            {subtitle && <p className="mt-0.5 break-words text-[13px] text-ink-500">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="shrink-0 rounded-lg p-2 text-ink-400 hover:bg-slate-100 hover:text-ink-700" aria-label="Tutup">
            <X size={18} />
          </button>
        </div>
        <div className="px-4 py-5 sm:px-6">{children}</div>
      </div>
    </div>
  );
}