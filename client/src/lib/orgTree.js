// Susun tree dashboard: area → wilayah → cabang → jabatan user (BM → SPV → SALES).
// Pemisahan dari halaman supaya bisa diuji tanpa render React.

// Cabang → area: pakai junction branch_regions, fallback ke region_id utama.
export function branchRegionIds(branch) {
  const ids = (branch.regions || []).map((r) => r.id);
  if (!ids.length && branch.region_id) ids.push(branch.region_id);
  return ids;
}

export function cityOf(branch) {
  return branch.city || '(tanpa wilayah)';
}

// Pool cabang setelah filter area / wilayah / cabang diterapkan (AND).
export function filterBranches(branches, { areaId, city, branchId } = {}) {
  let pool = branches;
  if (areaId) pool = pool.filter((b) => branchRegionIds(b).includes(Number(areaId)));
  if (city) pool = pool.filter((b) => cityOf(b) === city);
  if (branchId) pool = pool.filter((b) => String(b.id) === String(branchId));
  return pool;
}

// Susun tree dari pool cabang. positions sudah aktif (active = 1).
export function buildOrgTree({ regions = [], branches = [], positions = [] }) {
  const positionsOfBranch = (b) => positions.filter((p) => p.branch_id === b.id || (p.branch_ids || []).includes(b.id));
  const posNode = (p, list) => ({
    key: `p-${p.id}`,
    kind: 'position',
    label: p.name,
    position: p,
    children: list.filter((c) => c.parent_position_id === p.id).map((c) => posNode(c, list)),
  });
  const branchNode = (b) => {
    const list = positionsOfBranch(b);
    const roots = list.filter((p) => !p.parent_position_id || !list.some((x) => x.id === p.parent_position_id));
    return {
      key: `b-${b.id}`,
      kind: 'cabang',
      badge: 'CABANG',
      label: b.name,
      children: roots.map((p) => posNode(p, list)),
    };
  };
  const cityNodes = (pool) => {
    const byCity = new Map();
    for (const b of pool) {
      const key = cityOf(b);
      if (!byCity.has(key)) byCity.set(key, []);
      byCity.get(key).push(b);
    }
    return [...byCity.entries()]
      .sort((a, b2) => a[0].localeCompare(b2[0]))
      .map(([name, list]) => ({
        key: `w-${name}`,
        kind: 'wilayah',
        badge: 'WILAYAH',
        label: name,
        children: list.sort((a, b2) => a.name.localeCompare(b2.name)).map(branchNode),
      }));
  };

  const areaNodes = regions
    .map((r) => ({
      key: `a-${r.id}`,
      kind: 'area',
      badge: 'AREA',
      label: r.name,
      children: cityNodes(branches.filter((b) => branchRegionIds(b).includes(r.id))),
    }))
    .filter((n) => n.children.length);

  // Cabang tanpa area tetap tampil, jangan hilang dari tree.
  const unassigned = branches.filter((b) => !branchRegionIds(b).length);
  if (unassigned.length) {
    areaNodes.push({
      key: 'a-none',
      kind: 'area',
      badge: 'AREA',
      label: '(tanpa area)',
      children: cityNodes(unassigned),
    });
  }
  return areaNodes;
}

// Pencarian: cocokkan nama area/wilayah/cabang/jabatan (atau tipe jabatan: bm/spv/sales).
// Simpul yang cocok → seluruh subtree ikut; yang tidak → tampil hanya bila ada keturunan
// yang cocok (ancestor tidak hilang dari hasil).
export function pruneTree(tree, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return tree;
  const matches = (node) => {
    if (node.kind === 'position') {
      const p = node.position;
      return (p.name || '').toLowerCase().includes(q)
        || (p.sales_code || '').toLowerCase().includes(q)
        || (p.position_type || '').toLowerCase().includes(q);
    }
    return (node.label || '').toLowerCase().includes(q);
  };
  const prune = (nodes) => {
    const out = [];
    for (const n of nodes) {
      const kids = prune(n.children || []);
      if (matches(n)) out.push({ ...n, children: n.children || [] });
      else if (kids.length) out.push({ ...n, children: kids });
    }
    return out;
  };
  return prune(tree);
}

// Jumlah simpul position bertipe tertentu dalam tree (default: semua).
export function countPositions(nodes, type) {
  return (nodes || []).reduce(
    (sum, n) => sum
      + (n.kind === 'position' && (!type || n.position.position_type === type) ? 1 : 0)
      + countPositions(n.children, type),
    0,
  );
}
