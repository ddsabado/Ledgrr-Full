import { PieChart, Pie, Cell, Legend } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { formatCurrency } from '@/utils/currency'
import { CHART_COLORS } from '@/features/AccountBalances/BalanceChart'

const PRIVACY_MASK = '••••••'

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
          <span className="text-xs text-gray-400 leading-none">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

interface CategoryDonutProps {
  /** [categoryName, total] pairs, already sorted descending by total. */
  categories:  Array<[string, number]>
  privacyMode: boolean
}

/**
 * Donut chart of the active period + flow category breakdown. Colours align
 * with the category list order (shared CHART_COLORS palette). Amounts in the
 * tooltip are masked in privacy mode.
 */
export default function CategoryDonut({ categories, privacyMode }: CategoryDonutProps) {
  if (categories.length === 0) return null

  const chartData = categories.map(([name, value], i) => ({
    name,
    value,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }))

  const chartConfig: ChartConfig = Object.fromEntries(
    categories.map(([name], i) => [
      sanitizeKey(name),
      { label: name, color: CHART_COLORS[i % CHART_COLORS.length] },
    ]),
  )

  return (
    <ChartContainer config={chartConfig} className="h-56 w-full">
      <PieChart>
        <ChartTooltip
          content={
            <ChartTooltipContent
              nameKey="name"
              hideLabel
              formatter={(value, name) => (
                <div className="flex items-center gap-2 min-w-[10rem]">
                  <span className="text-gray-400 truncate max-w-[7rem]">{String(name)}</span>
                  <span className="ml-auto font-mono font-medium tabular-nums text-white">
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
          innerRadius={48}
          outerRadius={72}
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
