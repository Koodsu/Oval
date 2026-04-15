import { useState } from 'react'
import { Link } from 'react-router-dom'

const API_URL = import.meta.env.VITE_BRIDGE_API_URL ?? 'http://localhost:3000'

const GRAIN_SVG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E")`

const VALUE_PROPS = [
  {
    emoji: '📣',
    title: 'More Reach',
    description:
      'Show up when students are actively searching for clubs to join — not just at the club fair once a year.',
  },
  {
    emoji: '📅',
    title: 'Meeting Management',
    description:
      'Schedule meetings, track attendance, and send announcements to your members all in one place.',
  },
  {
    emoji: '💬',
    title: 'Keep Members Engaged',
    description:
      'A dedicated club space where your members actually spend time — not a GroupMe that gets buried.',
  },
]

const STATS = [
  { number: '100%', label: 'OSU Verified Students' },
  { number: 'FREE', label: 'For All Clubs' },
  { number: 'FALL 2026', label: 'Launch at Ohio State' },
]

const CATEGORIES = [
  'Sports & Fitness',
  'Food & Drink',
  'Academic',
  'Arts & Creative',
  'Social',
  'Outdoors',
  'Music & Entertainment',
  'Wellness',
  'Gaming',
  'Volunteering',
  'Other',
]

