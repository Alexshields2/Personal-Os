import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' keeps asset URLs relative so the build works from a file://,
// a subpath (GitHub Pages project site) or a domain root without changes.
// Temporary diagnostic: records which SUPABASE-ish variables the build
// environment actually exposed, so a deployed bundle can be inspected from
// outside to tell "Vercel never passed them" apart from "Vite ignored them".
// Names only — no values. Remove once the deploy pipeline is understood.
const ENV_PROBE = `ENVPROBE:${Object.keys(process.env)
  .filter((k) => /SUPABASE/i.test(k))
  .sort()
  .join(',')}:ENDPROBE`

export default defineConfig({
  base: './',
  define: { __ENV_PROBE__: JSON.stringify(ENV_PROBE) },
  // Vercel's Supabase integration names its variables NEXT_PUBLIC_* by
  // default (it assumes Next.js) — accepting that prefix too means the
  // integration's own vars work as-is, with nothing to hand-copy into a
  // VITE_-named duplicate every time the project gets reconnected.
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  plugins: [react()],
  // Bind IPv4 explicitly: left to itself this environment binds only [::1],
  // which localhost clients can't reach.
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  build: { outDir: 'dist', sourcemap: false },
})
