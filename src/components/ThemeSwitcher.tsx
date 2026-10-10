import { motion, AnimatePresence } from 'motion/react'
import { Moon, SunMedium, Sun, Contrast, type LucideIcon } from 'lucide-react'

import { useThemeContext } from '@/context/ThemeContext'
import { next, type Theme } from '@/hooks/useTheme'
import {
  NAV_TOGGLE_CLASS,
  NAV_TOGGLE_HOVER,
  NAV_TOGGLE_TAP,
  NAV_ICON_SWAP,
} from '@/components/navToggle'

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
    <motion.button
      type="button"
      onClick={cycleTheme}
      aria-label={`Theme: ${label}. Activate to switch to ${nextLabel}.`}
      title={`Theme: ${label}`}
      whileHover={NAV_TOGGLE_HOVER}
      whileTap={NAV_TOGGLE_TAP}
      className={NAV_TOGGLE_CLASS}
    >
      {/* Rotating icon swap on theme change (SPA-matched) */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={theme} {...NAV_ICON_SWAP} className="block">
          <Icon aria-hidden="true" className="w-[18px] h-[18px]" />
        </motion.span>
      </AnimatePresence>
    </motion.button>
  )
}
