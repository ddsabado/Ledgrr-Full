/**
 * Shared styling + motion for the top-nav icon toggle buttons (privacy eye,
 * theme switcher), mirroring the reference SPA: a boxed control (surface2
 * background + border, rounded-lg) that scales up on hover and presses in on
 * tap, with the accent color on the focus ring. Token-driven; no hardcoded
 * colors. Motion values are consumed by `motion.button` (`whileHover` /
 * `whileTap`); the class provides the static box + focus affordances.
 */
export const NAV_TOGGLE_CLASS =
  'p-2 rounded-lg bg-surface2 border border-border text-muted ' +
  'transition-colors duration-150 ease-in-out ' +
  'hover:text-text hover:border-accent ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent'

/** SPA-matched hover interaction: subtle scale-up. */
export const NAV_TOGGLE_HOVER = { scale: 1.1 } as const

/** SPA-matched press interaction: scale-down. */
export const NAV_TOGGLE_TAP = { scale: 0.85 } as const

/** Icon-swap transition: rotate + fade, matching the SPA (0.15s). */
export const NAV_ICON_SWAP = {
  initial:    { opacity: 0, rotate: -90 },
  animate:    { opacity: 1, rotate: 0 },
  exit:       { opacity: 0, rotate: 90 },
  transition: { duration: 0.15 },
} as const

/**
 * Text-button variant (e.g. "Sign out"): same hover/press motion is applied on
 * the element, this provides the static text styling + focus affordance.
 */
export const NAV_TOGGLE_TEXT_CLASS =
  'text-sm text-muted rounded-md px-2 py-1 ' +
  'transition-colors duration-150 ease-in-out ' +
  'hover:text-text hover:bg-surface2 ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent'
