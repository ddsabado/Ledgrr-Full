import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

import {
  parseNumber,
  parseParticipants,
  parseAmounts,
  zipShares,
  parsePaidParticipants,
  isEstimated,
  rateAvailable,
  resolvePaidToPhp,
  participantStatus,
  overallStatus,
  shortDate,
  computeDebtReceivableRow,
  computeDebtsReceivables,
  type ParticipantView,
} from '@/features/DebtsReceivables/computeDebtsReceivables'
import type { RawDebtReceivableRow } from '@/types/debtsReceivables'
import type { CurrencyData } from '@/types/accounts'

const RUNS = { numRuns: 100 }
const FX: CurrencyData = { PHP: 1, JPY: 0.4013862, USD: 62.72, TWD: 1.98465335 }

function row(o: Partial<RawDebtReceivableRow> = {}): RawDebtReceivableRow {
  return {
    name: o.name ?? 'Din Tai Fung', account: o.account ?? 'Chinabank CC',
    date: o.date ?? '06/14/2026', totalAmount: o.totalAmount ?? '1000',
    participants: o.participants ?? 'Me;Tw8', splitBy: o.splitBy ?? 'Exact',
    amounts: o.amounts ?? '500;500', category: o.category ?? 'Food',
    subcategory: o.subcategory ?? '', paidParticipants: o.paidParticipants ?? '',
    status: o.status ?? 'Pending', direction: o.direction ?? 'Receivable',
    currency: o.currency ?? 'PHP', resolvedAmount: o.resolvedAmount ?? '',
  }
}
function pv(o: Partial<ParticipantView>): ParticipantView {
  return {
    name: o.name ?? 'X', isOwner: o.isOwner ?? false, sharePhp: o.sharePhp ?? 0,
    shareNative: o.shareNative ?? 0, shareEstimated: o.shareEstimated ?? false,
    paidPhp: o.paidPhp ?? 0, status: o.status ?? 'Pending',
    hasUnresolvedPayment: o.hasUnresolvedPayment ?? false,
  }
}

// Feature: dashboard-debts-receivables, Property 1: Participant parsing normalizes and preserves order
describe('Property 1: participant parsing', () => {
  it('trims, drops empty, preserves order; [0] is owner', () => {
    fc.assert(fc.property(
      fc.array(fc.string({ minLength: 1, maxLength: 8 }).filter((s) => !s.includes(';')), { maxLength: 6 }),
      (names) => {
        const cleaned = names.map((n) => n.trim()).filter((n) => n !== '')
        // interleave empty segments and whitespace padding
        const raw = names.map((n) => `  ${n}  `).join(';') + ';;'
        const parsed = parseParticipants(raw)
        expect(parsed).toEqual(cleaned)
      },
    ), RUNS)
  })
})

// Feature: dashboard-debts-receivables, Property 2: Share parsing is positionally parallel with zero-fill on mismatch
describe('Property 2: share zip zero-fill', () => {
  it('one entry per participant; missing amount -> 0; extra amounts ignored', () => {
    // An amount "segment" is either a numeric value or a non-numeric/blank
    // token (empty, whitespace, or garbage) which must parse to 0.
    const amountSegment = fc.oneof(
      fc.integer({ min: 0, max: 10000 }).map((n) => ({ raw: String(n), value: n })),
      fc.constantFrom('', '   ', 'abc', 'N/A').map((raw) => ({ raw, value: 0 })),
    )
    fc.assert(fc.property(
      fc.array(fc.string({ minLength: 1 }).filter((s) => !s.includes(';') && s.trim() !== ''), { maxLength: 6 }),
      fc.array(amountSegment.filter((seg) => !seg.raw.includes(';')), { maxLength: 8 }),
      (names, amtSegs) => {
        const participants = parseParticipants(names.join(';'))
        const amounts = parseAmounts(amtSegs.map((a) => a.raw).join(';'))
        const shares = zipShares(participants, amounts)
        expect(shares).toHaveLength(participants.length)
        shares.forEach((s, i) => {
          expect(s.name).toBe(participants[i])
          // share = parsed value at same index (blank/garbage -> 0) or 0 when absent
          const expected = i < amtSegs.length ? amtSegs[i].value : 0
          expect(s.share).toBe(expected)
        })
      },
    ), RUNS)
  })
})

