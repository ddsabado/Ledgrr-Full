import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import AdjustBalanceDialog from '../AdjustBalanceDialog'

describe('AdjustBalanceDialog', () => {
  it('submits a finite target balance for the selected account', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<AdjustBalanceDialog open accountName="Cash" currency="PHP" currentBalance={100} isSubmitting={false} error={null} onOpenChange={vi.fn()} onSubmit={onSubmit} />)

    const input = screen.getByLabelText('Target balance (PHP)')
    await user.clear(input)
    await user.type(input, '125.5')
    await user.click(screen.getByRole('button', { name: 'Adjust balance' }))

    expect(onSubmit).toHaveBeenCalledWith(125.5)
    expect(screen.getByText(/records an Adjustment transaction/i)).toBeInTheDocument()
  })

  it('does not allow an empty or non-finite target balance', async () => {
    const user = userEvent.setup()
    render(<AdjustBalanceDialog open accountName="Cash" currency="PHP" currentBalance={100} isSubmitting={false} error={null} onOpenChange={vi.fn()} onSubmit={vi.fn()} />)

    const input = screen.getByLabelText('Target balance (PHP)')
    await user.clear(input)
    expect(screen.getByRole('button', { name: 'Adjust balance' })).toBeDisabled()
  })
})
