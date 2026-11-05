import { Search } from 'lucide-react';

export default function SearchBox({ value, onSearch, placeholder = 'Cari…', className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(e) => onSearch(e.target.value)}
        placeholder={placeholder}
        className="input pl-9 pr-3 py-2 w-full min-w-[180px] sm:min-w-[220px]"
        style={{ paddingLeft: 36 }}
        autoComplete="off"
      />
    </div>
  );
}