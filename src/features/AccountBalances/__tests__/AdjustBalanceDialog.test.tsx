import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import AdjustBalanceDialog from '../AdjustBalanceDialog'

describe('AdjustBalanceDialog', () => {
  it('previews the signed adjustment and submits a finite changed target balance', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<AdjustBalanceDialog open accountName="Cash" currency="PHP" currentBalance={100} isSubmitting={false} error={null} canRetry={false} onOpenChange={vi.fn()} onSubmit={onSubmit} />)

    const input = screen.getByLabelText('Target balance (PHP)')
    expect(input).toHaveAttribute('maxlength', '20')
    await user.clear(input)
    await user.type(input, '125.5')
    await user.click(screen.getByRole('button', { name: 'Adjust balance' }))

    expect(onSubmit).toHaveBeenCalledWith(125.5)
    expect(screen.getByText(/records an Adjustment transaction/i)).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Adjustment preview' })).toHaveTextContent('Current balance')
    expect(screen.getByRole('region', { name: 'Adjustment preview' })).toHaveTextContent('New target balance')
    expect(screen.getByRole('region', { name: 'Adjustment preview' })).toHaveTextContent('+₱25.50 PHP')
  })

  it('keeps invalid input and explains how to correct empty, non-finite, and unchanged balances', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<AdjustBalanceDialog open accountName="Cash" currency="PHP" currentBalance={100} isSubmitting={false} error={null} canRetry={false} onOpenChange={vi.fn()} onSubmit={onSubmit} />)

    const input = screen.getByLabelText('Target balance (PHP)')
    await user.clear(input)
    await user.click(screen.getByRole('button', { name: 'Adjust balance' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a new target balance')
    expect(input).toHaveValue('')

    await user.type(input, 'Infinity')
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid input')
    expect(input).toHaveValue('Infinity')

    await user.clear(input)
    await user.type(input, '100')
    expect(screen.getByRole('alert')).toHaveTextContent('different from the current balance')
    await user.click(screen.getByRole('button', { name: 'Adjust balance' }))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('keeps the target value and gives recovery guidance when recording fails', async () => {
    const user = userEvent.setup()
    render(<AdjustBalanceDialog open accountName="Cash" currency="PHP" currentBalance={100} isSubmitting={false} error="We couldn’t record this adjustment. No balance change was recorded. Check your connection and retry." canRetry onOpenChange={vi.fn()} onSubmit={vi.fn()} />)

    const input = screen.getByLabelText('Target balance (PHP)')
    await user.clear(input)
    await user.type(input, '80')
    expect(screen.getByRole('alert')).toHaveTextContent('No balance change was recorded')
    expect(screen.getByRole('button', { name: 'Retry adjustment' })).toBeEnabled()
    expect(input).toHaveValue('80')
  })
})
