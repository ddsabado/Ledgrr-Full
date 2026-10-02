import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AccountBalance } from '@/types/accounts'

const { adjustAccountBalance } = vi.hoisted(() => ({ adjustAccountBalance: vi.fn() }))

vi.mock('@/hooks/useAccountBalances', () => ({
  useAccountBalances: () => ({ data: [{
    name: 'Cash', category: 'Cash', currency: 'PHP', currentBalance: 100,
    initialBalance: 0, creditLimit: 0, statementDay: null, dueDay: null,
    image: '', accountType: 'Debit', phpEquivalent: 100,
  }] satisfies AccountBalance[], isLoading: false, isError: false }),
}))
vi.mock('@/services/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/services/api')>()), adjustAccountBalance }))
vi.mock('../useAccountTransactions', () => ({
  useAccountTransactions: () => ({ transactions: [], types: ['Adjustment'], isLoading: false, isError: false }),
}))
vi.mock('@/features/CreditCardUtilization/TransactionList', () => ({ default: () => null }))

import { AdjustAccountBalanceError } from '@/services/api'
import AccountViewer from '../AccountViewer'

function renderViewer() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}><AccountViewer accountName="Cash" privacyMode={false} /></QueryClientProvider>)
}

describe('AccountViewer balance adjustment feedback', () => {
  beforeEach(() => vi.clearAllMocks())

  it('announces a recorded delta and surfaces Adjustment transactions after success', async () => {
    adjustAccountBalance.mockResolvedValueOnce(undefined)
    const user = userEvent.setup()
    renderViewer()

    await user.click(screen.getByRole('button', { name: 'Adjust balance' }))
    const input = screen.getByLabelText('Target balance (PHP)')
    await user.clear(input)
    await user.type(input, '125')
    await user.click(screen.getByRole('button', { name: 'Adjust balance' }))

    await waitFor(() => expect(adjustAccountBalance).toHaveBeenCalledWith({ accountName: 'Cash', targetBalance: 125 }))
    expect(await screen.findByRole('status')).toHaveTextContent('Adjustment transaction recorded: +₱25.00')
    expect(screen.getByRole('status')).toHaveTextContent('Showing Adjustment transactions')
  })

  it('keeps the target and offers a safe retry after a mutation error', async () => {
    adjustAccountBalance.mockRejectedValueOnce(new AdjustAccountBalanceError('request rejected')).mockResolvedValueOnce(undefined)
    const user = userEvent.setup()
    renderViewer()

    await user.click(screen.getByRole('button', { name: 'Adjust balance' }))
    const input = screen.getByLabelText('Target balance (PHP)')
    await user.clear(input)
    await user.type(input, '80')
    await user.click(screen.getByRole('button', { name: 'Adjust balance' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No balance change was recorded')
    expect(input).toHaveValue('80')
    await user.click(screen.getByRole('button', { name: 'Retry adjustment' }))
    await waitFor(() => expect(adjustAccountBalance).toHaveBeenCalledTimes(2))
  })
})
