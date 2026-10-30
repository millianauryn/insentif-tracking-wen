import { describe, expect, it } from 'vitest'
import { calculateRow, calculateTotals } from './incentive'

describe('incentive calculations', () => {
  it('calculates percentage and marks rows with at least 100 percent as achieved', () => {
    expect(calculateRow({ principal: 'Unilever', brand: 'Pepsodent', target: 100, achievement: 120 })).toMatchObject({
      percentage: 120,
      status: 'Tercapai',
    })
  })

  it('marks rows below 100 percent as failed', () => {
    expect(calculateRow({ target: 100, achievement: 99 })).toMatchObject({
      percentage: 99,
      status: 'Gugur',
    })
  })

  it('calculates totals from filled rows', () => {
    expect(calculateTotals([
      { principal: 'Unilever', brand: 'Pepsodent', target: 100, achievement: 120 },
      { principal: 'Mayora', brand: 'Roma', target: 50, achievement: 25 },
      { principal: '', brand: '', target: 1000, achievement: 1000 },
    ])).toMatchObject({
      target: 150,
      achievement: 145,
      percentage: 96.66666666666667,
      status: 'Gugur',
    })
  })
})
