import { useState, useRef, useCallback, useEffect } from 'react'
import { Link } from 'react-router-dom'

const API_URL = import.meta.env.VITE_BRIDGE_API_URL ?? 'http://localhost:3000'

const GRAIN_SVG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E")`

const CATEGORIES = [
  'Sports & Fitness', 'Food & Drink', 'Academic', 'Arts & Creative',
  'Social', 'Outdoors', 'Music & Entertainment', 'Wellness', 'Gaming',
  'Volunteering', 'Other',
]

// ─── Feature bento data ─────────────────────────────────────────────────────

const FEATURES = [
  {
    id: 'discovery',
    tag: 'Discovery',
    headline: 'FOUND BY STUDENTS\nEVERY DAY.',
    body: 'Your club lives in the Bridge directory — searchable, filterable, always visible. Students find you when they\'re actively looking, not just once a year at the fair.',
    span: 'col-span-12 md:col-span-7',
    mock: {
      type: 'discovery',
      clubs: [
        { name: 'OSU Climbing Club', members: 84, category: 'Sports & Fitness', joined: false },
        { name: 'Buckeye Film Society', members: 62, category: 'Arts & Creative', joined: true },
        { name: 'Pre-Law Society', members: 118, category: 'Academic', joined: false },
      ],
    },
  },
  {
    id: 'meetings',
    tag: 'Meetings & RSVP',
    headline: 'KNOW WHO\'S\nSHOWING UP.',
    body: 'Schedule meetings in the app. Members RSVP Going / Maybe / Not Going. No more uncertainty — see the headcount before you unlock the room.',
    span: 'col-span-12 md:col-span-5',
    mock: {
      type: 'rsvp',
      meeting: { title: 'Weekly General Meeting', location: 'Hopkins 100', time: 'Thurs · 7:00 PM' },
      counts: { going: 24, maybe: 7, notGoing: 3 },
    },
  },
  {
    id: 'attendance',
    tag: 'Attendance',
    headline: 'CODE-BASED\nCHECK-IN.',
    body: 'Open attendance with a tap, share a 6-digit code. Members check in from their phones. Close it when you\'re done — no clipboard needed.',
    span: 'col-span-12 md:col-span-4',
    mock: {
      type: 'code',
      code: 'XK4T9R',
      count: 18,
    },
  },
  {
    id: 'officer',
    tag: 'Officer Channel',
    headline: 'PRIVATE\nLEADERSHIP CHAT.',
    body: 'Officers and admins get their own channel that members can\'t see. Plan in private, then announce when it\'s ready.',
    span: 'col-span-12 md:col-span-4',
    mock: {
      type: 'chat',
      messages: [
        { name: 'Alex (President)', text: 'Budget approved for the trip', officer: true },
        { name: 'Maya (VP)', text: 'How many shirts should we order?', officer: true },
        { name: 'Jordan (Treasurer)', text: 'Estimating 40 based on RSVPs', officer: true },
      ],
    },
  },
  {
    id: 'announcements',
    tag: 'Announcements',
    headline: 'ACTUALLY\nREAD.',
    body: 'Post announcements that reach every member — right in the app where they already spend time. No more buried GroupMe blasts.',
    span: 'col-span-12 md:col-span-4',
    mock: {
      type: 'announcement',
      items: [
        { text: 'Practice moved to Tuesday this week — same time, Smith Hall 200', time: '2h ago' },
        { text: 'Elections are next meeting. All officer positions open.', time: '1d ago' },
      ],
    },
  },
]

const STEPS = [
  {
    step: '01',
    title: 'REGISTER\nYOUR CLUB',
    desc: 'Fill out the form below. We\'ll review your club, verify your OSU email, and get you set up before launch day.',
  },
  {
    step: '02',
    title: 'GO LIVE\nIN THE APP',
    desc: 'Your club profile goes live in the Bridge directory on launch day. Add your description, logo, and category so students can find you.',
  },
  {
    step: '03',
    title: 'GROW YOUR\nMEMBERSHIP',
    desc: 'Students discover your club, tap join, and get added instantly. Run meetings, post announcements, track who shows up — all from one place.',
  },
]

const STATS = [
  { number: '0', suffix: '', label: 'Cost. Free forever.' },
  { number: '100', suffix: '%', label: 'OSU-Verified Members' },
  { number: 'FALL', suffix: '', label: '2026 Launch at OSU' },
]

