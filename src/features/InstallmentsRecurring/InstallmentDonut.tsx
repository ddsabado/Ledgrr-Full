import { PieChart, Pie, Cell, Legend } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { formatCurrency } from '@/utils/currency'
import { chartColor } from '@/features/AccountBalances/BalanceChart'

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
          <span className="text-xs text-muted leading-none">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

interface InstallmentDonutProps {
  /** Already sorted descending by amount. */
  items:       Array<{ name: string; amount: number }>
  privacyMode: boolean
}

/**
 * Donut chart of the active installment/recurring items for the displayed
 * month. Uses recharts via the local chart primitive; slice colors are the
 * shared categorical chartColor() generator.
 */
export default function InstallmentDonut({ items, privacyMode }: InstallmentDonutProps) {
  if (items.length === 0) return null

  const chartData = items.map((item, i) => ({
    name:  item.name,
    value: item.amount,
    fill:  chartColor(i, items.length),
  }))

  const chartConfig: ChartConfig = Object.fromEntries(
    items.map((item, i) => [
      sanitizeKey(item.name),
      { label: item.name, color: chartColor(i, items.length) },
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
          innerRadius={48}
          outerRadius={72}
          strokeWidth={2}
          stroke="transparent"
        >
          {chartData.map((_, i) => (
            <Cell key={i} fill={chartColor(i, items.length)} />
          ))}
        </Pie>
        <Legend content={<CustomLegend />} />
      </PieChart>
    </ChartContainer>
  )
}