function ClubRegistrationForm() {
  const [fields, setFields] = useState({
    clubName: '',
    yourName: '',
    role: '',
    email: '',
    category: '',
    description: '',
    instagramOrWebsite: '',
    biggestChallenge: '',
  })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  function handleChange(e) {
    const { name, value } = e.target
    setFields((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`${API_URL}/waitlist/club-registration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
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

  const inputClass =
    'bg-white border border-[#E8E3DB] rounded-xl px-4 py-4 text-[15px] w-full outline-none focus:border-scarlet transition-colors font-sans text-ink placeholder:text-[#AAAAAA]'

  if (submitted) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">✅</div>
        <p className="font-sans font-bold text-xl text-ink mb-2">You're registered!</p>
        <p className="font-sans text-[15px] text-[#666666]">
          We'll be in touch before launch. Keep an eye on your OSU email.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 max-w-xl mx-auto">
      <div>
        <input
          type="text"
          name="clubName"
          required
          placeholder="Club Name"
          value={fields.clubName}
          onChange={handleChange}
          className={inputClass}
        />
      </div>
      <div>
        <input
          type="text"
          name="yourName"
          required
          placeholder="Your Name"
          value={fields.yourName}
          onChange={handleChange}
          className={inputClass}
        />
      </div>
      <div>
        <input
          type="text"
          name="role"
          required
          placeholder="Your Role at the Club (President, Vice President, etc.)"
          value={fields.role}
          onChange={handleChange}
          className={inputClass}
        />
      </div>
      <div>
        <input
          type="email"
          name="email"
          required
          placeholder="name.#@osu.edu"
          value={fields.email}
          onChange={handleChange}
          className={inputClass}
        />
        <p className="font-sans text-[12px] text-[#999999] mt-1.5 px-1">
          Must be an @osu.edu or @buckeyemail.osu.edu address
        </p>
      </div>
      <div>
        <select
          name="category"
          required
          value={fields.category}
          onChange={handleChange}
          className={`${inputClass} ${fields.category === '' ? 'text-[#AAAAAA]' : 'text-ink'}`}
        >
          <option value="" disabled>
            Club Category
          </option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat} className="text-ink">
              {cat}
            </option>
          ))}
        </select>
      </div>
      <div>
        <textarea
          name="description"
          required
          rows={3}
          placeholder="Tell students what your club is about in 2-3 sentences"
          value={fields.description}
          onChange={handleChange}
          className={`${inputClass} resize-none`}
        />
      </div>
      <div>
        <input
          type="text"
          name="instagramOrWebsite"
          placeholder="Instagram or Website (optional) — @yourclub or yourclub.com"
          value={fields.instagramOrWebsite}
          onChange={handleChange}
          className={inputClass}
        />
      </div>
      <div>
        <textarea
          name="biggestChallenge"
          rows={2}
          placeholder="What's hardest about running your club right now? (optional)"
          value={fields.biggestChallenge}
          onChange={handleChange}
          className={`${inputClass} resize-none`}
        />
      </div>

      {error && <p className="font-sans text-sm text-scarlet font-medium">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-scarlet text-white font-bold h-14 rounded-xl text-base tracking-wide hover:bg-scarlet-bright transition-colors duration-150 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? 'Registering...' : 'Register My Club →'}
      </button>

      <p className="font-sans text-[12px] text-[#999999] text-center">
        No spam. We'll only email you about Bridge.
      </p>
    </form>
  )
}

export default function ClubsPage() {
  function scrollToForm(e) {
    e.preventDefault()
    document.getElementById('club-registration')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="font-sans text-ink overflow-x-hidden">
      {/* Grain overlay */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 9999,
          opacity: 0.028,
          backgroundImage: GRAIN_SVG,
          backgroundRepeat: 'repeat',
        }}
      />

      {/* Minimal Header */}
      <header className="bg-ink/96 backdrop-blur-sm border-b border-white/5 h-14 flex items-center justify-between px-6 md:px-10">
        <Link to="/" className="flex items-center gap-3 no-underline group">
          <div className="w-6 h-6 bg-scarlet flex items-center justify-center flex-shrink-0">
            <span className="font-display text-white text-base leading-none">B</span>
          </div>
          <span className="font-display text-white text-2xl tracking-[0.12em] leading-none">BRIDGE</span>
        </Link>
        <Link
          to="/"
          className="font-sans text-sm text-[#666666] hover:text-white transition-colors no-underline"
        >
          Back to Bridge
        </Link>
      </header>

      {/* Hero */}
      <section className="relative bg-[#111111] py-24 overflow-hidden">
        <div className="relative max-w-[1200px] mx-auto px-6">
          <p className="text-scarlet text-xs font-bold tracking-[0.2em] uppercase mb-5">
            Bridge for Clubs
          </p>
          <h1 className="font-display leading-[0.9] tracking-wide mb-6">
            <span className="block text-white text-[clamp(36px,6vw,84px)]">
              GET YOUR CLUB IN FRONT OF
            </span>
            <span className="block text-white text-[clamp(36px,6vw,84px)]">
              EVERY INCOMING FRESHMAN.
            </span>
          </h1>
          <p className="text-[#888888] text-lg max-w-xl leading-relaxed mb-8">
            Bridge is a free platform launching at Ohio State this fall. List your club, manage
            meetings, and reach students who are actively looking to get involved.
          </p>
          <a
            href="#club-registration"
            onClick={scrollToForm}
            className="inline-block bg-scarlet text-white font-bold px-8 py-4 hover:bg-scarlet-bright transition-colors duration-150 active:scale-[0.98] no-underline"
          >
            Register Your Club — It's Free
          </a>
        </div>
      </section>

      {/* Value Props */}
      <section className="bg-cream py-24">
        <div className="max-w-[1200px] mx-auto px-6">
          <p className="text-scarlet text-xs font-bold tracking-[0.2em] uppercase mb-4">
            Why Bridge
          </p>
          <h2 className="font-display text-[clamp(36px,6vw,80px)] leading-[0.9] tracking-wide text-ink mb-14">
            BUILT FOR CLUB LEADERS.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {VALUE_PROPS.map(({ emoji, title, description }) => (
              <div key={title} className="bg-white rounded-2xl shadow-md p-8">
                <div className="text-5xl mb-4">{emoji}</div>
                <h3 className="font-sans font-bold text-xl text-ink mb-2">{title}</h3>
                <p className="font-sans text-[15px] text-[#666666] leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="bg-[#111111] py-16">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-white/5">
            {STATS.map(({ number, label }) => (
              <div key={label} className="bg-[#111111] flex flex-col items-center justify-center py-10 px-6 text-center">
                <span className="font-display text-scarlet text-[clamp(36px,5vw,68px)] leading-none tracking-wide mb-2">
                  {number}
                </span>
                <span className="font-sans text-[11px] font-bold tracking-[0.2em] uppercase text-white/35">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Registration Form */}
      <section id="club-registration" className="bg-cream py-24">
        <div className="max-w-[1200px] mx-auto px-6">
          <p className="text-scarlet text-xs font-bold tracking-[0.2em] uppercase mb-4 text-center">
            Get Started
          </p>
          <h2 className="font-display text-[clamp(36px,6vw,80px)] leading-[0.9] tracking-wide text-ink mb-4 text-center">
            REGISTER YOUR CLUB.
          </h2>
          <p className="font-sans text-[#666666] text-base text-center mb-12 max-w-lg mx-auto">
            Takes 5 minutes. Free forever. We'll reach out before launch to get you set up.
          </p>
          <ClubRegistrationForm />
        </div>
      </section>

      {/* Minimal Footer */}
      <footer className="bg-[#111111] py-8">
        <div className="max-w-[1200px] mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
          <span className="text-white/40">© 2026 Bridge. All rights reserved.</span>
          <span className="text-white/40">Questions? brady.vanbibber@gmail.com</span>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="text-[#666666] hover:text-white/70 transition-colors no-underline">
              Privacy
            </Link>
            <Link to="/terms" className="text-[#666666] hover:text-white/70 transition-colors no-underline">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
