import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { DebtsReceivablesCard } from '../DebtsReceivablesCard'
import type { DebtReceivableView } from '../computeDebtsReceivables'

const views: DebtReceivableView[] = [{ key: 'fixture-debt', name: 'Fixture dinner', account: 'Cash', date: '6/2/2026', dateLabel: 'Jun 02', sortTs: 0, direction: 'Receivable', currency: 'PHP', totalPhp: 500, totalNative: 500, totalEstimated: false, participants: [], overallStatus: 'Pending', rawStatus: 'Pending', splittrExpenses: null }]

describe('DebtsReceivablesCard', () => {
  it('renders fixture props and delegates record selection through props', () => {
    const onToggleViewer = vi.fn()
    const onSelectRecord = vi.fn()
    render(<DebtsReceivablesCard privacyMode={false} views={views} onToggleViewer={onToggleViewer} onSelectRecord={onSelectRecord} />)
    const record = screen.getByTestId('dr-record')
    expect(within(record).getByText('Fixture dinner')).toBeInTheDocument()
    fireEvent.click(within(record).getByRole('button'))
    expect(onSelectRecord).toHaveBeenCalledWith('fixture-debt')
    expect(onToggleViewer).toHaveBeenCalledOnce()
  })
})
