import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Catches a component used in JSX that nothing defines or imports.
 *
 * This exists because exactly that shipped: a `<DayBasics />` reference whose
 * definition never landed. `vite build` cannot see it — esbuild does no
 * cross-module scope analysis — and tsc is unreliable on this machine, so the
 * bug reached the browser as a blank screen. This is cheap and deterministic.
 */

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : join(dir, e.name),
  )
}

const FILES = walk('src').filter((f) => f.endsWith('.tsx'))

/** Tags that are React's own or plain lowercase HTML are not our problem. */
const BUILT_IN = new Set(['Fragment', 'Suspense', 'StrictMode'])

describe('every component used in JSX exists', () => {
  for (const file of FILES) {
    it(file.replace('src/', ''), () => {
      const src = readFileSync(file, 'utf8')
      // A "<" straight after an identifier is a generic (useState<Foo>,
      // Record<K,V>), not a JSX tag. Only the standalone form counts.
      const used = new Set(
        [...src.matchAll(/(^|[^A-Za-z0-9_$])<([A-Z][A-Za-z0-9_]*)[\s/>]/gm)].map((m) => m[2]),
      )
      const defined = new Set([
        ...[...src.matchAll(/(?:function|const)\s+([A-Z][A-Za-z0-9_]*)/g)].map((m) => m[1]),
        ...[...src.matchAll(/import\s+([A-Z][A-Za-z0-9_]*)/g)].map((m) => m[1]),
        ...[...src.matchAll(/import\s*\{([^}]*)\}/g)].flatMap((m) =>
          m[1].split(',').map((x) => x.trim().split(/\s+as\s+/).pop()!.trim()),
        ),
        // Destructured props are definitions too: ({ id, label, Icon }) then
        // rendering <Icon /> is the normal way to pass a component down.
        ...[...src.matchAll(/[({]\s*\{([^}]*)\}/g)].flatMap((m) =>
          m[1].split(',').map((x) => x.trim().split(':').pop()!.trim()),
        ),
      ])
      const missing = [...used].filter((u) => !defined.has(u) && !BUILT_IN.has(u))
      expect(missing).toEqual([])
    })
  }
})
