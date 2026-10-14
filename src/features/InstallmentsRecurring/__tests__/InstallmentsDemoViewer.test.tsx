import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import InstallmentsDemoViewer from '../InstallmentsDemoViewer'

describe('InstallmentsDemoViewer', () => {
  it('renders fixture activity without data hooks and retains close navigation', () => {
    const onClose = vi.fn()
    const getMonthResult = vi.fn(() => ({ items: [{ name: 'Fixture laptop', account: 'Fixture card', amount: 1200, currency: 'PHP', isRecurring: false, iteration: 2, terms: 6 }], total: 1200, omittedInstallments: 0, omittedRecurring: 0 }))
    render(<InstallmentsDemoViewer privacyMode={false} initialMonth={{ year: 2026, month: 9 }} getMonthResult={getMonthResult} onClose={onClose} />)
    expect(screen.getByText('Fixture laptop')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('read-only')
    fireEvent.click(screen.getByRole('button', { name: /back to installments/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
