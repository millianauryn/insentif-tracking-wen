// Filter atasan (parent) untuk form Jabatan User.
// Pilih cabang dulu → hanya atasan yang link ke cabang itu yang boleh terlihat.

// posisi: [{ id, position_type, active, branch_ids }]
// branchIds: cabang yang dipilih di form ([] → belum ada pilihan → tidak ada kandidat)
export function parentOptionsFor(positions, type, branchIds) {
  const want = type === 'SPV' ? 'BM' : type === 'SALES' ? 'SPV' : null;
  if (!want) return [];
  const picked = (branchIds || []).map(Number);
  if (!picked.length) return [];
  return (positions || []).filter(
    (p) => p.position_type === want && p.active && (p.branch_ids || []).some((id) => picked.includes(Number(id))),
  );
}

// Setelah cabang diganti, atasan terpilih yang tidak lagi berada di cabang baru dibuang —
// supaya form tidak mengirim parent di luar cabang yang dipilih.
export function keepValidParent(positions, branchIds, parentId) {
  if (!parentId) return '';
  const parent = (positions || []).find((p) => String(p.id) === String(parentId));
  if (!parent) return '';
  const picked = (branchIds || []).map(Number);
  return (parent.branch_ids || []).some((id) => picked.includes(Number(id))) ? parentId : '';
}
