import { PieChart, Pie, Cell } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { formatCurrency } from '@/utils/currency'
import type { AccountBalance } from '@/types/accounts'
import ChartPlaceholder from '@/components/ChartPlaceholder'

const PRIVACY_MASK = '••••••'
export const MAX_LEGEND_ACCOUNTS = 7

/**
 * Categorical chart color generator: evenly-spaced HSL hues around the wheel,
 * so N items always get N distinct colors with no reuse (unlike a fixed
 * palette that would cycle when items exceed its length).
 *
 *   H = (START_HUE + index / total * 360) mod 360,  S/L fixed.
 *
 * Start hue 210° (brand blue, matching the #DCEAF2 base); each subsequent slice
 * steps by the golden angle (≈137.508°) so neighbouring slices are always well
 * separated regardless of item count — and the sequence never needs the total
 * up front. S 65% / L 60% is vivid-but-legible on both light and dark surfaces.
 */
const CHART_START_HUE = 210
const GOLDEN_ANGLE = 137.508
const CHART_SATURATION = 65
const CHART_LIGHTNESS = 60

/**
 * Categorical colour for slice `index`. `total` is accepted for call-site
 * compatibility but no longer affects the hue (golden-angle spacing is
 * independent of the item count).
 */
export function chartColor(index: number, _total?: number): string {
  const hue = (CHART_START_HUE + index * GOLDEN_ANGLE) % 360
  return `hsl(${hue.toFixed(1)}, ${CHART_SATURATION}%, ${CHART_LIGHTNESS}%)`
}

function sanitizeKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '_')
}

interface LegendPayloadItem {
  account: AccountBalance
  value: string
  color: string
}

export function getLegendAccounts(accounts: AccountBalance[]): AccountBalance[] {
  return [...accounts]
    .sort((a, b) => b.phpEquivalent - a.phpEquivalent)
    .slice(0, MAX_LEGEND_ACCOUNTS)
}

function CustomLegend({
  payload,
  hiddenCount,
  selectedAccount,
  onSelectAccount,
}: {
  payload?: LegendPayloadItem[]
  hiddenCount: number
  selectedAccount: string | null
  onSelectAccount?: (name: string) => void
}) {
  if (!payload?.length) return null
  return (
    <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 px-2 pt-3" aria-label="Largest account balances">
      {payload.map((entry) => (
        <button
          key={entry.account.name}
          type="button"
          onClick={() => onSelectAccount?.(entry.account.name)}
          aria-pressed={selectedAccount === entry.account.name}
          aria-label={`View activity for ${entry.account.name}`}
          title={`View activity for ${entry.account.name}`}
          className="flex min-h-8 max-w-full items-center gap-1.5 rounded-md px-1.5 text-left transition-colors hover:bg-surface2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <div
            className="h-2 w-2 shrink-0 rounded-[2px]"
            style={{ backgroundColor: entry.color }}
          />
          <span className="truncate text-xs leading-none text-muted">{entry.value}</span>
        </button>
      ))}
      {hiddenCount > 0 && (
        <span className="flex min-h-8 items-center px-1.5 text-xs text-muted" aria-label={`${hiddenCount} more accounts appear in the account list`}>
          + {hiddenCount} more {hiddenCount === 1 ? 'account' : 'accounts'}
        </span>
      )}
    </div>
  )
}

interface BalanceChartProps {
  accounts:    AccountBalance[]
  privacyMode: boolean
  selectedAccount?: string | null
  onSelectAccount?: (name: string) => void
  emptyLabel?: string
}

export default function BalanceChart({
  accounts,
  privacyMode,
  selectedAccount = null,
  onSelectAccount,
  emptyLabel,
}: BalanceChartProps) {
  // No data to chart -> reserve the same height with a placeholder (no misleading empty donut).
  if (accounts.length === 0) return <ChartPlaceholder height="h-64" label={emptyLabel} />

  const chartData = accounts.map((a, i) => ({
    name:  a.name,
    value: a.phpEquivalent,
    fill:  chartColor(i, accounts.length),
  }))

  const chartConfig: ChartConfig = Object.fromEntries(
    accounts.map((a, i) => [
      sanitizeKey(a.name),
      { label: a.name, color: chartColor(i, accounts.length) },
    ])
  )
  const legendAccounts = getLegendAccounts(accounts)
  const legendPayload = legendAccounts.map((account) => {
    const index = accounts.indexOf(account)
    return {
      account,
      value: account.name,
      color: chartColor(index, accounts.length),
    }
  })

  return (
    <div className="flex w-full flex-col">
      <ChartContainer config={chartConfig} className="h-48 w-full">
        <PieChart>
          <ChartTooltip
            content={
              <ChartTooltipContent
                nameKey="name"
                hideLabel
                formatter={(value, name) => (
                  <div className="flex items-center gap-2 min-w-[10rem]">
                    <span className="text-muted truncate max-w-[7rem]">{String(name)}</span>
                    <span className="ml-auto font-medium tabular-nums text-text">
                      {privacyMode ? PRIVACY_MASK : formatCurrency(Number(value), 'PHP')}
                    </span>
                  </div>
                )}
              />
            }
          />
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            innerRadius={45}
            outerRadius={70}
            strokeWidth={2}
            stroke="transparent"
            onClick={(_, index) => onSelectAccount?.(chartData[index].name)}
          >
            {chartData.map((_, i) => (
              <Cell key={i} fill={chartColor(i, chartData.length)} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <CustomLegend
        payload={legendPayload}
        hiddenCount={accounts.length - legendAccounts.length}
        selectedAccount={selectedAccount}
        onSelectAccount={onSelectAccount}
      />
    </div>
  )
}