const CLUB_SIGNALS = [
  { label: 'New member surge', meta: 'Film Society · +12 this week', style: 'top-[8%] left-[3%]' },
  { label: 'Attendance live', meta: 'Climbing Club · 18 checked in', style: 'top-[20%] right-[6%]' },
  { label: 'Officer planning', meta: 'Private channel active', style: 'bottom-[22%] left-[8%]' },
]

const CLUB_ORBITALS = [
  { title: 'Student directory', meta: 'Searchable all semester', style: 'top-[10%] left-[12%] rotate-[-6deg]' },
  { title: 'Meeting RSVP', meta: '24 going tonight', style: 'top-[16%] right-[10%] rotate-[7deg]' },
  { title: 'Attendance code', meta: 'Open in one tap', style: 'bottom-[18%] left-[6%] rotate-[4deg]' },
  { title: 'Officer channel', meta: 'Plan privately', style: 'bottom-[10%] right-[6%] rotate-[-5deg]' },
]

// ─── Mock UI components ──────────────────────────────────────────────────────

function DiscoveryMock({ clubs }) {
  return (
    <div className="flex flex-col gap-2 mt-6">
      {clubs.map(({ name, members, category, joined }) => (
        <div key={name} className="bg-white/4 border border-white/7 px-3.5 py-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-white/85">{name}</div>
            <div className="text-[11px] text-white/30 mt-0.5">{category} · {members} members</div>
          </div>
          <span className={`text-[10px] font-bold px-2.5 py-1 tracking-wide uppercase ml-4 flex-shrink-0 ${joined ? 'bg-scarlet/20 text-scarlet border border-scarlet/25' : 'bg-white/8 text-white/40 border border-white/12'}`}>
            {joined ? '✓ Joined' : 'Join'}
          </span>
        </div>
      ))}
    </div>
  )
}

