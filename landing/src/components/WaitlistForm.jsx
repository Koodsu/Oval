import { useState } from 'react'

const API_URL = import.meta.env.VITE_BRIDGE_API_URL ?? 'http://localhost:3000'

export default function WaitlistForm({ dark = false }) {
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
    } catch {
      setError('Could not reach the server. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div
        className={`inline-flex items-center gap-3 px-5 py-4 text-sm font-semibold border-2 ${
          dark
            ? 'border-white/20 bg-white/5 text-green-400'
            : 'border-ink/20 bg-white text-green-700'
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
    <div className="flex flex-col gap-2">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row max-w-md">
        <input
          type="email"
          required
          placeholder="your@osu.edu"
          aria-label="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={`flex-1 min-w-0 text-sm px-4 py-3.5 outline-none border-2 sm:border-r-0 border-b-0 sm:border-b-2 font-medium transition-colors ${
            dark
              ? 'bg-white/5 border-white/15 text-white placeholder:text-white/30 focus:border-white/40'
              : 'bg-white border-ink/25 text-ink placeholder:text-warm-gray focus:border-scarlet'
          }`}
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-scarlet text-white font-bold text-sm px-6 py-3.5 border-2 border-scarlet tracking-wide whitespace-nowrap transition-all duration-150 hover:bg-scarlet-bright active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? 'Joining…' : 'Get Early Access'}
          {!loading && (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
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
