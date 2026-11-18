import { useEffect, useRef, useState } from 'react';
import { monthNames } from '../lib/period';
import './MonthPicker.css';

// Pemilih bulan berbentuk kalender: pilih tahun, lalu bulan. Tidak ada pilihan tanggal.
// value: "November 2026" (format periode di form dokumen).
export default function MonthPicker({ value, onChange, disabled = false, placeholder = 'Pilih bulan' }) {
  const names = monthNames();
  const parsed = /^(\w+) (\d{4})$/.exec(value || '');
  const selectedIndex = parsed ? names.indexOf(parsed[1]) : -1;
  const selectedYear = parsed ? Number(parsed[2]) : null;
  const [today] = useState(() => new Date());
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(selectedYear ?? today.getFullYear());
  const rootRef = useRef(null);

  // Tutup saat klik di luar atau tekan Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = () => {
    if (!open) setYear(selectedYear ?? today.getFullYear());
    setOpen((current) => !current);
  };

  const pick = (index) => {
    onChange(`${names[index]} ${year}`);
    setOpen(false);
  };

  return (
    <div className="month-picker" ref={rootRef}>
      <button
        type="button"
        className="month-picker-trigger"
        onClick={toggle}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {value || <span className="month-picker-placeholder">{placeholder}</span>}
      </button>
      {open && (
        <div className="month-picker-panel" role="dialog" aria-label="Pilih bulan">
          <div className="month-picker-head">
            <button type="button" aria-label="Tahun sebelumnya" onClick={() => setYear((y) => y - 1)}>«</button>
            <strong>{year}</strong>
            <button type="button" aria-label="Tahun berikutnya" onClick={() => setYear((y) => y + 1)}>»</button>
          </div>
          <div className="month-picker-grid">
            {names.map((name, index) => {
              const isSelected = index === selectedIndex && year === selectedYear;
              const isCurrent = index === today.getMonth() && year === today.getFullYear();
              const classes = ['month-picker-cell', isSelected && 'is-selected', isCurrent && 'is-current'].filter(Boolean).join(' ');
              return (
                <button key={name} type="button" className={classes} aria-pressed={isSelected} onClick={() => pick(index)}>
                  {name.slice(0, 3)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
