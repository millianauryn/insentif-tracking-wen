const INITIALS_RE = /^([^\s]+)\s?([^\s]+)?$/;

// Chip akun: lingkaran warna + emoji pilihan superadmin; tanpa emoji → inisial nama.
export default function Avatar({ name, color = '#5C786C', emoji, size = 'md', ring = false }) {
  const sizes = {
    sm: 'h-6 w-6 text-[11px]',
    md: 'h-8 w-8 text-[13px]',
    lg: 'h-10 w-10 text-[15px]',
  };
  const cls = `${sizes[size]} flex shrink-0 items-center justify-center rounded-full font-bold text-white ${ring ? 'ring-2 ring-white' : ''}`;
  if (emoji) return <span className={cls} style={{ background: color }} role="img" aria-label={name}>{emoji}</span>;
  const m = name?.match(INITIALS_RE);
  const initials = m ? `${m[1][0]}${m[2]?.[0] || ''}`.toUpperCase() : '?';
  return <span className={cls} style={{ background: color }}>{initials}</span>;
}