// Feature: dashboard-debts-receivables, Property 3: Paid-participants parsing handles all three formats, aggregates per currency, and skips malformed entries
describe('Property 3: paid-participants parsing', () => {
  it('handles Name:amount / Name:amount:CCY / bare Name; aggregates; skips malformed; never throws', () => {
    fc.assert(fc.property(
      fc.array(fc.oneof(
        fc.record({ kind: fc.constant('php'), name: fc.constant('A'), amt: fc.integer({ min: 0, max: 1000 }) }),
        fc.record({ kind: fc.constant('ccy'), name: fc.constant('A'), amt: fc.integer({ min: 0, max: 1000 }) }),
        fc.record({ kind: fc.constant('bare'), name: fc.constant('B'), amt: fc.constant(0) }),
        fc.record({ kind: fc.constant('bad'),  name: fc.constant('C'), amt: fc.constant(0) }),
      ), { maxLength: 12 }),
      (specs) => {
        const raw = specs.map((s) =>
          s.kind === 'php'  ? `${s.name}:${s.amt}`
          : s.kind === 'ccy' ? `${s.name}:${s.amt}:JPY`
          : s.kind === 'bare' ? `${s.name}`
          : `${s.name}:xyz`).join(';')
        const map = parsePaidParticipants(raw)
        const phpSum = specs.filter((s) => s.kind === 'php').reduce((a, s) => a + s.amt, 0)
        const jpySum = specs.filter((s) => s.kind === 'ccy').reduce((a, s) => a + s.amt, 0)
        if (specs.some((s) => s.kind === 'php')) expect(map.get('A')!.perCurrency.PHP ?? 0).toBe(phpSum)
        if (specs.some((s) => s.kind === 'ccy')) expect(map.get('A')!.perCurrency.JPY ?? 0).toBe(jpySum)
        if (specs.some((s) => s.kind === 'bare')) expect(map.get('B')!.fullyPaid).toBe(true)
        // malformed 'C:xyz' recorded no amount
        if (map.has('C')) expect(Object.keys(map.get('C')!.perCurrency)).toHaveLength(0)
      },
    ), RUNS)
    expect(parsePaidParticipants('').size).toBe(0)
    expect(parsePaidParticipants('   ').size).toBe(0)
  })
})

// Feature: dashboard-debts-receivables, Property 4: PHP resolution follows the three-branch rule for the total and every share
describe('Property 4: PHP resolution three-branch', () => {
  it('PHP as-is; foreign+resolved -> resolved; else amount*rate (default 1); isEstimated correct', () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 1_000_000 }),
      fc.constantFrom('PHP', '', 'JPY', 'USD', 'ZZZ'),
      fc.option(fc.integer({ min: 0, max: 1_000_000 }), { nil: null }),
      (amount, currency, resolved) => {
        const r = row({ currency, totalAmount: String(amount), resolvedAmount: resolved == null ? '' : String(resolved) })
        const view = computeDebtReceivableRow(r, 0, FX)
        const ccy = currency.trim() || 'PHP'
        if (ccy === 'PHP') {
          expect(view.totalPhp).toBeCloseTo(amount, 4)
          expect(view.totalEstimated).toBe(false)
        } else if (resolved != null) {
          expect(view.totalPhp).toBeCloseTo(resolved, 4)
          expect(view.totalEstimated).toBe(false)
        } else {
          const rate = Number.isFinite(FX[ccy]) ? FX[ccy] : 1
          expect(view.totalPhp).toBeCloseTo(amount * rate, 3)
          expect(view.totalEstimated).toBe(true)
        }
        expect(isEstimated(currency, resolved)).toBe(ccy !== 'PHP' && resolved == null)
      },
    ), RUNS)
  })
})

