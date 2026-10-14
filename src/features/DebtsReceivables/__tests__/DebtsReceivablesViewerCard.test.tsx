import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { DebtsReceivablesViewerCard } from '../DebtsReceivablesViewerCard'

describe('DebtsReceivablesViewerCard', () => {
  it('renders fixture detail, delegates selection, and leaves payments read-only', () => {
    const onClose = vi.fn()
    const onSelectRecord = vi.fn()
    render(<DebtsReceivablesViewerCard privacyMode={false} selectedRecord="jamie" onClose={onClose} onSelectRecord={onSelectRecord} views={[{ key: 'jamie', name: 'Jamie', account: 'Cash', dateLabel: 'Oct 08', direction: 'Receivable', currency: 'PHP', totalNative: 1250, overallStatus: 'Pending', participants: [{ name: 'You', isOwner: true, shareNative: 0, paidPhp: 0, status: 'Paid' }, { name: 'Jamie', isOwner: false, shareNative: 1250, paidPhp: 0, status: 'Pending' }] }, { key: 'riley', name: 'Riley', account: 'Cash', dateLabel: 'Oct 07', direction: 'Receivable', currency: 'PHP', totalNative: 300, overallStatus: 'Pending', participants: [] }]} />)
    expect(screen.getByRole('heading', { name: 'Jamie' })).toBeInTheDocument()
    expect(screen.getAllByText('₱1,250.00')).toHaveLength(2)
    expect(screen.getByText(/payments and imports are disabled/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /payment/i })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Riley' }))
    expect(onSelectRecord).toHaveBeenCalledWith('riley')
    fireEvent.click(screen.getByRole('button', { name: /back to debts/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
