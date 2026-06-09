import { useState } from 'react'

const API_URL = import.meta.env.VITE_BRIDGE_API_URL ?? 'http://localhost:3000'

export default function WaitlistForm({ dark = false, centered = false, onSuccess }) {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`${API_URL}/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Something went wrong. Please try again.')
        return
      }

      setSubmitted(true)
      onSuccess?.(email.trim())
    } catch {
      setError('Could not reach the server. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div
        className={`inline-flex items-center gap-3 rounded-full px-6 py-4 text-sm font-semibold ${
          dark
            ? 'border border-green-400/30 bg-green-400/10 text-green-400'
            : 'border border-green-700/30 bg-green-50 text-green-700'
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M3 9l4 4 8-8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        You're in! We'll reach out before launch.
      </div>
    )
  }

  return (
    <div className={`flex flex-col gap-2 ${centered ? 'items-center' : ''}`}>
      <form
        onSubmit={handleSubmit}
        className={`flex w-full max-w-md flex-col gap-2 sm:flex-row sm:gap-0 sm:rounded-full sm:border sm:p-1.5 ${
          dark
            ? 'sm:border-white/15 sm:bg-white/[0.06] sm:shadow-[0_8px_40px_rgba(0,0,0,0.35)] sm:backdrop-blur-xl'
            : 'sm:border-ink/15 sm:bg-white'
        }`}
      >
        <input
          type="email"
          required
          placeholder="your@osu.edu"
          aria-label="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={`min-w-0 flex-1 rounded-full border px-5 py-3.5 text-sm font-medium outline-none transition-colors sm:border-0 sm:bg-transparent sm:py-3 ${
            dark
              ? 'border-white/15 bg-white/[0.06] text-white placeholder:text-white/30 focus:border-flame/50'
              : 'border-ink/20 bg-white text-ink placeholder:text-warm-gray focus:border-scarlet'
          }`}
        />
        <button
          type="submit"
          disabled={loading}
          className="group relative flex items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-full bg-gradient-to-r from-scarlet to-flame px-7 py-3.5 text-sm font-bold tracking-wide text-white transition-transform duration-150 hover:scale-[1.03] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 sm:py-3"
          style={{ boxShadow: '0 4px 28px rgba(187,0,0,0.45)' }}
        >
          <span className="relative z-10 flex items-center gap-2">
            {loading ? 'Joining…' : 'Get early access'}
            {!loading && (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="transition-transform duration-200 group-hover:translate-x-0.5">
                <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
          <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
        </button>
      </form>
      {error && (
        <p className={`text-xs font-medium ${dark ? 'text-red-400' : 'text-red-600'}`}>
          {error}
        </p>
      )}
    </div>
  )
}
