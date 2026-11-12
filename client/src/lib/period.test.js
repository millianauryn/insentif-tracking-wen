import { describe, expect, it } from 'vitest'
import { toApiPeriod, fromApiPeriod, PERIOD_OPTIONS, monthNames, periodRangeLabel, apiMonthsInRange } from './period'

describe('period helpers', () => {
  it('converts Indonesian month labels to YYYY-MM', () => {
    expect(toApiPeriod('Oktober 2026')).toBe('2026-10')
    expect(toApiPeriod('Desember 2026')).toBe('2026-12')
  })

  it('passes through values already in YYYY-MM shape', () => {
    expect(toApiPeriod('2026-10')).toBe('2026-10')
  })

  it('renders YYYY-MM back to Indonesian month labels', () => {
    expect(fromApiPeriod('2026-10')).toBe('Oktober 2026')
    expect(fromApiPeriod('2026-12')).toBe('Desember 2026')
  })

  it('round-trips every offered period option', () => {
    for (const option of PERIOD_OPTIONS) {
      expect(fromApiPeriod(toApiPeriod(option))).toBe(option)
    }
  })

  it('survives malformed input', () => {
    expect(toApiPeriod('')).toBe('')
    expect(fromApiPeriod('')).toBe('')
    expect(fromApiPeriod('bogus')).toBe('bogus')
  })

  it('monthNames returns 12 bare month labels', () => {
    const names = monthNames()
    expect(names).toHaveLength(12)
    expect(names[0]).toBe('Januari')
    expect(names[11]).toBe('Desember')
  })
})

describe('periode rentang', () => {
  it('rentang satu bulan tampil sebagai satu bulan', () => {
    expect(periodRangeLabel('2026-10', '2026-10')).toBe('Oktober 2026')
  })

  it('rentang multi bulan tampil sebagai rentang', () => {
    expect(periodRangeLabel('2026-09', '2026-11')).toBe('September 2026 – November 2026')
  })

  it('period_end kosong diperlakukan sama dengan period', () => {
    expect(periodRangeLabel('2026-10')).toBe('Oktober 2026')
  })

  it('menghasilkan daftar bulan dalam rentang', () => {
    expect(apiMonthsInRange('2026-09', '2026-11')).toEqual(['2026-09', '2026-10', '2026-11'])
  })

  it('rentang lintas tahun', () => {
    expect(apiMonthsInRange('2026-11', '2027-02')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02'])
  })
})