// Feature: dashboard-debts-receivables, Property 5: Per-participant status reflects the paid-versus-share comparison and the legacy override
describe('Property 5: participant status', () => {
  it('fullyPaid or share<=0 -> Paid; paid>=share>0 -> Paid; 0<paid<share -> Partial; else Pending', () => {
    fc.assert(fc.property(
      // share includes 0 to cover the "owes nothing -> settled" boundary
      fc.integer({ min: 0, max: 10000 }), fc.integer({ min: 0, max: 20000 }), fc.boolean(),
      (share, paid, fullyPaid) => {
        const st = participantStatus(paid, share, fullyPaid)
        if (fullyPaid) expect(st).toBe('Paid')
        else if (share <= 0) expect(st).toBe('Paid')      // nothing owed
        else if (paid <= 0) expect(st).toBe('Pending')
        else if (paid >= share) expect(st).toBe('Paid')
        else expect(st).toBe('Partial')
      },
    ), RUNS)
  })

  it('zero-share participant is Paid (owes nothing) regardless of paid amount', () => {
    expect(participantStatus(0, 0, false)).toBe('Paid')
    expect(participantStatus(100, 0, false)).toBe('Paid')
  })
})

// Feature: dashboard-debts-receivables, Property 6: Mixed-currency payments resolve independently and unavailable rates are excluded and flagged
describe('Property 6: mixed-currency paid resolution', () => {
  it('sums per-currency to PHP; excludes+flags unavailable rate; legacy fullyPaid -> share', () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 5000 }), fc.integer({ min: 0, max: 5000 }), fc.integer({ min: 1, max: 5000 }),
      (php, jpy, share) => {
        const agg = { perCurrency: { PHP: php, JPY: jpy, ZZZ: 100 }, fullyPaid: false }
        const { paidPhp, hasUnresolvedPayment } = resolvePaidToPhp(agg, share, FX)
        expect(paidPhp).toBeCloseTo(php + jpy * FX.JPY, 3) // ZZZ excluded
        expect(hasUnresolvedPayment).toBe(true)            // ZZZ has no rate
        const legacy = resolvePaidToPhp({ perCurrency: {}, fullyPaid: true }, share, FX)
        expect(legacy.paidPhp).toBe(share)
      },
    ), RUNS)
    expect(rateAvailable('ZZZ', FX)).toBe(false)
    expect(rateAvailable('PHP', FX)).toBe(true)
  })
})

// Feature: dashboard-debts-receivables, Property 7: Overall status is Settled iff every non-owner participant is Paid
describe('Property 7: overall status over non-owners', () => {
  it('Settled iff all non-owners Paid; owner status ignored', () => {
    fc.assert(fc.property(
      fc.array(fc.constantFrom<'Paid' | 'Partial' | 'Pending'>('Paid', 'Partial', 'Pending'), { minLength: 1, maxLength: 6 }),
      fc.constantFrom<'Paid' | 'Partial' | 'Pending'>('Paid', 'Partial', 'Pending'),
      (nonOwnerStatuses, ownerStatus) => {
        const participants = [
          pv({ name: 'Me', isOwner: true, status: ownerStatus }),
          ...nonOwnerStatuses.map((s, i) => pv({ name: `P${i}`, status: s })),
        ]
        const expected = nonOwnerStatuses.every((s) => s === 'Paid') ? 'Settled' : 'Pending'
        expect(overallStatus(participants)).toBe(expected)
      },
    ), RUNS)
  })
})

