import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, normalize, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Nothing in src may import in a circle.
 *
 * Two modules that import each other are evaluated in whichever order the
 * bundler happens to choose, and the one that loses reads the other's
 * constants before they exist: "cannot access X before initialization",
 * thrown before the first render, which on a black theme is a black page with
 * no clue what happened. It survives a type check and a passing dev server and
 * only shows up once the build reorders something unrelated — so it is worth a
 * test rather than a habit.
 *
 * DayEdges and TrackerSheet did exactly this: each imported a constant from
 * the other. The fix both times is the same — move what they share into the
 * module they both already depend on.
 */

const SRC = resolve(__dirname, '..')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    return /\.tsx?$/.test(name) && !name.endsWith('.d.ts') ? [full] : []
  })
}

/** Every relative specifier, static or dynamic, with its extension worked out. */
function importsOf(file: string): string[] {
  const text = readFileSync(file, 'utf8')
  const pattern =
    /(?:import|export)[^'"]*?from\s+['"](\.[^'"]+)['"]|import\(\s*['"](\.[^'"]+)['"]\s*\)/g
  const out: string[] = []
  for (const m of text.matchAll(pattern)) {
    const spec = m[1] ?? m[2]
    const base = resolve(file, '..', spec)
    for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
      try {
        if (statSync(candidate).isFile()) {
          out.push(normalize(candidate))
          break
        }
      } catch {
        /* Not this extension; try the next. */
      }
    }
  }
  return out
}

describe('module graph', () => {
  it('has no import cycles', () => {
    const graph = new Map(sourceFiles(SRC).map((f) => [normalize(f), importsOf(f)]))

    // Depth-first, tracking the path so a cycle can be reported as the loop it
    // is rather than just "somewhere in here".
    const done = new Set<string>()
    const onPath: string[] = []
    const cycles: string[] = []

    const walk = (node: string) => {
      if (done.has(node)) return
      const at = onPath.indexOf(node)
      if (at !== -1) {
        cycles.push(
          [...onPath.slice(at), node].map((f) => f.slice(SRC.length + 1)).join(' → '),
        )
        return
      }
      onPath.push(node)
      for (const next of graph.get(node) ?? []) walk(next)
      onPath.pop()
      done.add(node)
    }

    for (const file of graph.keys()) walk(file)

    expect(cycles).toEqual([])
  })
})
