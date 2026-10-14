import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import DebtsandReceivablesViewer from '../DebtsandReceivablesViewer'

describe('DebtsandReceivablesViewer fixture mode', () => {
  it('renders imported settlement details while payment actions remain disabled', () => {
    render(<DebtsandReceivablesViewer privacyMode={false} fixture={{ views: [{ key: 'fixture', name: 'Dinner', account: 'Cash', date: '10/1/2026', dateLabel: 'Oct 01', sortTs: 0, direction: 'Payable', currency: 'PHP', totalPhp: 500, totalNative: 500, totalEstimated: false, overallStatus: 'Pending', rawStatus: 'Pending', participants: [{ name: 'Me', isOwner: true, shareNative: 500, sharePhp: 500, shareEstimated: false, paidPhp: 0, hasUnresolvedPayment: false, status: 'Pending' }], splittrExpenses: [] }] }} />)
    expect(screen.getByText('Settlement')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Record payment' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('payments and imports are disabled')
  })
})
