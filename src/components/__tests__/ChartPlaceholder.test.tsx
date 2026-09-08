import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import ChartPlaceholder from '@/components/ChartPlaceholder'

describe('ChartPlaceholder (R1.1, R1.3, R1.5)', () => {
  it('renders the given height class and default label with role=status', () => {
    const { container } = render(<ChartPlaceholder height="h-56" />)
    const el = container.firstElementChild as HTMLElement
    expect(el.className).toMatch(/h-56/)
    expect(el).toHaveAttribute('role', 'status')
    expect(screen.getByText('No data to display')).toBeInTheDocument()
  })

  it('accepts a custom label', () => {
    render(<ChartPlaceholder height="h-64" label="Nothing here" />)
    expect(screen.getByText('Nothing here')).toBeInTheDocument()
  })

  it('is not an interactive element', () => {
    render(<ChartPlaceholder height="h-56" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
