import { useState } from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { useMobileCardSwipe } from '@/hooks/useMobileCardSwipe'

function SwipeFixture({ enabled = true }: { enabled?: boolean }) {
  const [left, setLeft] = useState(0)
  const [right, setRight] = useState(0)
  const handlers = useMobileCardSwipe({
    enabled,
    onSwipeLeft: () => setLeft((count) => count + 1),
    onSwipeRight: () => setRight((count) => count + 1),
  })

  return (
    <div {...handlers} data-testid="card">
      <button type="button">Control</button>
      <div data-swipe-exclude>Scrollable list</div>
      <output>{`${left}/${right}`}</output>
    </div>
  )
}

function swipe(target: Element, fromX: number, toX: number, toY = 10) {
  fireEvent.pointerDown(target, { pointerId: 1, pointerType: 'touch', clientX: fromX, clientY: 10 })
  fireEvent.pointerMove(target, { pointerId: 1, pointerType: 'touch', clientX: toX, clientY: toY })
  fireEvent.pointerUp(target, { pointerId: 1, pointerType: 'touch', clientX: toX, clientY: toY })
}

describe('useMobileCardSwipe', () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(max-width: 1023px)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  })

  it('accelerates only thresholded, direction-locked horizontal touch swipes', () => {
    render(<SwipeFixture />)
    const card = screen.getByTestId('card')

    swipe(card, 200, 110)
    expect(screen.getByText('1/0')).toBeInTheDocument()

    swipe(card, 100, 190)
    expect(screen.getByText('1/1')).toBeInTheDocument()

    swipe(card, 200, 150)
    expect(screen.getByText('1/1')).toBeInTheDocument()
  })

  it('does not activate during vertical scrolling or from controls and excluded list regions', () => {
    render(<SwipeFixture />)
    const card = screen.getByTestId('card')

    swipe(card, 200, 110, 180)
    swipe(screen.getByRole('button', { name: 'Control' }), 200, 110)
    swipe(screen.getByText('Scrollable list'), 200, 110)

    expect(screen.getByText('0/0')).toBeInTheDocument()
  })

  it('stays inactive outside the mobile breakpoint and when disabled', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false })
    const { rerender } = render(<SwipeFixture />)
    swipe(screen.getByTestId('card'), 200, 110)
    expect(screen.getByText('0/0')).toBeInTheDocument()

    window.matchMedia = vi.fn().mockReturnValue({ matches: true })
    rerender(<SwipeFixture enabled={false} />)
    swipe(screen.getByTestId('card'), 200, 110)
    expect(screen.getByText('0/0')).toBeInTheDocument()
  })
})
