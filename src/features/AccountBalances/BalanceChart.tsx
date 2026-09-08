import { PieChart, Pie, Cell, Legend } from 'recharts'
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

export const CHART_COLORS = [
  '#6366f1', // indigo-500
  '#8b5cf6', // violet-500
  '#3b82f6', // blue-500
  '#06b6d4', // cyan-500
  '#14b8a6', // teal-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#f43f5e', // rose-500
  '#ec4899', // pink-500
  '#a3e635', // lime-400
]

function sanitizeKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '_')
}

interface LegendPayloadItem {
  value: string
  color: string
}

function CustomLegend({ payload }: { payload?: LegendPayloadItem[] }) {
  if (!payload?.length) return null
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 pt-3 px-2">
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <div
            className="h-2 w-2 shrink-0 rounded-[2px]"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs text-muted leading-none">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

interface BalanceChartProps {
  accounts:    AccountBalance[]
  privacyMode: boolean
}

export default function BalanceChart({ accounts, privacyMode }: BalanceChartProps) {
  // No data to chart -> reserve the same height with a placeholder (no misleading empty donut).
  if (accounts.length === 0) return <ChartPlaceholder height="h-64" />

  const chartData = accounts.map((a, i) => ({
    name:  a.name,
    value: a.phpEquivalent,
    fill:  CHART_COLORS[i % CHART_COLORS.length],
  }))

  const chartConfig: ChartConfig = Object.fromEntries(
    accounts.map((a, i) => [
      sanitizeKey(a.name),
      { label: a.name, color: CHART_COLORS[i % CHART_COLORS.length] },
    ])
  )

  return (
    <ChartContainer config={chartConfig} className="h-64 w-full">
      <PieChart>
        <ChartTooltip
          content={
            <ChartTooltipContent
              nameKey="name"
              hideLabel
              formatter={(value, name) => (
                <div className="flex items-center gap-2 min-w-[10rem]">
                  <span className="text-muted truncate max-w-[7rem]">{String(name)}</span>
                  <span className="ml-auto font-mono font-medium tabular-nums text-text">
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
          innerRadius={55}
          outerRadius={80}
          strokeWidth={2}
          stroke="transparent"
        >
          {chartData.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Legend content={<CustomLegend />} />
      </PieChart>
    </ChartContainer>
  )
}
