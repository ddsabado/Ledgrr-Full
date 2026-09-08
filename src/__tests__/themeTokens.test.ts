/// <reference types="node" />
import { describe, it, expect } from 'vitest'

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')

describe('Typeface tokens (R1)', () => {
  it('uses Roboto (body) and IBM Plex Mono (display/headings); no Inter or Arvo', () => {
    expect(css).toMatch(/--font-sans:\s*'Roboto'/)
    expect(css).toMatch(/--font-display:\s*'IBM Plex Mono'/)
    expect(css).toMatch(/--font-mono:\s*'IBM Plex Mono'/)
    expect(css).not.toMatch(/Inter/)
    expect(css).not.toMatch(/Arvo/)
  })
  it('imports Roboto + IBM Plex Mono from Google Fonts', () => {
    expect(css).toMatch(/fonts\.googleapis\.com[^']*Roboto/)
    expect(css).toMatch(/IBM\+Plex\+Mono/)
  })
  it('sets the default body weight to Light (300)', () => {
    expect(css).toMatch(/font-weight:\s*300/)
  })
})

describe('Theme token structure', () => {
  it('all 11 tokens remain defined in the light :root', () => {
    const root = css.match(/:root\s*\{[\s\S]*?\}/i)?.[0] ?? ''
    for (const t of ['--bg','--surface','--surface2','--border','--accent','--accent2','--text','--muted','--danger','--success','--warn']) {
      expect(root).toContain(t)
    }
  })
  it('other theme modes remain present', () => {
    expect(css).toMatch(/\.dark\s*\{/)
    expect(css).toMatch(/\.high-contrast\s*\{/)
    expect(css).toMatch(/\.semi-light\s*\{/)
  })
})
