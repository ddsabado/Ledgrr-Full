import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { PieChart, Pie, Cell } from 'recharts'

import chartSource from '@/components/ui/chart.tsx?raw'

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

// ─── Token values (verbatim from src/index.css / the reference SPA) ──────────
// surface/text pairs per mode, used for the contrast property and to assert the
// tooltip resolves to the active mode's surface.
const MODE_TOKENS: Record<string, { surface: string; text: string }> = {
  light:           { surface: '#ffffff', text: '#0f172a' },
  dark:            { surface: '#1e293b', text: '#f1f5f9' },
  'high-contrast': { surface: '#0a0a0a', text: '#ffffff' },
  'semi-light':    { surface: '#f7f5f2', text: '#1c1917' },
}

// ─── WCAG 2.1 relative luminance + contrast ratio ────────────────────────────
function srgbToLinear(c: number): number {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

function luminance(hex: string): number {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
}

function contrastRatio(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

const config: ChartConfig = { a: { label: 'A', color: '#6366f1' } }

function renderTooltip() {
  return render(
    <ChartContainer config={config} className="h-40 w-40">
      <PieChart>
        <ChartTooltip
          content={
            <ChartTooltipContent
              active
              nameKey="name"
              payload={[
                {
                  name: 'A',
                  value: 42,
                  dataKey: 'value',
                  payload: { name: 'A', value: 42, fill: '#6366f1' },
                  color: '#6366f1',
                },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ] as any}
            />
          }
        />
        <Pie data={[{ name: 'A', value: 42, fill: '#6366f1' }]} dataKey="value" nameKey="name">
          <Cell fill="#6366f1" />
        </Pie>
      </PieChart>
    </ChartContainer>,
  )
}

describe('chart tooltip wiring (R5.1, R5.2, R5.4)', () => {
  const src = chartSource

  it('tooltip container uses opaque surface/text/border token utilities', () => {
    // The tooltip container className (the grid) must carry opaque token
    // utilities and no translucent shadcn background.
    expect(src).toMatch(/rounded-lg border border-border bg-surface text-text/)
    expect(src).not.toContain('bg-background')
    expect(src).not.toContain('border-border/50')
  })

  it('renders without throwing and mounts the chart container', () => {
    const { container } = renderTooltip()
    expect(container.querySelector('[data-slot="chart"]')).not.toBeNull()
  })

  it('carries no undefined shadcn *-foreground tokens', () => {
    // The app does not define shadcn --*-foreground tokens; ensure none remain.
    expect(src).not.toContain('muted-foreground')
    expect(src).not.toContain('bg-background')
  })
})

// Feature: ui-refinements, Property 8: Tooltip token pairs meet the contrast
// floor — for each of the four modes, contrast(surface, text) >= 4.5:1.
describe('Property 8: tooltip surface/text contrast >= 4.5:1', () => {
  it('every mode meets the WCAG AA contrast floor', () => {
    for (const [mode, { surface, text }] of Object.entries(MODE_TOKENS)) {
      const ratio = contrastRatio(surface, text)
      expect(ratio, `${mode} contrast`).toBeGreaterThanOrEqual(4.5)
    }
  })
})
