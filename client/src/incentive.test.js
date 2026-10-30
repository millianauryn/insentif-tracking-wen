import { describe, expect, it } from 'vitest'
import { calculateRow, calculateTotals, getDashboardMetrics } from './incentive'

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

  it('returns zero-safe dashboard metrics when no rows are filled', () => {
    expect(getDashboardMetrics([{ principal: 'Unilever', brand: 'Pepsodent', target: '', achievement: '' }])).toMatchObject({
      totalTarget: 0,
      totalAchievement: 0,
      percentage: 0,
      achievedCount: 0,
      failedCount: 0,
      documentCount: 0,
    })
  })

  it('derives dashboard status counts and monthly values from filled rows', () => {
    expect(getDashboardMetrics([
      { principal: 'Unilever', brand: 'Pepsodent', target: 100, achievement: 120 },
      { principal: 'Mayora', brand: 'Roma', target: 50, achievement: 25 },
    ])).toMatchObject({
      totalTarget: 150,
      totalAchievement: 145,
      percentage: 96.66666666666667,
      achievedCount: 1,
      failedCount: 1,
      documentCount: 2,
      monthly: [
        { label: 'Jul', target: 0, achievement: 0 },
        { label: 'Agu', target: 0, achievement: 0 },
        { label: 'Sep', target: 0, achievement: 0 },
        { label: 'Okt', target: 150, achievement: 145 },
      ],
    })
  })
})
