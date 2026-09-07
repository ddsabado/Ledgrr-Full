/**
 * Maps a numeric amount to a semantic tone class driven by theme tokens.
 * Positive (and zero) amounts use the success token; negative amounts use the
 * danger token. Never returns a fixed Tailwind palette color, so the tone
 * follows the active theme. (R2.5)
 */
export function amountToneClass(n: number): string {
  return n < 0 ? 'text-danger' : 'text-success'
}
