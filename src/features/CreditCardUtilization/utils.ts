/**
 * Pure utility functions for Credit Card Utilization UI color thresholds
 * and badge text. No React dependencies.
 *
 * Requirements: 8.6, 8.8, 8.9
 */

import { supabase } from '@/lib/supabase'

/** Storage bucket holding per-account card images. */
const ACCOUNT_IMAGES_BUCKET = 'account_images'

/**
 * Resolves the public URL for an account image filename stored in the
 * `account_images` Supabase Storage bucket. Returns `null` when the
 * filename is empty, so callers can skip rendering an <img>.
 *
 * The bucket is public, so this is a stable CDN URL requiring no auth.
 */
export function getAccountImageUrl(image: string): string | null {
  const filename = image.trim()
  if (!filename) return null
  const { data } = supabase.storage
    .from(ACCOUNT_IMAGES_BUCKET)
    .getPublicUrl(filename)
  return data.publicUrl
}

/**
 * Returns the Tailwind background color class for the utilization progress bar
 * based on the utilization percentage.
 *
 * - `< 30`      → green  (`bg-green-500`)
 * - `30`–`69`   → yellow (`bg-yellow-500`)  (>= 30 and < 70)
 * - `>= 70`     → red    (`bg-red-500`)
 *
 * Requirements: 8.6
 */
export function getUtilizationBarColor(utilization: number): string {
  if (utilization < 30) return 'bg-green-500'
  if (utilization < 70) return 'bg-yellow-500'
  return 'bg-red-500'
}

/**
 * Returns the badge text describing how many days remain until the due date.
 *
 * - `0`   → `"Due today"`
 * - `1`   → `"Due tomorrow"`
 * - `> 1` → `"Due in Xd"` (e.g. `"Due in 5d"`)
 *
 * Requirements: 8.8
 */
export function getDueBadgeText(daysUntilDue: number): string {
  if (daysUntilDue === 0) return 'Due today'
  if (daysUntilDue === 1) return 'Due tomorrow'
  return `Due in ${daysUntilDue}d`
}

/**
 * Returns a Tailwind class string combining background + text color for the
 * due badge, based on how many days remain until the due date.
 *
 * - `<= 3` → red    (`bg-red-500/10 text-red-400`)
 * - `4`–`7` → yellow (`bg-yellow-500/10 text-yellow-400`)
 * - `> 7`  → green  (`bg-green-500/10 text-green-400`)
 *
 * Requirements: 8.9
 */
export function getDueBadgeColor(daysUntilDue: number): string {
  if (daysUntilDue <= 3) return 'bg-red-500/10 text-red-400'
  if (daysUntilDue <= 7) return 'bg-yellow-500/10 text-yellow-400'
  return 'bg-green-500/10 text-green-400'
}