function RsvpMock({ meeting, counts }) {
  return (
    <div className="mt-6">
      <div className="bg-white/4 border border-white/7 p-4 mb-4">
        <div className="text-sm font-semibold text-white/85">{meeting.title}</div>
        <div className="text-[11px] text-white/30 mt-1">{meeting.location} · {meeting.time}</div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Going', count: counts.going, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
          { label: 'Maybe', count: counts.maybe, color: 'text-amber/80', bg: 'bg-amber/8 border-amber/15' },
          { label: 'Not Going', count: counts.notGoing, color: 'text-white/35', bg: 'bg-white/4 border-white/8' },
        ].map(({ label, count, color, bg }) => (
          <div key={label} className={`border ${bg} p-3 text-center`}>
            <div className={`font-display text-2xl tracking-wide ${color}`}>{count}</div>
            <div className="text-[10px] text-white/30 mt-0.5 uppercase tracking-wider">{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CodeMock({ code, count }) {
  return (
    <div className="mt-6 flex flex-col gap-3">
      <div className="bg-white/4 border border-white/7 p-4 text-center">
        <div className="text-[10px] text-white/30 uppercase tracking-[0.2em] mb-2">Attendance Code</div>
        <div className="font-display text-3xl tracking-[0.3em] text-scarlet">{code}</div>
        <div className="text-[10px] text-white/30 mt-2 flex items-center justify-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-live-pulse" />
          Attendance open
        </div>
      </div>
      <div className="text-center text-sm text-white/45">
        <span className="font-bold text-white/70">{count}</span> checked in so far
      </div>
    </div>
  )
}

function ChatMock({ messages }) {
  return (
    <div className="mt-6 flex flex-col gap-2">
      <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-scarlet/70 mb-1 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-scarlet animate-live-pulse" />
        Officers only
      </div>
      {messages.map(({ name, text }) => (
        <div key={name} className="bg-white/4 border border-white/7 px-3 py-2.5">
          <div className="text-[10px] font-bold text-scarlet/70 mb-0.5">{name}</div>
          <div className="text-[12px] text-white/60 leading-snug">{text}</div>
        </div>
      ))}
    </div>
  )
}

function AnnouncementMock({ items }) {
  return (
    <div className="mt-6 flex flex-col gap-2.5">
      {items.map(({ text, time }) => (
        <div key={time} className="bg-white/4 border border-white/7 px-3.5 py-3">
          <div className="text-[12px] text-white/70 leading-snug mb-1.5">{text}</div>
          <div className="text-[10px] text-white/25">{time}</div>
        </div>
      ))}
    </div>
  )
}

function FeatureCard({ feature }) {
  const [glowing, setGlowing] = useState(false)

  const renderMock = () => {
    const { mock } = feature
    if (mock.type === 'discovery') return <DiscoveryMock clubs={mock.clubs} />
    if (mock.type === 'rsvp') return <RsvpMock meeting={mock.meeting} counts={mock.counts} />
    if (mock.type === 'code') return <CodeMock code={mock.code} count={mock.count} />
    if (mock.type === 'chat') return <ChatMock messages={mock.messages} />
    if (mock.type === 'announcement') return <AnnouncementMock items={mock.items} />
    return null
  }

  return (
    <div
      className={`reveal relative bg-ink p-6 md:p-8 ${feature.span}`}
      style={{
        boxShadow: glowing
          ? 'inset 0 0 0 1px rgba(187,0,0,0.35), 0 0 32px rgba(187,0,0,0.1)'
          : 'none',
        transition: 'opacity 0.65s cubic-bezier(0.16,1,0.3,1), transform 0.65s cubic-bezier(0.16,1,0.3,1), filter 0.65s cubic-bezier(0.16,1,0.3,1), box-shadow 0.25s ease',
      }}
      onMouseEnter={() => setGlowing(true)}
      onMouseLeave={() => setGlowing(false)}
    >
      <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.2em] uppercase text-scarlet mb-4">
        {feature.id === 'meetings' || feature.id === 'officer' || feature.id === 'attendance' ? (
          <span className="w-2 h-2 rounded-full bg-scarlet animate-live-pulse flex-shrink-0" />
        ) : null}
        {feature.tag}
      </div>
      <div className="w-6 h-0.5 bg-scarlet mb-4" />
      <h3 className="font-display text-[clamp(22px,2.8vw,40px)] tracking-wider text-white leading-[0.92] whitespace-pre-line mb-3">
        {feature.headline}
      </h3>
      <p className="text-sm text-white/35 leading-relaxed max-w-sm">
        {feature.body}
      </p>
      {renderMock()}
    </div>
  )
}

// ─── 3D tilt helpers ─────────────────────────────────────────────────────────

function handleTilt(e) {
  const rect = e.currentTarget.getBoundingClientRect()
  const x = ((e.clientX - rect.left) / rect.width - 0.5) * 10
  const y = ((e.clientY - rect.top) / rect.height - 0.5) * -10
  e.currentTarget.style.transform = `perspective(800px) rotateX(${y}deg) rotateY(${x}deg) scale(1.02)`
}
function resetTilt(e) { e.currentTarget.style.transform = '' }

// ─── Scroll reveal hook ───────────────────────────────────────────────────────

function useReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('visible') }),
      { threshold: 0.05, rootMargin: '0px 0px -40px 0px' }
    )
    const els = document.querySelectorAll('.reveal')
    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])
}

// ─── Custom category select ───────────────────────────────────────────────────

