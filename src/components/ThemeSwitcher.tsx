import { Moon, SunMedium, Sun, Contrast, type LucideIcon } from 'lucide-react'

import { useThemeContext } from '@/context/ThemeContext'
import { next, type Theme } from '@/hooks/useTheme'

const MODE_META: Record<Theme, { Icon: LucideIcon; label: string }> = {
  dark:            { Icon: Moon,      label: 'Dark' },
  'semi-light':    { Icon: SunMedium, label: 'Semi-light' },
  light:           { Icon: Sun,       label: 'Light' },
  'high-contrast': { Icon: Contrast,  label: 'High-contrast' },
}

export default function ThemeSwitcher() {
  const { theme, cycleTheme } = useThemeContext()
  const { Icon, label } = MODE_META[theme]
  const nextLabel = MODE_META[next(theme)].label

  return (
    <button
      type="button"
      onClick={cycleTheme}
      aria-label={`Theme: ${label}. Activate to switch to ${nextLabel}.`}
      title={`Theme: ${label}`}
      className="text-muted hover:text-text transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-md p-1"
    >
      <Icon aria-hidden="true" className="w-[18px] h-[18px]" />
    </button>
  )
}
