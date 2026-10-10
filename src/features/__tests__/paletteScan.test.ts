import { describe, it, expect } from 'vitest'

import { chartColor } from '@/features/AccountBalances/BalanceChart'

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

describe('categorical chart palette — golden-angle HSL hues', () => {
  it('chartColor steps hues by the golden angle (137.508deg) from 210deg', () => {
    expect(chartColor(0)).toBe('hsl(210.0, 65%, 60%)')
    expect(chartColor(1)).toBe('hsl(347.5, 65%, 60%)')   // 210 + 137.508
    expect(chartColor(2)).toBe('hsl(125.0, 65%, 60%)')   // 210 + 275.016 -> % 360
    expect(chartColor(3)).toBe('hsl(262.5, 65%, 60%)')   // 210 + 412.524 -> % 360
  })

  it('assigns distinct colors for every item (no reuse) when items exceed 10', () => {
    const total = 14
    const colors = Array.from({ length: total }, (_, i) => chartColor(i))
    expect(new Set(colors).size).toBe(total)
  })

  it('is independent of the total argument', () => {
    expect(chartColor(3, 4)).toBe(chartColor(3, 99))
    expect(chartColor(0, 0)).toBe('hsl(210.0, 65%, 60%)')
  })

  it('BalanceChart draws slice fills from chartColor(), not tokens', () => {
    const src = RAW['/src/features/AccountBalances/BalanceChart.tsx']
    expect(src).toContain('fill={chartColor(i, chartData.length)}')
  })
})
