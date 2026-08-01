import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from '../lib/router'
import WaitlistForm from './WaitlistForm'

const FEED_CARDS = [
  { emoji: '🏐', title: 'Spikeball on the Oval', meta: '3 spots left · starts in 12 min', tag: 'forming', tone: 'scarlet' },
  { emoji: '🍗', title: "Late-night Cane's run", meta: '4 going · leaving 11:15 PM', tag: 'locking', tone: 'amber' },
  { emoji: '🏀', title: '3v3 at the RPAC', meta: '2 spots left · 6:30 PM', tag: 'live', tone: 'scarlet' },
  { emoji: '📚', title: 'Study reset @ Thompson', meta: '5 people · floor 2 · now', tag: 'open', tone: 'white' },
  { emoji: '♟️', title: 'Chess Club weekly', meta: '28 RSVPs · tonight at 7', tag: 'club', tone: 'amber' },
  { emoji: '🌅', title: 'Sunset walk on the Oval', meta: 'starts in 22 min', tag: 'near you', tone: 'white' },
  { emoji: '🎮', title: 'Smash tournament', meta: '12 in · bracket at 8', tag: 'forming', tone: 'scarlet' },
  { emoji: '🧗', title: 'Climbing Club trip', meta: 'this weekend · 6 seats', tag: 'club', tone: 'amber' },
]

const TICKER_ITEMS = [
  'Spikeball on the Oval — 3 spots',
  "Cane's run — leaving 11:15",
  '3v3 at the RPAC — 2 spots',
  'Chess Club — 28 RSVPs tonight',
  'Study pod @ Thompson — now',
  'Sunset walk — 22 min',
  'Smash bracket — 12 in',
  'Climbing trip — 6 seats',
]

const TONE = {
  scarlet: 'border-scarlet/30 bg-scarlet/15 text-[#ff6b6b]',
  amber: 'border-amber/30 bg-amber/15 text-amber',
  white: 'border-white/15 bg-white/10 text-white/70',
}

function FeedCard({ emoji, title, meta, tag, tone }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.05] px-3.5 py-3">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/[0.07] text-lg">
        {emoji}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold text-white">{title}</div>
        <div className="mt-0.5 truncate text-[11px] text-white/45">{meta}</div>
      </div>
      <span className={`flex-shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] ${TONE[tone]}`}>
        {tag}
      </span>
    </div>
  )
}

function FloatingChip({ className, animation, children }) {
  return (
    <div
      data-depth
      className={`absolute z-20 hidden items-center gap-2 rounded-2xl border border-white/12 bg-[#141010]/90 px-3.5 py-2.5 shadow-[0_16px_48px_rgba(0,0,0,0.55)] backdrop-blur-xl lg:flex ${animation} ${className}`}
    >
      {children}
    </div>
  )
}

