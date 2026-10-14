import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { InstallmentsRecurringCard } from '../InstallmentsRecurringCard'
import type { MonthResult } from '../buildInstallmentMonths'

const june: MonthResult = { items: [{ name: 'Fixture laptop', account: 'Fixture card', amount: 1250, currency: 'PHP', isRecurring: false, iteration: 1, terms: 4 }], total: 1250, omittedInstallments: 0, omittedRecurring: 0 }
const empty: MonthResult = { items: [], total: 0, omittedInstallments: 0, omittedRecurring: 0 }

describe('InstallmentsRecurringCard', () => {
  it('renders fixture props and keeps month navigation local to the card', () => {
    const getMonthResult = vi.fn((month) => month.month === 5 ? june : empty)
    render(<InstallmentsRecurringCard privacyMode={false} initialMonth={{ year: 2026, month: 5 }} getMonthResult={getMonthResult} />)
    expect(within(screen.getByTestId('ir-list')).getByText('Fixture laptop')).toBeInTheDocument()
    expect(within(screen.getByTestId('ir-list')).getByText(/₱1,250\.00/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /next month/i }))
    expect(screen.getByText('No installments or recurring payments for this month.')).toBeInTheDocument()
    expect(getMonthResult).toHaveBeenLastCalledWith({ year: 2026, month: 6 })
  })
})