function CategorySelect({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function select(cat) {
    onChange(cat)
    setOpen(false)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((o) => !o) }
    if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`w-full flex items-center justify-between px-4 py-4 text-[15px] border-2 bg-white font-sans transition-colors text-left ${
          open ? 'border-scarlet' : 'border-ink/20 hover:border-ink/40'
        } ${value ? 'text-ink' : 'text-warm-gray'}`}
      >
        <span>{value || 'Club Category'}</span>
        <svg
          width="16" height="16" viewBox="0 0 16 16" fill="none"
          className={`flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <path d="M3 6l5 5 5-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border-2 border-ink/20 max-h-64 overflow-y-auto shadow-[4px_4px_0_0_#0D0D0B]"
        >
          {CATEGORIES.map((cat) => (
            <li
              key={cat}
              role="option"
              aria-selected={value === cat}
              onClick={() => select(cat)}
              className={`px-4 py-3 text-[15px] font-sans cursor-pointer transition-colors ${
                value === cat
                  ? 'bg-scarlet text-white font-semibold'
                  : 'text-ink hover:bg-ink/5'
              }`}
            >
              {cat}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Registration form ────────────────────────────────────────────────────────

function ClubRegistrationForm() {
  const [fields, setFields] = useState({
    clubName: '', yourName: '', role: '', email: '',
    category: '', description: '', instagramOrWebsite: '', biggestChallenge: '',
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
    'bg-white border-2 border-ink/20 px-4 py-4 text-[15px] w-full outline-none focus:border-scarlet transition-colors font-sans text-ink placeholder:text-warm-gray'

  if (submitted) {
    return (
      <div className="text-center py-16">
        <div className="w-14 h-14 bg-scarlet/10 border-2 border-scarlet/30 flex items-center justify-center mx-auto mb-5">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M4 12l5 5 11-11" stroke="#BB0000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <p className="font-display text-3xl tracking-wider text-ink mb-2">YOU'RE REGISTERED.</p>
        <p className="font-sans text-[15px] text-warm-gray">
          We'll reach out before launch. Keep an eye on your OSU email.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-xl mx-auto">
      <input type="text" name="clubName" required placeholder="Club Name"
        value={fields.clubName} onChange={handleChange} className={inputClass} />
      <input type="text" name="yourName" required placeholder="Your Name"
        value={fields.yourName} onChange={handleChange} className={inputClass} />
      <input type="text" name="role" required placeholder="Your Role (President, VP, etc.)"
        value={fields.role} onChange={handleChange} className={inputClass} />
      <div>
        <input type="email" name="email" required placeholder="name.#@osu.edu"
          value={fields.email} onChange={handleChange} className={inputClass} />
        <p className="text-[11px] text-warm-gray mt-1.5 px-1">Must be an @osu.edu or @buckeyemail.osu.edu address</p>
      </div>
      <CategorySelect
        value={fields.category}
        onChange={(cat) => setFields((prev) => ({ ...prev, category: cat }))}
      />
      <textarea name="description" required rows={3}
        placeholder="Tell students what your club is about in 2–3 sentences"
        value={fields.description} onChange={handleChange} className={`${inputClass} resize-none`} />
      <input type="text" name="instagramOrWebsite"
        placeholder="Instagram or Website (optional) — @yourclub or yourclub.com"
        value={fields.instagramOrWebsite} onChange={handleChange} className={inputClass} />
      <textarea name="biggestChallenge" rows={2}
        placeholder="What's hardest about running your club right now? (optional)"
        value={fields.biggestChallenge} onChange={handleChange} className={`${inputClass} resize-none`} />

      {error && <p className="text-sm text-scarlet font-medium">{error}</p>}

      <button
        type="submit" disabled={loading}
        className="w-full bg-scarlet text-white font-display tracking-[0.12em] text-xl h-14 hover:bg-scarlet-bright transition-colors duration-150 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? 'REGISTERING...' : 'REGISTER MY CLUB — IT\'S FREE'}
      </button>
      <p className="text-[11px] text-warm-gray text-center">No spam. We'll only email you about Bridge.</p>
    </form>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClubsPage() {
  useReveal()

  const heroRef = useRef(null)
  const spotlightRef = useRef(null)
  const [heroReady, setHeroReady] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setHeroReady(true), 80)
    return () => clearTimeout(t)
  }, [])

  const handleHeroMouseMove = useCallback((e) => {
    if (!heroRef.current || !spotlightRef.current) return
    const rect = heroRef.current.getBoundingClientRect()
    spotlightRef.current.style.background =
      `radial-gradient(600px circle at ${e.clientX - rect.left}px ${e.clientY - rect.top}px, rgba(187,0,0,0.07), transparent 60%)`
  }, [])

  const handleHeroMouseLeave = useCallback(() => {
    if (spotlightRef.current) spotlightRef.current.style.background = 'none'
  }, [])

  function scrollToForm(e) {
    e.preventDefault()
    document.getElementById('club-registration')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="font-sans text-ink overflow-x-hidden">
      {/* Grain overlay */}
      <div aria-hidden style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999,
        opacity: 0.028, backgroundImage: GRAIN_SVG, backgroundRepeat: 'repeat',
      }} />

      {/* Header */}
      <header className="sticky top-0 z-50 px-3 pt-3 md:px-6">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between border border-white/10 bg-ink/82 px-4 backdrop-blur-xl shadow-[0_14px_50px_rgba(0,0,0,0.28)] md:px-6">
          <Link to="/" className="flex items-center gap-3 no-underline">
            <div className="flex h-7 w-7 items-center justify-center bg-scarlet flex-shrink-0">
              <span className="font-display text-white text-base leading-none">B</span>
            </div>
            <div className="flex flex-col">
              <span className="font-display text-white text-2xl tracking-[0.12em] leading-none">BRIDGE</span>
              <span className="hidden text-[10px] font-bold uppercase tracking-[0.16em] text-white/36 md:block">
                Club launch console
              </span>
            </div>
          </Link>
          <div className="flex items-center gap-3 md:gap-5">
            <Link
              to="/"
              className="hidden text-xs font-semibold uppercase tracking-[0.08em] text-white/62 transition-colors hover:text-white no-underline md:block"
            >
              For Students
            </Link>
            <div className="hidden items-center gap-2 border border-white/12 bg-white/[0.08] px-3 py-2 md:flex">
              <span className="h-2 w-2 rounded-full bg-scarlet animate-pulse-dot" />
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/78">Founding clubs open</span>
            </div>
            <a
              href="#club-registration"
              onClick={scrollToForm}
              className="bg-scarlet text-white font-sans font-semibold text-xs px-4 md:px-5 py-2.5 tracking-[0.08em] uppercase transition-all duration-150 hover:bg-scarlet-bright active:scale-95 no-underline"
            >
              Register Free
            </a>
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section
        ref={heroRef}
        className="relative bg-ink overflow-hidden min-h-[90svh] flex flex-col justify-center"
        onMouseMove={handleHeroMouseMove}
        onMouseLeave={handleHeroMouseLeave}
      >
        <div className="absolute inset-0 bg-mesh opacity-80" />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
            maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.9), transparent 94%)',
          }}
        />

        {/* Blobs */}
        <div aria-hidden className="absolute -top-32 -left-32 w-[520px] h-[520px] rounded-full bg-scarlet/[0.10] blur-[140px] animate-blob pointer-events-none" />
        <div aria-hidden className="absolute top-1/2 -right-48 w-[440px] h-[440px] rounded-full bg-amber/[0.06] blur-[120px] animate-blob-delay-2 pointer-events-none" />
        <div aria-hidden className="absolute -bottom-24 left-1/3 w-[400px] h-[400px] rounded-full bg-scarlet/[0.07] blur-[160px] animate-blob-delay-4 pointer-events-none" />

        {/* Mouse spotlight */}
        <div ref={spotlightRef} aria-hidden className="absolute inset-0 pointer-events-none" />

        {/* Left scarlet edge */}
        <div className="absolute left-0 top-0 w-1 h-full bg-scarlet" />

        {/* Watermark */}
        <div aria-hidden
          className="absolute bottom-0 right-0 font-display text-[clamp(180px,26vw,400px)] text-white/[0.025] leading-none select-none pointer-events-none tracking-wider"
          style={{ lineHeight: 0.85 }}>
          CLUBS
        </div>

        {CLUB_SIGNALS.map(({ label, meta, style }, i) => (
          <div
            key={label}
            className={`pointer-events-none absolute hidden xl:flex items-center gap-3 border border-white/10 bg-white/[0.05] px-4 py-3 backdrop-blur-sm ${style}`}
            style={{
              opacity: heroReady ? 1 : 0,
              transform: heroReady ? 'translateY(0px)' : 'translateY(16px)',
              transition: `all 650ms cubic-bezier(0.16, 1, 0.3, 1) ${320 + i * 120}ms`,
              animation: `drift ${12 + i * 2}s ease-in-out ${i * 0.5}s infinite`,
            }}
          >
            <span className="h-2.5 w-2.5 rounded-full bg-scarlet shadow-[0_0_12px_rgba(187,0,0,0.7)]" />
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/82">{label}</div>
              <div className="text-[11px] text-white/45">{meta}</div>
            </div>
          </div>
        ))}

        <div className="relative max-w-[1400px] mx-auto px-6 md:px-16 py-24 lg:py-28">
          {/* Eyebrow */}
          <div
            className="flex items-center gap-2.5 mb-8 transition-all duration-500"
            style={{ opacity: heroReady ? 1 : 0, transform: heroReady ? 'translateY(0)' : 'translateY(14px)', filter: heroReady ? 'blur(0)' : 'blur(4px)' }}
          >
            <span className="w-2 h-2 rounded-full bg-scarlet animate-pulse-dot flex-shrink-0" />
            <span className="font-sans text-[11px] font-bold tracking-[0.2em] uppercase text-white/40">
              Bridge for Clubs · Ohio State · Fall 2026
            </span>
          </div>

          {/* Headline */}
          <h1 className="font-display leading-[0.88] tracking-wider mb-10">
            {[
              { text: 'GET YOUR CLUB', color: 'text-white' },
              { text: 'DISCOVERED.', color: 'text-shimmer' },
              { text: 'EVERY DAY.', color: 'text-white/20' },
            ].map(({ text, color }, i) => (
              <span
                key={text}
                className={`block text-[clamp(42px,9vw,140px)] ${color} transition-all duration-700`}
                style={{
                  opacity: heroReady ? 1 : 0,
                  transform: heroReady ? 'translateY(0)' : 'translateY(48px)',
                  filter: heroReady ? 'blur(0)' : 'blur(8px)',
                  transitionDelay: `${0.15 + i * 0.13}s`,
                  transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                {text}
              </span>
            ))}
          </h1>

          {/* Divider */}
          <div
            className="h-px bg-white/10 mb-10 origin-left transition-all duration-700"
            style={{ opacity: heroReady ? 1 : 0, transform: heroReady ? 'scaleX(1)' : 'scaleX(0)', transitionDelay: '0.54s', transitionTimingFunction: 'cubic-bezier(0.16,1,0.3,1)' }}
          />

          {/* Body + CTA */}
          <div
            className="grid gap-10 lg:grid-cols-[1.02fr_0.98fr] lg:items-center transition-all duration-700"
            style={{ opacity: heroReady ? 1 : 0, transform: heroReady ? 'translateY(0)' : 'translateY(20px)', filter: heroReady ? 'blur(0)' : 'blur(4px)', transitionDelay: '0.60s', transitionTimingFunction: 'cubic-bezier(0.16,1,0.3,1)' }}
          >
            <div className="max-w-[540px]">
              <p className="text-[clamp(16px,1.6vw,19px)] text-white/45 leading-relaxed mb-8 font-light">
                Bridge puts your club in front of every OSU student — not just at the annual fair.
                Meeting scheduling, attendance tracking, member management, announcements, and a
                dedicated group chat. All free. All in one place.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 items-start">
                <a
                  href="#club-registration"
                  onClick={scrollToForm}
                  className="inline-block bg-scarlet text-white font-display tracking-[0.12em] text-lg px-8 py-4 hover:bg-scarlet-bright transition-colors duration-150 active:scale-[0.98] no-underline"
                >
                  REGISTER FREE →
                </a>
                <div className="flex items-center gap-2 text-[11px] text-white/25 font-medium tracking-wide uppercase self-center">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  5 min to register
                </div>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[620px]">
              <div className="absolute inset-[9%] rounded-full border border-white/7" />
              <div className="orbital-ring absolute inset-[18%] rounded-full animate-rotate-slow" />
              <div className="orbital-ring absolute inset-[30%] rounded-full animate-rotate-slow [animation-direction:reverse] [animation-duration:24s]" />
              {CLUB_ORBITALS.map(({ title, meta, style }, i) => (
                <div
                  key={title}
                  className={`absolute hidden w-44 border border-white/12 bg-white/[0.06] p-3 backdrop-blur-md md:block ${style}`}
                  style={{
                    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.35)',
                    animation: `drift ${8 + i * 2}s ease-in-out ${i * 0.6}s infinite`,
                  }}
                >
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-scarlet">{title}</div>
                  <div className="mt-1 text-sm text-white/62">{meta}</div>
                </div>
              ))}

              <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(160deg,rgba(255,255,255,0.12),rgba(255,255,255,0.03))] p-6 shadow-[0_30px_120px_rgba(0,0,0,0.45)] backdrop-blur-xl md:p-8">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.16),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.08),transparent_40%)]" />
                <div className="relative">
                  <div className="mb-6 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.18em] text-white/45">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-scarlet animate-pulse-dot" />
                      Club dashboard
                    </span>
                    <span>Bridge OSU</span>
                  </div>

                  <div className="grid gap-4 md:grid-cols-[1.05fr_0.95fr]">
                    <div className="border border-white/10 bg-ink/40 p-4 backdrop-blur-sm">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-scarlet">This week</div>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        {[
                          ['42', 'directory visits'],
                          ['14', 'new joins'],
                          ['24', 'RSVP going'],
                          ['18', 'checked in'],
                        ].map(([value, label]) => (
                          <div key={label} className="border border-white/8 bg-white/[0.03] px-3 py-3">
                            <div className="font-display text-2xl tracking-[0.08em] text-white">{value}</div>
                            <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-white/38">{label}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="border border-white/10 bg-ink/40 p-4 backdrop-blur-sm">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber">Next meeting</div>
                      <div className="mt-2 text-lg font-semibold text-white">Weekly General Meeting</div>
                      <div className="mt-1 text-sm text-white/42">Hopkins Hall 100 · Thursday 7:00 PM</div>
                      <div className="mt-4 space-y-2">
                        {[
                          ['Going', '24', 'text-green-300'],
                          ['Maybe', '7', 'text-amber'],
                          ['Not Going', '3', 'text-white/55'],
                        ].map(([label, count, color]) => (
                          <div key={label} className="flex items-center justify-between border border-white/8 bg-white/[0.03] px-3 py-2.5">
                            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/42">{label}</span>
                            <span className={`font-display text-xl ${color}`}>{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {[
                      'Free forever for clubs',
                      'Officer-only private channel',
                      '100% OSU-verified students',
                    ].map((label) => (
                      <div key={label} className="border border-white/10 bg-white/[0.04] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-white/56">
                        {label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Problem strip ────────────────────────────────────────────────────── */}
      <section className="section-divider bg-scarlet py-12 px-6 md:px-16 overflow-hidden">
        <div className="max-w-[1400px] mx-auto">
          <p className="font-display text-[clamp(20px,3.5vw,52px)] tracking-wider text-white leading-tight">
            The club fair happens once a year.{' '}
            <span className="text-white/40">Bridge is there every single day.</span>
          </p>
        </div>
      </section>

      {/* ── Feature bento ────────────────────────────────────────────────────── */}
      <section className="section-divider py-24 px-5 md:px-16 bg-ink">
        <div className="max-w-[1400px] mx-auto">
          <div className="mb-16">
            <span className="reveal block text-[11px] font-bold tracking-[0.2em] uppercase text-scarlet mb-5">
              What You Get
            </span>
            <h2 className="reveal font-display text-[clamp(36px,8vw,110px)] tracking-wider leading-[0.92]">
              <span className="text-white">EVERYTHING A</span><br />
              <span className="text-white/20">CLUB NEEDS.</span>
            </h2>
          </div>

          <div className="grid grid-cols-12 gap-px bg-white/6">
            {FEATURES.map((feature) => (
              <FeatureCard key={feature.id} feature={feature} />
            ))}

            {/* Roles + Chat + OSU row */}
            {[
              {
                tag: 'Member Roles',
                headline: 'ADMIN. OFFICER.\nMEMBER.',
                body: 'Full role hierarchy built in. Promote a member to officer, give them access to create meetings and post announcements. Remove inactive members.',
              },
              {
                tag: 'Group Chat',
                headline: 'ONE CHAT.\nEVERY MEMBER.',
                body: 'Every club gets a dedicated group chat where all members can talk. Not a GroupMe that gets buried — a real, persistent club space.',
              },
              {
                tag: 'OSU-Verified Only',
                headline: 'REAL\nBUCKEYES.',
                body: 'Every student on Bridge is verified with their OSU email. No randoms. No fake accounts. Just the students you\'re there to meet.',
              },
            ].map(({ tag, headline, body }, i) => (
              <div
                key={tag}
                className="reveal col-span-12 md:col-span-4 bg-ink p-6 md:p-8 tilt-card cursor-default"
                style={{ transitionDelay: `${i * 80}ms` }}
                onMouseMove={handleTilt}
                onMouseLeave={resetTilt}
              >
                <div className="text-[11px] font-bold tracking-[0.2em] uppercase text-scarlet mb-4">{tag}</div>
                <div className="w-6 h-0.5 bg-scarlet mb-4" />
                <h3 className="font-display text-[clamp(22px,2.5vw,36px)] tracking-wider text-white leading-[0.92] whitespace-pre-line mb-3">
                  {headline}
                </h3>
                <p className="text-sm text-white/35 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────────── */}
      <section className="section-divider py-24 px-5 md:px-16 bg-cream-dark">
        <div className="max-w-[1400px] mx-auto">
          <div className="mb-16">
            <span className="reveal block text-[11px] font-bold tracking-[0.2em] uppercase text-warm-gray mb-5">
              Getting started
            </span>
            <h2 className="reveal font-display text-[clamp(36px,8vw,110px)] tracking-wider leading-[0.92] text-ink">
              THREE STEPS.<br />
              <span className="text-scarlet">READY FOR FALL.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-ink/12">
            {STEPS.map(({ step, title, desc }, i) => (
              <div
                key={step}
                className="reveal relative overflow-hidden bg-cream-dark px-6 py-10 md:px-8 tilt-card"
                style={{ transitionDelay: `${i * 100}ms` }}
                onMouseMove={handleTilt}
                onMouseLeave={resetTilt}
              >
                <div aria-hidden className="absolute -top-3 -right-1 font-display text-[160px] text-ink/[0.05] leading-none select-none pointer-events-none">
                  {step}
                </div>
                <div className="relative">
                  <div className="text-[11px] font-bold tracking-[0.22em] uppercase text-scarlet mb-5">Step {step}</div>
                  <div className="w-8 h-0.5 bg-scarlet mb-6" />
                  <h3 className="font-display text-[clamp(22px,3vw,42px)] tracking-wider text-ink leading-[0.92] mb-5 whitespace-pre-line">{title}</h3>
                  <p className="text-sm text-warm-gray leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats bar ─────────────────────────────────────────────────────────── */}
      <section className="section-divider bg-ink px-5 pb-6 md:px-16">
        <div className="max-w-[1400px] mx-auto grid grid-cols-1 sm:grid-cols-3 border border-white/8 bg-white/[0.03] backdrop-blur-sm">
          {STATS.map(({ number, suffix, label }, i) => (
            <div
              key={label}
              className={`px-8 md:px-12 py-12 ${i < 2 ? 'border-b sm:border-b-0 sm:border-r border-white/8' : ''}`}
            >
              <div className="font-display text-[clamp(40px,6vw,80px)] leading-none tracking-wider bg-gradient-to-br from-scarlet via-scarlet-bright to-amber bg-clip-text text-transparent">
                {number}{suffix}
              </div>
              <div className="text-[10px] md:text-[11px] font-medium text-white/35 mt-2 tracking-[0.12em] uppercase">
                {label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Registration ─────────────────────────────────────────────────────── */}
      {/* Dark headline band */}
      <section id="club-registration" className="section-divider relative overflow-hidden py-20 px-5 md:px-16">
        <div aria-hidden className="absolute inset-0 animate-gradient-shift" style={{
          background: 'linear-gradient(135deg, #0D0D0B 0%, #1a0303 25%, #0D0D0B 50%, #0a0010 75%, #0D0D0B 100%)',
          backgroundSize: '300% 300%',
        }} />
        <div aria-hidden className="absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full bg-scarlet/[0.06] blur-[140px] animate-blob pointer-events-none" />
        <div className="absolute left-0 top-0 w-1 h-full bg-scarlet" />
        <div className="relative max-w-[1400px] mx-auto text-center">
          <span className="reveal block text-[11px] font-bold tracking-[0.2em] uppercase text-scarlet mb-6">
            Limited Founding Spots
          </span>
          <h2 className="reveal font-display text-[clamp(36px,7vw,100px)] tracking-wider leading-[0.92] text-white mb-6">
            GET YOUR CLUB<br />
            <span className="text-shimmer">IN FIRST.</span>
          </h2>
          <p className="reveal text-base text-white/40 leading-relaxed font-light max-w-lg mx-auto">
            Founding clubs help shape how Bridge works at Ohio State. Register now and we'll set you up personally before launch day.
          </p>
        </div>
      </section>

      {/* Cream form section */}
      <section className="bg-cream py-16 px-5 md:px-16">
        <div className="max-w-[1400px] mx-auto">
          <div className="reveal">
            <ClubRegistrationForm />
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="bg-ink border-t border-white/5 py-8">
        <div className="max-w-[1400px] mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
          <span className="text-white/25">© 2026 Bridge. All rights reserved.</span>
          <span className="text-white/25">Questions? brady.vanbibber@gmail.com</span>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="text-white/25 hover:text-white/50 transition-colors no-underline">Privacy</Link>
            <Link to="/terms" className="text-white/25 hover:text-white/50 transition-colors no-underline">Terms</Link>
            <Link to="/" className="text-white/25 hover:text-white/50 transition-colors no-underline">← Bridge</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
