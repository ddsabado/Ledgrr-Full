import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import InstallmentsViewer from '../InstallmentsViewer'

describe('InstallmentsViewer fixture mode', () => {
  it('renders production filters and disables the new-payment mutation', () => {
    render(<InstallmentsViewer privacyMode={false} fixture={{ items: [{ key: 'fixture', name: 'Laptop', account: 'Visa', amount: 1000, currency: 'PHP', kind: 'Installment', startDate: '10/1/2026', terms: '6 months', budget: 'Home' }] }} />)
    expect(screen.getByText('Laptop')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /new/i })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('read-only')
  })
})
