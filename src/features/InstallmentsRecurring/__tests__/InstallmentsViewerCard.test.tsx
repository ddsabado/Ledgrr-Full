import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { InstallmentsViewerCard } from '../InstallmentsViewerCard'

describe('InstallmentsViewerCard', () => {
  it('renders fixture activity, filters it locally, and exposes a read-only notice', () => {
    const onClose = vi.fn()
    render(<InstallmentsViewerCard privacyMode={false} onClose={onClose} items={[{ key: 'laptop', kind: 'Installment', name: 'Fixture laptop', account: 'Fixture card', amount: 1250, totalAmount: 15_000, currency: 'PHP', startDate: '10/8/2026', terms: '12 months', budget: 'Fixture budget' }, { key: 'internet', kind: 'Recurring', name: 'Fixture internet', account: 'Cash', amount: 1799, currency: 'PHP', startDate: '10/1/2026', terms: 'Monthly' }]} />)
    expect(screen.getByText('Fixture laptop')).toBeInTheDocument()
    expect(screen.getByText('₱1,250.00')).toBeInTheDocument()
    expect(screen.getByText(/activity is read-only/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /filter installments/i }))
    fireEvent.change(screen.getByPlaceholderText('Search name'), { target: { value: 'internet' } })
    expect(screen.queryByText('Fixture laptop')).not.toBeInTheDocument()
    expect(screen.getByText('Fixture internet')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /back to installments/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
