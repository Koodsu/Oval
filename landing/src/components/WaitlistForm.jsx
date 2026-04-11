import { useState } from 'react'

export default function WaitlistForm({ dark = false }) {
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    setSubmitted(true)
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
    <form onSubmit={handleSubmit} className="flex max-w-md">
      <input
        type="email"
        required
        placeholder="your@osu.edu"
        aria-label="Email address"
        className={`flex-1 min-w-0 text-sm px-4 py-3.5 outline-none border-2 border-r-0 font-medium transition-colors ${
          dark
            ? 'bg-white/5 border-white/15 text-white placeholder:text-white/30 focus:border-white/40'
            : 'bg-white border-ink/25 text-ink placeholder:text-warm-gray focus:border-scarlet'
        }`}
      />
      <button
        type="submit"
        className="bg-scarlet text-white font-bold text-sm px-6 py-3.5 border-2 border-scarlet tracking-wide whitespace-nowrap transition-all duration-150 hover:bg-scarlet-bright active:scale-[0.98] flex items-center gap-2"
      >
        Get Early Access
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </form>
  )
}