export default function Hero() {
  const [ready, setReady] = useState(false)
  const sceneRef = useRef(null)
  const phoneRef = useRef(null)
  const chipsRef = useRef(null)

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 60)
    return () => clearTimeout(t)
  }, [])

  // scroll-driven phone straightening
  useEffect(() => {
    let raf = null
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = null
        if (!phoneRef.current) return
        const progress = Math.min(window.scrollY / 600, 1)
        const ry = -16 + progress * 16
        const rx = 6 - progress * 6
        const rz = 3 - progress * 3
        phoneRef.current.style.transform =
          `perspective(1400px) rotateY(${ry}deg) rotateX(${rx}deg) rotateZ(${rz}deg)`
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  // mouse parallax on floating chips
  const handleMouseMove = useCallback((e) => {
    if (!sceneRef.current || !chipsRef.current) return
    const rect = sceneRef.current.getBoundingClientRect()
    const dx = (e.clientX - rect.left) / rect.width - 0.5
    const dy = (e.clientY - rect.top) / rect.height - 0.5
    const chips = chipsRef.current.querySelectorAll('[data-depth]')
    chips.forEach((chip, i) => {
      const depth = 10 + (i % 3) * 8
      chip.style.translate = `${-dx * depth}px ${-dy * depth}px`
    })
  }, [])

  const enter = (delay, extra = {}) => ({
    opacity: ready ? 1 : 0,
    transform: ready ? 'translateY(0)' : 'translateY(36px)',
    filter: ready ? 'blur(0)' : 'blur(8px)',
    transition: `all 850ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
    ...extra,
  })

  return (
    <section
      ref={sceneRef}
      onMouseMove={handleMouseMove}
      className="relative isolate flex min-h-[100svh] items-center overflow-hidden bg-void pt-24 text-white"
    >
      {/* aurora + grid backdrop */}
      <div className="absolute inset-0 bg-aurora" />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(rgba(255,255,255,0.09) 1px, transparent 1px)',
          backgroundSize: '34px 34px',
          maskImage: 'radial-gradient(ellipse 75% 65% at 50% 35%, #000 20%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse 75% 65% at 50% 35%, #000 20%, transparent 75%)',
        }}
      />
      <div aria-hidden className="absolute -left-40 top-[-10%] h-[40rem] w-[40rem] rounded-full bg-scarlet/25 blur-[160px] animate-drift" />
      <div aria-hidden className="absolute right-[-12rem] top-[30%] h-[30rem] w-[30rem] rounded-full bg-amber/15 blur-[140px] animate-drift-slow" />
      <div aria-hidden className="absolute bottom-[-14rem] left-[30%] h-[34rem] w-[34rem] rounded-full bg-flame/15 blur-[170px] animate-blob-delay-2" />

      <div className="relative z-10 mx-auto grid w-full max-w-[1280px] items-center gap-16 px-5 pb-28 pt-10 md:px-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
        {/* ---------------- left: copy ---------------- */}
        <div className="max-w-[640px]">
          <div
            className="mb-8 inline-flex items-center gap-2.5 rounded-full border border-white/12 bg-white/[0.05] py-2 pl-3 pr-4 backdrop-blur-md"
            style={enter(100)}
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-flame opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-flame" />
            </span>
            <span className="text-[12px] font-semibold tracking-wide text-white/75">
              Launching at Ohio State · waitlist open
            </span>
          </div>

          <h1 className="font-display font-bold leading-[0.98] tracking-[-0.03em]">
            <span className="block text-[clamp(44px,7.5vw,84px)]" style={enter(200)}>
              Campus is
            </span>
            <span className="block text-[clamp(44px,7.5vw,84px)]" style={enter(320)}>
              happening
            </span>
            <span
              className="text-gradient-fire block pb-2 font-serif text-[clamp(56px,9.5vw,112px)] font-normal italic leading-[0.95] tracking-[-0.01em]"
              style={enter(440)}
            >
              right now.
            </span>
          </h1>

          <p
            className="mt-6 max-w-[34rem] text-[clamp(16px,1.6vw,19px)] font-normal leading-relaxed text-white/55"
            style={enter(560)}
          >
            Oval shows you what's forming around you — pickup games, study pods,
            late-night food runs, clubs that are actually alive.
            <span className="text-white/85"> See it. Tap in. Show up.</span>
          </p>

          <div className="mt-9" style={enter(660)}>
            <WaitlistForm dark />
          </div>

          <div
            className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-white/40"
            style={enter(740)}
          >
            <span className="flex items-center gap-1.5">
              <span className="text-flame">✓</span> OSU students only
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-flame">✓</span> Small groups of 2–10
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-flame">✓</span> Free, no ads
            </span>
          </div>

          <div className="mt-8" style={enter(820)}>
            <Link
              to="/clubs"
              className="group inline-flex items-center gap-2 text-[13px] font-semibold text-white/45 no-underline transition-colors hover:text-white"
            >
              Running a club?
              <span className="text-amber">See Oval for clubs</span>
              <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
            </Link>
          </div>
        </div>

        {/* ---------------- right: live phone ---------------- */}
        <div
          ref={chipsRef}
          className="relative mx-auto w-full max-w-[420px]"
          style={enter(500, { transitionDuration: '1000ms' })}
        >
          {/* glow behind phone */}
          <div aria-hidden className="absolute left-1/2 top-1/2 h-[120%] w-[120%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-scarlet/15 blur-[100px]" />

          {/* floating notification chips */}
          <FloatingChip className="-left-24 top-[12%]" animation="animate-float">
            <span className="text-base">🏀</span>
            <div>
              <div className="text-[11px] font-bold text-white">Spot opened up</div>
              <div className="text-[10px] text-white/45">3v3 at the RPAC · 6:30</div>
            </div>
          </FloatingChip>
          <FloatingChip className="-right-20 top-[34%]" animation="animate-float-slow">
            <span className="relative flex h-2 w-2 flex-shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
            </span>
            <div className="text-[11px] font-bold text-white">Your pod is locked in 🔒</div>
          </FloatingChip>
          <FloatingChip className="-left-16 bottom-[18%]" animation="animate-float-slower">
            <span className="text-base">♟️</span>
            <div>
              <div className="text-[11px] font-bold text-white">Chess Club is trending</div>
              <div className="text-[10px] text-white/45">28 RSVPs for tonight</div>
            </div>
          </FloatingChip>

          {/* the phone */}
          <div
            ref={phoneRef}
            className="phone-frame relative mx-auto w-[min(340px,86vw)] overflow-hidden p-2.5 will-change-transform"
            style={{ transform: 'perspective(1400px) rotateY(-16deg) rotateX(6deg) rotateZ(3deg)' }}
          >
            <div className="relative overflow-hidden rounded-[2rem] bg-[#0c0909]">
              {/* status bar */}
              <div className="flex items-center justify-between px-5 pb-2 pt-4">
                <span className="text-[11px] font-semibold text-white/70">9:41</span>
                <div className="h-5 w-24 rounded-full bg-black ring-1 ring-white/10" />
                <span className="text-[11px] font-semibold text-white/70">𝄢 ⚡︎</span>
              </div>
              {/* app header */}
              <div className="flex items-center justify-between px-4 pb-3 pt-1">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-flame">happening now</div>
                  <div className="font-display text-[17px] font-bold text-white">Columbus, OH</div>
                </div>
                <div className="flex items-center gap-1.5 rounded-full border border-flame/30 bg-flame/10 px-2.5 py-1">
                  <span className="h-1.5 w-1.5 animate-live-pulse rounded-full bg-flame" />
                  <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-flame">live</span>
                </div>
              </div>
              {/* infinite feed */}
              <div className="feed-mask relative h-[420px] overflow-hidden px-3 pb-3">
                <div className="animate-feed-loop flex flex-col gap-2.5">
                  {[...FEED_CARDS, ...FEED_CARDS].map((card, i) => (
                    <FeedCard key={`${card.title}-${i}`} {...card} />
                  ))}
                </div>
              </div>
              {/* tab bar */}
              <div className="flex items-center justify-around border-t border-white/8 bg-[#0c0909] px-4 py-3.5">
                {['⌂', '◎', '✦', '☷', '◉'].map((icon, i) => (
                  <span key={i} className={`text-[15px] ${i === 0 ? 'text-flame' : 'text-white/25'}`}>{icon}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------- live ticker ---------------- */}
      <div className="absolute inset-x-0 bottom-0 z-20 border-t border-white/8 bg-void/70 backdrop-blur-xl">
        <div className="flex items-center">
          <div className="z-10 flex flex-shrink-0 items-center gap-2 border-r border-white/10 bg-void px-4 py-3.5 md:px-6">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-flame opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-flame" />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/80">Live</span>
          </div>
          <div className="relative flex-1 overflow-hidden">
            <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-16 bg-gradient-to-r from-void to-transparent" />
            <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-16 bg-gradient-to-l from-void to-transparent" />
            <div className="animate-ticker-fast flex w-max items-center">
              {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
                <span key={i} className="flex items-center whitespace-nowrap px-5 py-3.5 text-[12px] font-medium text-white/45">
                  {item}
                  <span className="ml-10 h-1 w-1 rounded-full bg-flame/60" />
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
