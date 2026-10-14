import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { BudgetsCard } from '@/features/Budgets/BudgetsCard'
import type { BudgetRow } from '@/features/Budgets/computeBudgets'

const row: BudgetRow = {
  name: 'Needs', allotted: 1000, spent: 250, remaining: 750, percentage: 25,
  color: 'green', count: 0, currency: 'PHP', transactions: [],
}

describe('BudgetsCard fixture props', () => {
  it('renders supplied rows and delegates month navigation through its prop', () => {
    const onMonthChange = vi.fn()
    render(<BudgetsCard rows={[row]} fxMap={{ PHP: 1 }} privacyMode={false} selectedMonth={{ year: 2026, month: 6 }} onMonthChange={onMonthChange} />)

    expect(screen.getByText('₱250.00')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /next month/i }))
    expect(onMonthChange).toHaveBeenCalledWith(1)
    fireEvent.click(screen.getByRole('button', { name: /Needs/ }))
    expect(screen.getByRole('region', { name: 'Needs transactions for Jul 2026' })).toBeInTheDocument()
  })
})