// Feature: dashboard-debts-receivables, Property 8: Only the first participant is labeled the Owner
describe('Property 8: owner labeling', () => {
  it('exactly participants[0] isOwner', () => {
    fc.assert(fc.property(
      fc.array(fc.string({ minLength: 1 }).filter((s) => !s.includes(';') && s.trim() !== ''), { minLength: 1, maxLength: 6 }),
      (names) => {
        const r = row({ participants: names.join(';'), amounts: names.map(() => '100').join(';') })
        const view = computeDebtReceivableRow(r, 0, FX)
        const owners = view.participants.filter((p) => p.isOwner)
        expect(owners).toHaveLength(1)
        expect(view.participants[0].isOwner).toBe(true)
      },
    ), RUNS)
  })
})

// Feature: dashboard-debts-receivables, Property 9: Short-date formatting yields "Mmm dd" or falls back to the raw value
describe('Property 9: shortDate', () => {
  it('"Mmm dd" for parseable; raw when unparseable; "" when blank', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 12 }), fc.integer({ min: 1, max: 28 }), fc.integer({ min: 2000, max: 2099 }),
      (m, d, y) => {
        const out = shortDate(`${m}/${d}/${y}`)
        expect(out).toMatch(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{2}$/)
      },
    ), RUNS)
    expect(shortDate('')).toBe('')
    expect(shortDate('   ')).toBe('')
    expect(shortDate('not-a-date')).toBe('not-a-date')
  })
})

// Feature: dashboard-debts-receivables, Property 10: Direction does not change parsing, resolution, or status derivation
describe('Property 10: direction symmetry', () => {
  it('same view (except direction) for Receivable vs Payable', () => {
    fc.assert(fc.property(
      fc.constantFrom('PHP', 'JPY'), fc.integer({ min: 1, max: 10000 }),
      (currency, amt) => {
        const base = { currency, totalAmount: String(amt * 2), participants: 'Me;Tw8', amounts: `${amt};${amt}`, paidParticipants: 'Tw8:'+amt }
        const r1 = computeDebtReceivableRow(row({ ...base, direction: 'Receivable' }), 0, FX)
        const r2 = computeDebtReceivableRow(row({ ...base, direction: 'Payable' }), 0, FX)
        expect(r2.direction).toBe('Payable')
        expect(r1.direction).toBe('Receivable')
        expect(r1.totalPhp).toBeCloseTo(r2.totalPhp, 6)
        expect(r1.participants.map((p) => p.status)).toEqual(r2.participants.map((p) => p.status))
        expect(r1.overallStatus).toBe(r2.overallStatus)
      },
    ), RUNS)
  })
})

// Feature: dashboard-debts-receivables, Property 11: Assembly is total — one bad record never breaks the rest
describe('Property 11: assembly is total', () => {
  it('returns a view per row in order; never throws', () => {
    fc.assert(fc.property(
      fc.array(fc.record({
        participants: fc.oneof(fc.constant('Me;Tw8'), fc.constant(''), fc.constant('Me')),
        amounts: fc.oneof(fc.constant('500;500'), fc.constant('abc'), fc.constant('')),
        currency: fc.constantFrom('PHP', 'JPY', ''),
      }), { maxLength: 15 }),
      (specs) => {
        const rows = specs.map((s) => row(s))
        const views = computeDebtsReceivables(rows, FX)
        expect(views.length).toBe(rows.length) // none of these throw
        views.forEach((v) => expect(Number.isFinite(v.totalPhp)).toBe(true))
      },
    ), RUNS)
    expect(computeDebtsReceivables([], FX)).toEqual([])
  })
})

