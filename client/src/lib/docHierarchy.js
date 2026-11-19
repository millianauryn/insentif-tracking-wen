import { branchRegionIds } from './orgTree';

// Filter dan urutan dokumen tersimpan mengikuti struktur jabatan:
// BM → SPV → Sales. Area/cabang diambil dari posisi (branch_id, turunan parent),
// dengan fallback nama kota pada kolom wilayah dokumen lama.

export function positionBranchId(pos, positions = []) {
  if (!pos) return null;
  if (pos.branch_id) return pos.branch_id;
  if (pos.branch_ids?.length) return pos.branch_ids[0];
  const parent = positions.find((p) => p.id === pos.parent_position_id);
  return parent ? positionBranchId(parent, positions) : null;
}

export function docPosition(doc, positions = [], positionByName = new Map()) {
  const id = Number(doc?.salesman_position_id || doc?.position_id || 0);
  return positions.find((p) => p.id === id) || positionByName.get(doc?.salesman) || null;
}

const sameCity = (doc, branch) => {
  const city = String(doc?.wilayah || '').trim().toLowerCase();
  return !!city && city === String(branch?.city || '').trim().toLowerCase();
};

export function docMatchesScope(doc, { areaId, branchId }, { positions = [], branches = [], positionByName = new Map() } = {}) {
  if (!areaId && !branchId) return true;
  const pos = docPosition(doc, positions, positionByName);
  const posBranchId = Number(positionBranchId(pos, positions) || 0);

  if (branchId) {
    const branch = branches.find((b) => Number(b.id) === Number(branchId));
    return posBranchId === Number(branchId) || (!posBranchId && sameCity(doc, branch));
  }
  if (areaId) {
    const areaBranches = branches.filter((b) => branchRegionIds(b).includes(Number(areaId)));
    return areaBranches.some((b) =>
      Number(b.id) === posBranchId || (!posBranchId && sameCity(doc, b)));
  }
  return true;
}

// Dokumen tampil bila rentang bulananya bersentuhan dengan rentang filter.
export function docMatchesPeriodeRange(doc, startApi, endApi) {
  if (!startApi || !endApi) return false;
  const start = String(doc?.period || '');
  const end = String(doc?.period_end || doc?.period || '');
  return !!start && start <= endApi && end >= startApi;
}

function hierarchyKey(doc, positions, positionByName) {
  const pos = docPosition(doc, positions, positionByName);
  const chain = [];
  let cur = pos;
  while (cur && chain.length < 4) {
    chain.unshift(cur);
    cur = positions.find((p) => p.id === cur.parent_position_id);
  }
  const bm = chain.find((p) => p.position_type === 'BM');
  const spv = chain.find((p) => p.position_type === 'SPV');
  const group = pos?.position_type === 'BM' ? 0 : pos?.position_type === 'SPV' ? 1 : pos?.position_type === 'SALES' ? 2 : 3;
  return {
    // Dokumen tanpa jabatan dikenal ditaruh paling akhir, bukan di depan BM.
    bm: pos ? Number(bm?.id || 999999) : 999999,
    spv: Number(spv?.id || 0),
    group,
    self: Number(pos?.id || 0),
  };
}

// Urutan: BM, lalu semua dokumen SPV, baru sales-salesnya per SPV.
export function sortDocsByHierarchy(docs, positions = [], positionByName = new Map()) {
  return [...docs].sort((a, b) => {
    const ka = hierarchyKey(a, positions, positionByName);
    const kb = hierarchyKey(b, positions, positionByName);
    return ka.bm - kb.bm
      || ka.group - kb.group
      || ka.spv - kb.spv
      || ka.self - kb.self
      || String(a.period || '').localeCompare(String(b.period || ''))
      || Number(a.id || 0) - Number(b.id || 0);
  });
}
