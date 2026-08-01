import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from '../lib/router'
import { useScrollReveal } from '../hooks/useScrollReveal'
import { API_BASE as API_URL } from '../lib/apiBase'

const GRAIN_SVG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E")`

const CATEGORIES = [
  'Sports & Fitness', 'Food & Drink', 'Academic', 'Business', 'STEM',
  'Arts & Creative', 'Social', 'Outdoors', 'Music & Entertainment',
  'Wellness', 'Gaming', 'Volunteering', 'Other',
]

const OPERATOR_PILLARS = [
  {
    title: 'Stay visible all semester',
    body: 'Oval keeps your club searchable when students are actually looking for something to join.',
  },
  {
    title: 'Know who will be there',
    body: 'Meetings come with RSVP signals and attendance tools so turnout stops being a guess.',
  },
  {
    title: 'Run the club from one surface',
    body: 'Member chat, officer chat, announcements, and meetings live together instead of across five tools.',
  },
]

const SYSTEM_BLOCKS = [
  {
    tag: 'Discovery',
    title: 'The club fair never really has to end.',
    body: 'Your club profile stays active in the Oval directory with category, vibe, and current momentum so students can find you when interest is real, not just when they happen to walk by a table.',
    mock: 'directory',
  },
  {
    tag: 'Turnout',
    title: 'Know turnout before the meeting starts.',
    body: 'Students can RSVP going, maybe, or not going. Officers get a clearer read on room size, reminders, and whether momentum is growing or slipping.',
    mock: 'turnout',
  },
  {
    tag: 'Operations',
    title: 'Lead publicly when it helps, privately when it matters.',
    body: 'Use a member-facing channel for community, an officer-only thread for planning, and announcements that do not disappear inside a noisy group chat.',
    mock: 'ops',
  },
]

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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`flex w-full items-center justify-between border px-4 py-4 text-left text-[15px] transition-colors ${
          open ? 'border-scarlet bg-white/[0.08] text-white' : 'border-white/12 bg-white/[0.06] text-white hover:border-white/24'
        }`}
      >
        <span>{value || 'Club Category'}</span>
        <span className={`text-xs transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {open ? (
        <ul className="absolute left-0 right-0 top-full z-50 mt-2 max-h-64 overflow-y-auto border border-white/12 bg-[#161613] shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
          {CATEGORIES.map((cat) => (
            <li
              key={cat}
              onClick={() => {
                onChange(cat)
                setOpen(false)
              }}
              className={`cursor-pointer px-4 py-3 text-[15px] transition-colors ${
                value === cat ? 'bg-scarlet text-white' : 'text-white/80 hover:bg-white/[0.06]'
              }`}
            >
              {cat}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function DirectoryMock() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="grid gap-3">
        {[
          { name: 'Buckeye Film Society', meta: 'Arts & Creative · 41 active members', badge: 'Trending' },
          { name: 'Climbing Club', meta: 'Sports & Fitness · Outdoor trip this weekend', badge: 'Open' },
          { name: 'Pre-Law Society', meta: 'Academic · Debate night tomorrow', badge: 'Growing' },
        ].map(({ name, meta, badge }) => (
          <div key={name} className="rounded-[1.2rem] border border-white/10 bg-white/[0.05] px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-white/90">{name}</div>
              <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-amber">
                {badge}
              </span>
            </div>
            <div className="mt-1 text-[12px] text-white/40">{meta}</div>
          </div>
        ))}
      </div>
      <div className="rounded-[1.2rem] border border-white/10 bg-white/[0.04] p-4">
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">Why discovery matters</div>
        <div className="mt-3 text-sm leading-relaxed text-white/70">
          Students do not need to remember your table from week one. They can find the club later,
          see that it still has momentum, and join when the timing is actually right.
        </div>
      </div>
    </div>
  )
}

function TurnoutMock() {
  return (
    <div className="grid gap-3">
      <div className="rounded-[1.2rem] border border-white/10 bg-white/[0.05] px-4 py-4">
        <div className="text-sm font-semibold text-white/90">Weekly General Meeting</div>
        <div className="mt-1 text-[12px] text-white/40">Hopkins Hall · Thursday at 7:00 PM</div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          ['Going', '28', 'text-green-400'],
          ['Maybe', '9', 'text-amber'],
          ['Not going', '4', 'text-white/45'],
        ].map(([label, count, tone]) => (
          <div key={label} className="rounded-[1rem] border border-white/10 bg-white/[0.04] px-3 py-3 text-center">
            <div className={`font-display text-3xl tracking-[0.08em] ${tone}`}>{count}</div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">{label}</div>
          </div>
        ))}
      </div>
      <div className="rounded-[1.2rem] border border-scarlet/16 bg-scarlet/[0.07] px-4 py-3 text-sm text-white/65">
        Meeting confidence is visible before the room opens.
      </div>
    </div>
  )
}

function OpsMock() {
  return (
    <div className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
      <div className="grid gap-3">
        <div className="rounded-[1.2rem] border border-scarlet/18 bg-scarlet/[0.08] px-4 py-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-scarlet">Officer channel</div>
          <div className="mt-2 text-sm text-white/70">“Budget is approved. Let’s publish the trip details after tonight’s meeting.”</div>
        </div>
        <div className="rounded-[1.2rem] border border-white/10 bg-white/[0.05] px-4 py-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">Member announcement</div>
          <div className="mt-2 text-sm text-white/70">Practice moved to Tuesday this week. Same room, same time.</div>
        </div>
      </div>
      <div className="rounded-[1.2rem] border border-white/10 bg-white/[0.04] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">Meeting control</div>
            <div className="mt-2 text-sm text-white/70">Open attendance when the meeting starts, share the code, then close it when everyone is in.</div>
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-amber">
            18 checked in
          </span>
        </div>
        <div className="mt-4 rounded-[1rem] border border-amber/16 bg-amber/[0.08] px-4 py-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">Attendance code</div>
          <div className="mt-2 font-display text-4xl tracking-[0.28em] text-amber">XK4T9R</div>
          <div className="mt-2 text-[12px] text-white/50">One quick code instead of a clipboard and name-crossing routine.</div>
        </div>
      </div>
    </div>
  )
}

function SystemCard({ block }) {
  return (
    <div className="reveal border border-white/8 bg-[#11110f] px-6 py-6 md:px-8 md:py-8">
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-scarlet">{block.tag}</div>
          <h3 className="mt-4 font-display text-[clamp(28px,3.3vw,48px)] leading-[0.94] tracking-[0.04em] text-white">
            {block.title}
          </h3>
          <p className="mt-4 max-w-[32rem] text-sm leading-relaxed text-white/45">{block.body}</p>
        </div>
        <div>
          {block.mock === 'directory' ? <DirectoryMock /> : null}
          {block.mock === 'turnout' ? <TurnoutMock /> : null}
          {block.mock === 'ops' ? <OpsMock /> : null}
        </div>
      </div>
    </div>
  )
}

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
    'w-full border border-white/12 bg-white/[0.06] px-4 py-4 text-[15px] text-white outline-none transition-colors placeholder:text-white/30 focus:border-scarlet'

  if (submitted) {
    return (
      <div className="py-14 text-center">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full border border-scarlet/24 bg-scarlet/8">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M4 12l5 5 11-11" stroke="#BB0000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="font-display text-3xl tracking-[0.08em] text-white">YOUR CLUB IS IN.</p>
        <p className="mt-2 text-[15px] text-white/55">We&apos;ll reach out before launch with next steps.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <input type="text" name="clubName" required placeholder="Club Name" value={fields.clubName} onChange={handleChange} className={inputClass} />
      <div className="grid gap-4 md:grid-cols-2">
        <input type="text" name="yourName" required placeholder="Your Name" value={fields.yourName} onChange={handleChange} className={inputClass} />
        <input type="text" name="role" required placeholder="Your Role" value={fields.role} onChange={handleChange} className={inputClass} />
      </div>
      <div>
        <input type="email" name="email" required placeholder="name.#@osu.edu" value={fields.email} onChange={handleChange} className={inputClass} />
        <p className="mt-1.5 px-1 text-[11px] text-white/40">Use an `@osu.edu` or `@buckeyemail.osu.edu` address.</p>
      </div>
      <CategorySelect value={fields.category} onChange={(category) => setFields((prev) => ({ ...prev, category }))} />
      <textarea name="description" required rows={4} placeholder="What does your club help students do?" value={fields.description} onChange={handleChange} className={`${inputClass} resize-none`} />
      <input type="text" name="instagramOrWebsite" placeholder="Instagram or website (optional)" value={fields.instagramOrWebsite} onChange={handleChange} className={inputClass} />
      <div>
        <label htmlFor="biggestChallenge" className="mb-2 block text-sm font-semibold text-white">
          What is hardest about running your club right now?
        </label>
        <textarea id="biggestChallenge" name="biggestChallenge" rows={3} placeholder="Optional, but helpful. Recruiting? attendance? communication? retention?" value={fields.biggestChallenge} onChange={handleChange} className={`${inputClass} resize-none`} />
      </div>
      {error ? <p className="text-sm font-medium text-scarlet">{error}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="h-14 bg-scarlet px-6 font-display text-xl tracking-[0.08em] text-white transition-colors hover:bg-scarlet-bright disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? 'REGISTERING...' : 'REGISTER MY CLUB'}
      </button>
      <p className="text-center text-[11px] text-white/40">No spam. We only email about Oval launch and club onboarding.</p>
    </form>
  )
}

export default function ClubsPage() {
  useScrollReveal()

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
      `radial-gradient(620px circle at ${e.clientX - rect.left}px ${e.clientY - rect.top}px, rgba(245,239,228,0.12), transparent 62%)`
  }, [])

  const handleHeroMouseLeave = useCallback(() => {
    if (spotlightRef.current) spotlightRef.current.style.background = 'none'
  }, [])

  return (
    <div className="overflow-x-hidden bg-ink font-sans text-white">
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

      <header className="sticky top-0 z-50 px-3 pt-3 md:px-6">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between border border-white/10 bg-ink/82 px-4 backdrop-blur-xl shadow-[0_14px_50px_rgba(0,0,0,0.28)] md:px-6">
          <Link to="/" className="flex items-center gap-3 no-underline">
            <img src="/oval-logo.png" alt="Oval" className="h-7 w-7 rounded-md" />
            <div className="flex flex-col">
              <span className="font-display text-2xl leading-none tracking-[0.12em] text-white">OVAL</span>
              <span className="hidden text-[10px] font-bold uppercase tracking-[0.16em] text-white/35 md:block">
                Club launch console
              </span>
            </div>
          </Link>
          <div className="flex items-center gap-3 md:gap-5">
            <Link to="/" className="hidden text-xs font-semibold uppercase tracking-[0.08em] text-white/60 no-underline transition-colors hover:text-white md:block">
              For Students
            </Link>
            <a href="#club-registration" className="bg-scarlet px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-white no-underline transition-colors hover:bg-scarlet-bright md:px-5">
              Register Free
            </a>
          </div>
        </div>
      </header>

      <section
        ref={heroRef}
        className="relative isolate flex min-h-[94svh] items-center overflow-hidden bg-ink pt-14 text-white"
        onMouseMove={handleHeroMouseMove}
        onMouseLeave={handleHeroMouseLeave}
      >
        <div className="absolute inset-0 bg-mesh opacity-85" />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
            maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.9), transparent 95%)',
          }}
        />
        <div aria-hidden className="absolute -left-24 top-0 h-[30rem] w-[30rem] rounded-full bg-scarlet/20 blur-[140px] animate-drift" />
        <div aria-hidden className="absolute right-[-8rem] top-[20%] h-[24rem] w-[24rem] rounded-full bg-amber/18 blur-[120px] animate-drift-slow" />
        <div aria-hidden className="absolute bottom-[-9rem] left-[34%] h-[26rem] w-[26rem] rounded-full bg-white/10 blur-[160px] animate-blob-delay-2" />
        <div ref={spotlightRef} aria-hidden className="absolute inset-0 pointer-events-none transition-[background] duration-200" />
        <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-amber via-scarlet to-white/60" />

        <div className="relative z-10 mx-auto grid w-full max-w-[1440px] gap-14 px-5 pb-16 pt-16 md:px-10 lg:grid-cols-[0.98fr_1.02fr] lg:px-16 lg:pt-24">
          <div className="max-w-[680px]">
            <div
              className="mb-7 inline-flex items-center gap-3 border border-white/10 bg-white/[0.05] px-4 py-2.5 backdrop-blur-sm"
              style={{
                opacity: heroReady ? 1 : 0,
                transform: heroReady ? 'translateY(0px)' : 'translateY(16px)',
                filter: heroReady ? 'blur(0px)' : 'blur(4px)',
                transition: 'all 600ms cubic-bezier(0.16, 1, 0.3, 1) 100ms',
              }}
            >
              <span className="h-2.5 w-2.5 rounded-full bg-amber animate-pulse-dot" />
              <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/65">
                Oval for clubs · Ohio State · Fall 2026
              </span>
            </div>

            <h1 className="font-display leading-[0.84] tracking-[0.03em] text-white">
              <span
                className="block text-[clamp(44px,14vw,72px)] sm:text-[clamp(56px,10vw,150px)]"
                style={{
                  opacity: heroReady ? 1 : 0,
                  transform: heroReady ? 'translateY(0px)' : 'translateY(42px)',
                  filter: heroReady ? 'blur(0px)' : 'blur(10px)',
                  transition: 'all 760ms cubic-bezier(0.16, 1, 0.3, 1) 180ms',
                }}
              >
                GET YOUR CLUB
              </span>
              <span
                className="block text-[clamp(44px,14vw,72px)] text-shimmer sm:text-[clamp(56px,10vw,150px)]"
                style={{
                  opacity: heroReady ? 1 : 0,
                  transform: heroReady ? 'translateY(0px)' : 'translateY(42px)',
                  filter: heroReady ? 'blur(0px)' : 'blur(10px)',
                  transition: 'all 760ms cubic-bezier(0.16, 1, 0.3, 1) 300ms',
                }}
              >
                FOUND.
              </span>
              <span
                className="block text-[clamp(44px,14vw,72px)] text-white/25 sm:text-[clamp(56px,10vw,150px)]"
                style={{
                  opacity: heroReady ? 1 : 0,
                  transform: heroReady ? 'translateY(0px)' : 'translateY(42px)',
                  filter: heroReady ? 'blur(0px)' : 'blur(10px)',
                  transition: 'all 760ms cubic-bezier(0.16, 1, 0.3, 1) 420ms',
                }}
              >
                KEEP IT MOVING.
              </span>
            </h1>

            <p
              className="mt-7 max-w-[38rem] text-[clamp(16px,1.8vw,20px)] font-light leading-relaxed text-white/60"
              style={{
                opacity: heroReady ? 1 : 0,
                transform: heroReady ? 'translateY(0px)' : 'translateY(24px)',
                transition: 'all 720ms cubic-bezier(0.16, 1, 0.3, 1) 520ms',
              }}
            >
              Oval gives clubs daily visibility, better turnout signals, and a cleaner operating surface.
              Students discover you when they are ready to join. Officers get tools that make showing up and
              following through much easier.
            </p>

            <div
              className="mt-8 grid gap-px overflow-hidden border border-white/8 bg-white/8 sm:grid-cols-3"
              style={{
                opacity: heroReady ? 1 : 0,
                transform: heroReady ? 'translateY(0px)' : 'translateY(20px)',
                transition: 'all 720ms cubic-bezier(0.16, 1, 0.3, 1) 640ms',
              }}
            >
              {OPERATOR_PILLARS.map(({ title, body }) => (
                <div key={title} className="bg-white/[0.03] px-4 py-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber">{title}</div>
                  <div className="mt-2 text-sm text-white/55">{body}</div>
                </div>
              ))}
            </div>

            <div
              className="mt-7 flex flex-wrap items-center gap-4"
              style={{
                opacity: heroReady ? 1 : 0,
                transform: heroReady ? 'translateY(0px)' : 'translateY(18px)',
                transition: 'all 720ms cubic-bezier(0.16, 1, 0.3, 1) 740ms',
              }}
            >
              <a href="#club-registration" className="inline-flex items-center gap-2 bg-scarlet px-5 py-3 text-xs font-bold uppercase tracking-[0.18em] text-white no-underline transition-colors hover:bg-scarlet-bright">
                Register your club
              </a>
              <span className="text-sm text-white/45">Free for clubs. OSU-only. We help founding clubs get set up personally.</span>
            </div>
          </div>

          <div
            className="relative mx-auto flex w-full max-w-[680px] items-center justify-center"
            style={{
              opacity: heroReady ? 1 : 0,
              transform: heroReady ? 'translateX(0px)' : 'translateX(22px)',
              transition: 'all 840ms cubic-bezier(0.16, 1, 0.3, 1) 360ms',
            }}
          >
            <div className="relative w-full max-w-[620px]">
              <div className="absolute -left-8 top-8 h-28 w-28 rounded-full border border-white/8" />
              <div className="absolute right-8 top-0 h-36 w-36 rounded-full border border-amber/10" />
              <div className="absolute bottom-6 right-16 h-24 w-24 rounded-full border border-scarlet/12" />

              <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(160deg,rgba(255,255,255,0.12),rgba(255,255,255,0.03))] shadow-[0_30px_120px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.18),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.08),transparent_38%)]" />
                <div className="absolute left-0 top-0 right-0 flex items-center justify-between border-b border-white/10 px-4 py-3">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">Club command view</div>
                    <div className="mt-1 text-sm font-semibold text-white/90">Oval makes club momentum legible</div>
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5">
                    <span className="h-2 w-2 rounded-full bg-amber animate-live-pulse" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/65">Founding clubs</span>
                  </div>
                </div>

                <div className="relative grid gap-4 px-4 pb-4 pt-[5.5rem]">
                  <div className="rounded-[1.3rem] border border-white/10 bg-white/[0.05] px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">Directory status</div>
                        <div className="mt-1 text-sm font-semibold text-white/90">Buckeye Film Society</div>
                      </div>
                      <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-amber">
                        Discoverable
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {[
                        ['Profile views', '142'],
                        ['New joins', '11'],
                        ['This week', 'Up 28%'],
                      ].map(([label, stat]) => (
                        <div key={label} className="rounded-[0.9rem] border border-white/10 bg-ink/38 px-3 py-3">
                          <div className="text-[10px] uppercase tracking-[0.14em] text-white/30">{label}</div>
                          <div className="mt-1 text-sm font-semibold text-white/85">{stat}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-[0.96fr_1.04fr]">
                    <div className="rounded-[1.3rem] border border-white/10 bg-white/[0.05] px-4 py-4">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">Tonight&apos;s turnout</div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {[
                          ['Going', '28', 'text-green-400'],
                          ['Maybe', '9', 'text-amber'],
                          ['Check-ins', '18', 'text-scarlet'],
                        ].map(([label, stat, tone]) => (
                          <div key={label} className="rounded-[0.9rem] border border-white/10 bg-ink/38 px-3 py-3 text-center">
                            <div className={`font-display text-3xl tracking-[0.08em] ${tone}`}>{stat}</div>
                            <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-white/30">{label}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <div className="rounded-[1rem] border border-scarlet/18 bg-scarlet/[0.08] px-3 py-3">
                        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-scarlet">Officer note</div>
                        <div className="mt-2 text-sm text-white/70">Post the volunteer form after tonight’s meeting recap.</div>
                      </div>
                      <div className="rounded-[1rem] border border-white/10 bg-white/[0.05] px-3 py-3">
                        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">Attendance control</div>
                        <div className="mt-2 font-display text-2xl tracking-[0.18em] text-amber">XK4T9R</div>
                        <div className="mt-2 text-[12px] text-white/50">Open the code, have members check in, then close attendance when the room is set.</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-divider relative overflow-hidden bg-[#0f0f0d] px-5 py-24 md:px-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(187,0,0,0.10),transparent_22%),radial-gradient(circle_at_82%_20%,rgba(245,158,11,0.08),transparent_18%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        <div className="mx-auto max-w-[1400px]">
          <div className="mb-14 max-w-[900px]">
            <div className="reveal text-[11px] font-bold uppercase tracking-[0.2em] text-white/45">What Oval actually does for clubs</div>
            <h2 className="reveal mt-5 font-display text-[clamp(36px,8vw,102px)] leading-[0.9] tracking-[0.05em] text-white">
              DAILY DISCOVERY.
              <br />
              <span className="text-scarlet">CLEARER TURNOUT.</span>
              <br />
              <span className="text-white/25">LESS OPERATING FRICTION.</span>
            </h2>
            <p className="reveal mt-5 max-w-2xl text-[15px] leading-relaxed text-white/50">
              The point is not to give clubs another place to post. The point is to help more students find
              the right club and help more clubs convert interest into actual attendance.
            </p>
          </div>

          <div className="grid gap-6">
            {SYSTEM_BLOCKS.map((block) => (
              <SystemCard key={block.tag} block={block} />
            ))}
          </div>
        </div>
      </section>

      <section className="section-divider relative overflow-hidden bg-ink px-5 py-24 text-white md:px-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(187,0,0,0.16),transparent_24%),radial-gradient(circle_at_82%_18%,rgba(245,158,11,0.14),transparent_22%)]" />
        <div className="relative mx-auto grid max-w-[1400px] gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="reveal">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber">Founding club promise</div>
            <h2 className="mt-5 font-display text-[clamp(34px,7vw,92px)] leading-[0.92] tracking-[0.05em]">
              WE&apos;LL HELP
              <br />
              YOU SET IT UP
              <br />
              THE RIGHT WAY.
            </h2>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-white/55">
              Early clubs are not getting dropped into a dashboard and left alone. We&apos;ll onboard founding clubs
              directly, make sure your profile and structure are right, and use your feedback to shape the product.
            </p>
            <div className="mt-8 grid gap-3">
              {[
                'Free for clubs',
                'Eligible OSU email required',
                'Direct onboarding from the Oval team',
                'Input into how club tools evolve',
              ].map((item) => (
                <div key={item} className="rounded-[1rem] border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white/70">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div id="club-registration" className="reveal border border-white/8 bg-white/[0.05] p-6 text-white shadow-[0_30px_100px_rgba(0,0,0,0.25)] backdrop-blur-sm md:p-8">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-scarlet">Register your club</div>
            <h3 className="mt-4 font-display text-[clamp(30px,4vw,56px)] leading-[0.94] tracking-[0.04em] text-white">
              JOIN THE FOUNDING
              <br />
              CLUB GROUP.
            </h3>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/55">
              Tell us who you are, what your club does, and how students should find you. We&apos;ll take it from there.
            </p>
            <div className="mt-8">
              <ClubRegistrationForm />
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/8 bg-[#0a0a08] px-5 py-10 md:px-16">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <img src="/oval-logo.png" alt="Oval" className="h-6 w-6 rounded-md" />
              <span className="font-display text-xl tracking-[0.12em] text-white">OVAL</span>
            </div>
            <p className="mt-2 text-xs tracking-wide text-white/30">Clubs work better when discovery and turnout are visible.</p>
          </div>
          <div className="flex flex-wrap gap-5 text-[11px] font-medium uppercase tracking-[0.12em] text-white/30">
            <Link to="/" className="no-underline transition-colors hover:text-white">For students</Link>
            <Link to="/privacy" className="no-underline transition-colors hover:text-white">Privacy</Link>
            <Link to="/terms" className="no-underline transition-colors hover:text-white">Terms</Link>
            <a href="mailto:contactus@theovalapp.com" className="no-underline transition-colors hover:text-white">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
