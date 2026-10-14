import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import DebtsReceivablesDemoViewer from '../DebtsReceivablesDemoViewer'

const views = [{ key: 'fixture-debt', name: 'Fixture dinner', account: 'Cash', dateLabel: 'Jun 02', direction: 'Receivable' as const, currency: 'PHP', totalNative: 500, overallStatus: 'Pending' as const, participants: [{ name: 'Jamie', isOwner: false, shareNative: 500, paidPhp: 0, status: 'Pending' as const }] }]

describe('DebtsReceivablesDemoViewer', () => {
  it('renders fixture record details and makes payment controls visibly unavailable', () => {
    const onClose = vi.fn()
    render(<DebtsReceivablesDemoViewer privacyMode={false} views={views} selectedRecord="fixture-debt" onClose={onClose} />)
    expect(screen.getByText('Fixture dinner')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('payments and imports are unavailable')
    expect(screen.getByRole('button', { name: 'Record receipt' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /back to debts/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
