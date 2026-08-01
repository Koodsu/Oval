// Single source of truth for the backend URL on the landing site.
//
// VITE_BRIDGE_API_URL is baked in at build time (set it in the Vercel project
// env, NOT just landing/.env — that file is gitignored and never reaches CI).
// If the env var is missing or points at a stale *.vercel.app deployment,
// production builds fall back to the stable API domain instead of localhost,
// so share/invite pages and the waitlist keep working.
const fromEnv = import.meta.env.VITE_BRIDGE_API_URL ?? import.meta.env.VITE_API_URL

export const API_BASE = (
  fromEnv ?? (import.meta.env.PROD ? 'https://api.theovalapp.com' : 'http://localhost:3000')
).replace(/\/$/, '')