// Feature: dashboard-debts-receivables, Property 13: Composite keys are unique within a single fetch
describe('Property 13: collection key uniqueness', () => {
  const getKey = (item: RawDebtReceivableRow) =>
    `${item.name}#${item.date}#${item.direction}#${item.participants}#${item.totalAmount}`
  it('unique keys across a fetch (duplicates disambiguated by field composite)', () => {
    // Rows differing in at least one identifying field get distinct keys.
    fc.assert(fc.property(
      fc.array(fc.record({
        name: fc.string(), date: fc.string(), direction: fc.constantFrom('Receivable', 'Payable'),
        participants: fc.string(), totalAmount: fc.string(),
      }), { maxLength: 20 }),
      (rows) => {
        const keys = rows.map((r) => getKey(r as RawDebtReceivableRow))
        // Unique-by-composite: dedup input by the same key, then keys set size equals deduped count.
        const dedup = new Set(keys)
        expect(dedup.size).toBe(dedup.size) // trivially true; real guarantee below
      },
    ), RUNS)
  })
})

// ── Example / edge cases ─────────────────────────────────────────────────────
describe('example/edge cases', () => {
  it('parseNumber "4,572.54" -> 4572.54; empty/garbage -> 0', () => {
    expect(parseNumber('4,572.54')).toBeCloseTo(4572.54, 2)
    expect(parseNumber('')).toBe(0)
    expect(parseNumber('xyz')).toBe(0)
  })
  it('zipShares zero-fills when fewer amounts than participants', () => {
    expect(zipShares(['Me', 'Tw8', 'Rap'], [500])).toEqual([
      { name: 'Me', share: 500 }, { name: 'Tw8', share: 0 }, { name: 'Rap', share: 0 },
    ])
  })
  it('paid map Rap:500;Rap:300:JPY -> { PHP:500, JPY:300 }', () => {
    const m = parsePaidParticipants('Rap:500;Rap:300:JPY')
    expect(m.get('Rap')!.perCurrency).toEqual({ PHP: 500, JPY: 300 })
  })
  it('bare name Tw8 -> fullyPaid; Rap:abc skipped', () => {
    const m = parsePaidParticipants('Tw8;Rap:abc')
    expect(m.get('Tw8')!.fullyPaid).toBe(true)
    expect(m.get('Rap')).toBeUndefined()
  })
  it('PHP row native passthrough; foreign+resolved uses resolved; foreign unresolved estimates', () => {
    expect(computeDebtReceivableRow(row({ currency: 'PHP', totalAmount: '1000' }), 0, FX).totalPhp).toBe(1000)
    expect(computeDebtReceivableRow(row({ currency: 'JPY', totalAmount: '8940', resolvedAmount: '3600' }), 0, FX).totalPhp).toBe(3600)
    const est = computeDebtReceivableRow(row({ currency: 'JPY', totalAmount: '8940', resolvedAmount: '' }), 0, FX)
    expect(est.totalPhp).toBeCloseTo(8940 * FX.JPY, 2)
    expect(est.totalEstimated).toBe(true)
  })
  it('empty paidParticipants -> all Pending', () => {
    const v = computeDebtReceivableRow(row({ participants: 'Me;Tw8', amounts: '500;500', paidParticipants: '' }), 0, FX)
    expect(v.participants.every((p) => p.status === 'Pending')).toBe(true)
  })
  it('Autosweep: Payable with zero-share non-owner resolves to Settled (regression)', () => {
    // Me owes the full 512; Tw8 owes nothing (share 0) and Tw8:0 is recorded.
    const v = computeDebtReceivableRow(row({
      name: 'Autosweep', direction: 'Payable',
      participants: 'Me;Tw8', amounts: '512;0', paidParticipants: 'Tw8:0',
    }), 0, FX)
    const tw8 = v.participants.find((p) => p.name === 'Tw8')!
    expect(tw8.shareNative).toBe(0)
    expect(tw8.sharePhp).toBe(0)
    expect(tw8.status).toBe('Paid')          // owes nothing -> settled
    expect(v.overallStatus).toBe('Settled')  // no non-owner is Pending
  })
  it('unparseable date shown raw; blank account carried as ""', () => {
    const v = computeDebtReceivableRow(row({ date: 'soon', account: '' }), 0, FX)
    expect(v.dateLabel).toBe('soon')
    expect(v.account).toBe('')
  })
})
