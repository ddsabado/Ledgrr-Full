import { describe, expect, it } from 'vitest'

import { computeCycleBoundaries } from '@/hooks/useCCTransactions'

function isoDate(date: Date): string {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
}

describe('computeCycleBoundaries', () => {
  it('uses the active, not last completed, statement cycle before the statement closes', () => {
    const { cycleStart, cycleEnd } = computeCycleBoundaries(16, new Date(2026, 8, 14))

    expect(isoDate(cycleStart)).toBe('2026-08-16')
    expect(isoDate(cycleEnd)).toBe('2026-09-15')
  })

  it('begins the next running cycle on the statement day', () => {
    const { cycleStart, cycleEnd } = computeCycleBoundaries(16, new Date(2026, 8, 16))

    expect(isoDate(cycleStart)).toBe('2026-09-16')
    expect(isoDate(cycleEnd)).toBe('2026-10-15')
  })

  it('keeps the statement end date inclusive for the full calendar day', () => {
    const { cycleStart, cycleEnd } = computeCycleBoundaries(16, new Date(2026, 8, 15, 23, 59))

    expect(isoDate(cycleStart)).toBe('2026-08-16')
    expect(isoDate(cycleEnd)).toBe('2026-09-15')
  })
})
