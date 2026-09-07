import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import ThemeSwitcher from '@/components/ThemeSwitcher'
import { ThemeProvider } from '@/context/ThemeContext'

function renderSwitcher() {
  return render(
    <ThemeProvider>
      <ThemeSwitcher />
    </ThemeProvider>,
  )
}

describe('ThemeSwitcher', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.className = ''
  })

  it('starts in dark by default and advances one step per click through the cycle', async () => {
    const user = userEvent.setup()
    renderSwitcher()
    const button = screen.getByRole('button')

    // Default = dark
    expect(button).toHaveAttribute(
      'aria-label',
      'Theme: Dark. Activate to switch to Semi-light.',
    )
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('theme')).toBe('dark')

    // dark → semi-light
    await user.click(button)
    expect(button).toHaveAttribute(
      'aria-label',
      'Theme: Semi-light. Activate to switch to Light.',
    )
    expect(document.documentElement.classList.contains('semi-light')).toBe(true)
    expect(localStorage.getItem('theme')).toBe('semi-light')

    // semi-light → light (no theme class on root)
    await user.click(button)
    expect(button).toHaveAttribute(
      'aria-label',
      'Theme: Light. Activate to switch to High-contrast.',
    )
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.classList.contains('semi-light')).toBe(false)
    expect(document.documentElement.classList.contains('high-contrast')).toBe(false)
    expect(localStorage.getItem('theme')).toBe('light')

    // light → high-contrast
    await user.click(button)
    expect(button).toHaveAttribute(
      'aria-label',
      'Theme: High-contrast. Activate to switch to Dark.',
    )
    expect(document.documentElement.classList.contains('high-contrast')).toBe(true)
    expect(localStorage.getItem('theme')).toBe('high-contrast')

    // high-contrast → dark (wrap around)
    await user.click(button)
    expect(button).toHaveAttribute(
      'aria-label',
      'Theme: Dark. Activate to switch to Semi-light.',
    )
    expect(localStorage.getItem('theme')).toBe('dark')
  })
})
