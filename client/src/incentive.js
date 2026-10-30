export const STORAGE_KEY = 'incentive-sales-rows'

export const PRINCIPAL_OPTIONS = [
  {
    name: 'Unilever',
    brands: ['Pepsodent', 'Lifebuoy', 'Sunsilk', 'Rinso'],
  },
  {
    name: 'Procter & Gamble',
    brands: ['Pampers', 'Head & Shoulders', 'Pantene', 'Gillette'],
  },
  {
    name: 'Mayora',
    brands: ['Kopiko', 'Roma', 'Torabika', 'Beng-Beng'],
  },
]

export function calculateRow(row) {
  const target = Number(row.target) || 0
  const achievement = Number(row.achievement) || 0
  const percentage = target > 0 ? (achievement / target) * 100 : 0

  return {
    ...row,
    target,
    achievement,
    percentage,
    status: target > 0 && percentage >= 100 ? 'Tercapai' : 'Gugur',
  }
}

export function calculateTotals(rows) {
  const filledRows = rows.filter((row) => row.principal && row.brand)
  const target = filledRows.reduce((sum, row) => sum + (Number(row.target) || 0), 0)
  const achievement = filledRows.reduce(
    (sum, row) => sum + (Number(row.achievement) || 0),
    0,
  )

  return {
    target,
    achievement,
    percentage: target > 0 ? (achievement / target) * 100 : 0,
    status: target > 0 && achievement / target >= 1 ? 'Tercapai' : 'Gugur',
  }
}

export function createEmptyRow() {
  return {
    id: crypto.randomUUID(),
    principal: '',
    brand: '',
    target: '',
    achievement: '',
  }
}

export function loadRows(storage = globalThis.localStorage) {
  try {
    const saved = storage?.getItem(STORAGE_KEY)
    const rows = saved ? JSON.parse(saved) : []
    return Array.isArray(rows) && rows.length > 0 ? rows : [createEmptyRow()]
  } catch {
    return [createEmptyRow()]
  }
}

export function saveRows(rows, storage = globalThis.localStorage) {
  const filledRows = rows.filter((row) => row.principal && row.brand)
  storage?.setItem(STORAGE_KEY, JSON.stringify(filledRows))
}
