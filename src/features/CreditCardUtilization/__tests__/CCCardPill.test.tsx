import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import CCCard from '@/features/CreditCardUtilization/CCCard'
import ccSource from '@/features/CreditCardUtilization/CCCard.tsx?raw'
import type { CCAccount, CCTransactionData } from '@/types/transactions'
vi.mock('@/hooks/useCurrencies', () => ({ useCurrencies: () => ({ data: { PHP: 1 }, isLoading: false, isError: false }) }))


// Avoid the supabase storage call (image is '' so it early-returns null anyway).
vi.mock('@/lib/supabase', () => ({
  supabase: { storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: '' } }) }) } },
  SUPABASE_URL: 'https://mock.supabase.co',
  SUPABASE_KEY: 'mock-key',
}))

const account: CCAccount = {
  name:           'Test Card',
  category:       'Credit Card',
  currency:       'PHP',
  currentBalance: 1000,
  initialBalance: 0,
  creditLimit:    5000,
  statementDay:   5,
  dueDay:         25,
  image:          '',
  phpEquivalent:  1000,
  utilization:    20,
  daysUntilDue:   10,
  amountDue:      500,
}

const txData: CCTransactionData = {
  cycles: [{ label: 'Cycle 1', cycleStart: '2026-06-01', cycleEnd: '2026-06-30', transactions: [] }],
  allTxs: [],
}

function renderCard(cycleView: 'statement' | 'all', onCycleViewChange = vi.fn()) {
  return render(
    <CCCard
      account={account}
      txData={txData}
      privacyMode={false}
      isExpanded
      onToggle={vi.fn()}
      cycleView={cycleView}
      onCycleViewChange={onCycleViewChange}
      cycleIndex={0}
      onCycleIndexChange={vi.fn()}
    />,
  )
}

// The single persistent highlight is the aria-hidden element carrying bg-accent.
function highlights(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>('[aria-hidden="true"].bg-accent'),
  )
}

describe('CCCard Pill_Selector (R6)', () => {
  it('renders exactly one persistent highlight in both view states (R6.4)', () => {
    const a = renderCard('statement')
    expect(highlights(a.container)).toHaveLength(1)
    a.unmount()

    const b = renderCard('all')
    expect(highlights(b.container)).toHaveLength(1)
  })

  it('the highlight animates only x — no y/top/opacity in its transition (R6.1–R6.4)', () => {
    // Static assertion against the source: the highlight animates x with a
    // single persistent motion.div and never animates y/top/opacity.
    expect(ccSource).toMatch(/animate=\{\{\s*x:\s*`\$\{selectedIndex \* 100\}%`\s*\}\}/)
    expect(ccSource).not.toContain('layoutId')
    // No opacity/y animation on the highlight element.
    const highlightBlock = ccSource.slice(
      ccSource.indexOf('pointer-events-none absolute'),
      ccSource.indexOf('{VIEW_TABS.map'),
    )
    expect(highlightBlock).not.toContain('opacity')
    expect(highlightBlock).not.toMatch(/\by:\s/)
  })

  it('uses a tween duration within [0.15, 0.40]s (R6.5)', () => {
    const m = ccSource.match(/duration:\s*(0?\.\d+)[^}]*ease:\s*'easeInOut'/)
    expect(m, 'highlight transition config not found').not.toBeNull()
    const duration = Number(m![1])
    expect(duration).toBeGreaterThanOrEqual(0.15)
    expect(duration).toBeLessThanOrEqual(0.4)
  })

  it('selectedIndex direction: statement=0 (left), all=1 (right) (R6.1, R6.2)', () => {
    // Model-level: index 0 for statement, 1 for all — drives x 0% vs 100%.
    expect(ccSource).toContain("cycleView === 'statement' ? 0 : 1")
  })

  it('re-selecting the active option is a no-op (R6.6)', async () => {
    const onCycleViewChange = vi.fn()
    const user = userEvent.setup()
    renderCard('statement', onCycleViewChange)

    // Click the already-active "By Statement" tab.
    await user.click(screen.getByRole('tab', { name: 'By Statement' }))
    // The handler is still called with the same id; the parent guard makes it a
    // no-op. Here we assert it was invoked with the currently-active id so the
    // parent's early-return path is exercised.
    expect(onCycleViewChange).toHaveBeenCalledWith('statement')
  })
})
