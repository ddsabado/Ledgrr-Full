import { describe, it, expect } from 'vitest'

import { CHART_COLORS } from '@/features/AccountBalances/BalanceChart'

// Load every source file under src as raw text so we can statically scan the
// themed component files without needing node:fs / __dirname.
const RAW = import.meta.glob('/src/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

// Themed component files that must be fully token-driven (R2.1, R2.2).
const THEMED_FILES = [
  '/src/App.tsx',
  '/src/pages/DashboardPage.tsx',
  '/src/pages/LoginPage.tsx',
  '/src/components/ThemeSwitcher.tsx',
  '/src/features/AccountBalances/index.tsx',
  '/src/features/AccountBalances/AccountRow.tsx',
  '/src/features/AccountBalances/BalanceChart.tsx',
  '/src/features/Transactions/index.tsx',
  '/src/features/Transactions/CategoryDonut.tsx',
  '/src/features/Transactions/DrillDownList.tsx',
  '/src/features/Transactions/PeriodNavigator.tsx',
  '/src/features/CreditCardUtilization/index.tsx',
  '/src/features/CreditCardUtilization/CCCard.tsx',
  '/src/features/CreditCardUtilization/CycleNavigator.tsx',
  '/src/features/CreditCardUtilization/TransactionList.tsx',
]

// Hardcoded palette utilities that must not appear on themed elements.
const PALETTE_RE =
  /\b(?:text|bg|border|divide|from|to|ring|ring-offset)-(?:gray|zinc|slate|neutral|red|green|emerald|rose|yellow|amber|indigo|violet)-\d{2,3}\b|\b(?:text-white|text-black|bg-black)\b/g

// Allowlist: the Google sign-in button is a fixed brand mark, not a themed
// surface, so its white background + gray hover states are intentional.
const ALLOWLIST: Record<string, RegExp[]> = {
  '/src/pages/LoginPage.tsx': [/^bg-white$/, /^bg-gray-100$/, /^bg-gray-200$/],
}

function isAllowed(file: string, match: string): boolean {
  const allowed = ALLOWLIST[file] ?? []
  return allowed.some((re) => re.test(match))
}

describe('palette scan — themed files are token-driven (R2.1, R2.2)', () => {
  for (const file of THEMED_FILES) {
    it(`${file} has no residual hardcoded palette classes`, () => {
      const src = RAW[file]
      expect(src, `source not found: ${file}`).toBeTypeOf('string')
      const matches = (src.match(PALETTE_RE) ?? []).filter(
        (m: string) => !isAllowed(file, m),
      )
      expect(matches).toEqual([])
    })
  }
})

describe('categorical chart palette retained (R2.6)', () => {
  it('CHART_COLORS is the fixed 10-color categorical palette', () => {
    expect(CHART_COLORS).toEqual([
      '#6366f1',
      '#8b5cf6',
      '#3b82f6',
      '#06b6d4',
      '#14b8a6',
      '#10b981',
      '#f59e0b',
      '#f43f5e',
      '#ec4899',
      '#a3e635',
    ])
  })

  it('BalanceChart draws slice fills from CHART_COLORS, not tokens', () => {
    const src = RAW['/src/features/AccountBalances/BalanceChart.tsx']
    expect(src).toContain('fill={CHART_COLORS[i % CHART_COLORS.length]}')
  })
})
