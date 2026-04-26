import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import WaitlistForm from './WaitlistForm'

const LIVE_SIGNALS = [
  { label: 'Pickup volleyball', meta: 'North Rec · 12 mins', style: 'top-[5%] left-[10%] md:left-[3%]' },
  { label: 'Cafe study pod', meta: 'Thompson · forming now', style: 'top-[18%] right-[3%] md:right-[10%]' },
  { label: 'Club fair afterparty', meta: 'Mirror Lake · tonight', style: 'bottom-[26%] left-[2%] md:left-[12%]' },
  { label: 'Film club screening', meta: 'Dreese · 8:00 PM', style: 'bottom-[10%] right-[8%]' },
]

const ORBITAL_CARDS = [
  { emoji: '🏀', title: '2 spots left', detail: '3v3 Basketball', style: 'top-[14%] left-[12%] rotate-[-7deg]' },
  { emoji: '🎸', title: 'forming now', detail: 'Dorm jam session', style: 'top-[8%] right-[12%] rotate-[8deg]' },
  { emoji: '☕', title: '5:15 PM', detail: 'Coffee walk to Oxley’s', style: 'bottom-[16%] left-[10%] rotate-[5deg]' },
  { emoji: '🎬', title: 'tonight', detail: 'Movie night crew', style: 'bottom-[10%] right-[6%] rotate-[-6deg]' },
]

const AVATAR_NODES = [
  { initials: 'AK', style: 'top-[17%] left-[50%]' },
  { initials: 'MR', style: 'top-[50%] left-[16%]' },
  { initials: 'JT', style: 'top-[47%] right-[14%]' },
  { initials: 'LC', style: 'bottom-[11%] left-[52%]' },
]

export default function Hero() {
  const [ready, setReady] = useState(false)
  const sceneRef = useRef(null)
  const spotlightRef = useRef(null)

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 80)
    return () => clearTimeout(t)
  }, [])

  const handleMouseMove = useCallback((e) => {
    if (!sceneRef.current || !spotlightRef.current) return
    const rect = sceneRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    spotlightRef.current.style.background =
      `radial-gradient(520px circle at ${x}px ${y}px, rgba(245, 239, 228, 0.12), transparent 62%)`
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (spotlightRef.current) spotlightRef.current.style.background = 'none'
  }, [])

  return (
    <section
      ref={sceneRef}
      className="relative isolate overflow-hidden min-h-[100svh] flex items-center bg-ink pt-14"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className="absolute inset-0 bg-mesh opacity-90" />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.8), transparent 92%)',
        }}
      />
      <div aria-hidden className="absolute -top-16 left-[-6rem] h-[30rem] w-[30rem] rounded-full bg-scarlet/30 blur-[140px] animate-drift" />
      <div aria-hidden className="absolute right-[-7rem] top-[16%] h-[24rem] w-[24rem] rounded-full bg-amber/20 blur-[120px] animate-drift-slow" />
      <div aria-hidden className="absolute bottom-[-9rem] left-[28%] h-[28rem] w-[28rem] rounded-full bg-scarlet/20 blur-[140px] animate-blob-delay-2" />
      <div ref={spotlightRef} aria-hidden className="absolute inset-0 pointer-events-none transition-[background] duration-200" />

      <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-scarlet via-amber to-scarlet" />
      <div
        aria-hidden
        className="absolute right-[-2rem] top-10 font-display text-[clamp(180px,24vw,360px)] leading-none tracking-[0.15em] text-white/[0.03] select-none"
      >
        BRIDGE
      </div>

      {LIVE_SIGNALS.map(({ label, meta, style }, index) => (
        <div
          key={label}
          className={`pointer-events-none absolute hidden xl:flex items-center gap-3 border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur-sm ${style}`}
          style={{
            opacity: ready ? 1 : 0,
            transform: ready ? 'translateY(0px)' : 'translateY(18px)',
            transition: `all 650ms cubic-bezier(0.16, 1, 0.3, 1) ${index * 120 + 300}ms`,
            animation: `drift ${11 + index * 2}s ease-in-out ${index * 0.4}s infinite`,
          }}
        >
          <span className="flex h-2.5 w-2.5 rounded-full bg-scarlet shadow-[0_0_12px_rgba(187,0,0,0.75)]" />
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/80">{label}</div>
            <div className="text-[11px] text-white/45">{meta}</div>
          </div>
        </div>
      ))}

      <div className="relative z-10 mx-auto grid w-full max-w-[1440px] gap-14 px-5 pb-16 pt-16 md:px-10 lg:grid-cols-[1.05fr_0.95fr] lg:px-16 lg:pt-24">
        <div className="max-w-[640px]">
          <div
            className="mb-7 inline-flex items-center gap-3 border border-white/10 bg-white/[0.05] px-4 py-2.5 backdrop-blur-sm"
            style={{
              opacity: ready ? 1 : 0,
              transform: ready ? 'translateY(0px)' : 'translateY(16px)',
              filter: ready ? 'blur(0px)' : 'blur(4px)',
              transition: 'all 600ms cubic-bezier(0.16, 1, 0.3, 1) 100ms',
            }}
          >
            <span className="h-2.5 w-2.5 rounded-full bg-scarlet animate-pulse-dot" />
            <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/65">
              Ohio State launch sequence · Fall 2026
            </span>
          </div>

          <h1 className="font-display leading-[0.84] tracking-[0.03em] text-white">
            <span
              className="block text-[clamp(64px,12vw,164px)]"
              style={{
                opacity: ready ? 1 : 0,
                transform: ready ? 'translateY(0px)' : 'translateY(42px)',
                filter: ready ? 'blur(0px)' : 'blur(10px)',
                transition: 'all 760ms cubic-bezier(0.16, 1, 0.3, 1) 180ms',
              }}
            >
              CAMPUS
            </span>
            <span
              className="block text-[clamp(64px,12vw,164px)] text-shimmer"
              style={{
                opacity: ready ? 1 : 0,
                transform: ready ? 'translateY(0px)' : 'translateY(42px)',
                filter: ready ? 'blur(0px)' : 'blur(10px)',
                transition: 'all 760ms cubic-bezier(0.16, 1, 0.3, 1) 300ms',
              }}
            >
              COMES ALIVE.
            </span>
          </h1>

          <p
            className="mt-7 max-w-[34rem] text-[clamp(16px,1.8vw,20px)] font-light leading-relaxed text-white/62"
            style={{
              opacity: ready ? 1 : 0,
              transform: ready ? 'translateY(0px)' : 'translateY(24px)',
              transition: 'all 720ms cubic-bezier(0.16, 1, 0.3, 1) 440ms',
            }}
          >
            Bridge turns Ohio State into a live feed of groups, clubs, and energy. Join what is forming
            tonight, meet people who actually show up, and stop letting college happen somewhere else.
          </p>

          <div
            className="mt-10"
            style={{
              opacity: ready ? 1 : 0,
              transform: ready ? 'translateY(0px)' : 'translateY(18px)',
              transition: 'all 720ms cubic-bezier(0.16, 1, 0.3, 1) 540ms',
            }}
          >
            <WaitlistForm dark />
          </div>

          <div
            className="mt-6 flex flex-wrap items-center gap-4 text-sm text-white/50"
            style={{
              opacity: ready ? 1 : 0,
              transform: ready ? 'translateY(0px)' : 'translateY(18px)',
              transition: 'all 720ms cubic-bezier(0.16, 1, 0.3, 1) 620ms',
            }}
          >
            <a
              href="#waitlist"
              className="inline-flex items-center gap-2 border border-white/12 px-4 py-3 font-semibold uppercase tracking-[0.14em] text-white/82 transition-colors hover:border-white/24 hover:bg-white/[0.04]"
            >
              Get Founding Access
            </a>
            <Link
              to="/clubs"
              className="inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.18em] text-white/50 transition-colors hover:text-white"
            >
              Bringing a club?
              <span className="text-scarlet">See the clubs launch</span>
            </Link>
          </div>

          <div
            className="mt-10 grid gap-px overflow-hidden border border-white/8 bg-white/8 sm:grid-cols-3"
            style={{
              opacity: ready ? 1 : 0,
              transform: ready ? 'translateY(0px)' : 'translateY(20px)',
              transition: 'all 720ms cubic-bezier(0.16, 1, 0.3, 1) 700ms',
            }}
          >
            {[
              ['Live pods', 'forming around campus'],
              ['Verified Buckeyes', 'every profile checked'],
              ['Small groups', '2 to 8 people max'],
            ].map(([title, caption]) => (
              <div key={title} className="bg-white/[0.03] px-4 py-4 backdrop-blur-sm">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-scarlet">{title}</div>
                <div className="mt-1 text-sm text-white/55">{caption}</div>
              </div>
            ))}
          </div>
        </div>

        <div
          className="relative mx-auto flex w-full max-w-[620px] items-center justify-center lg:justify-end"
          style={{
            opacity: ready ? 1 : 0,
            transform: ready ? 'translateX(0px)' : 'translateX(22px)',
            transition: 'all 840ms cubic-bezier(0.16, 1, 0.3, 1) 300ms',
          }}
        >
          <div className="relative aspect-square w-full max-w-[580px]">
            <div className="absolute inset-[10%] rounded-full border border-white/7" />
            <div className="orbital-ring absolute inset-[18%] rounded-full animate-rotate-slow" />
            <div className="orbital-ring absolute inset-[28%] rounded-full animate-rotate-slow [animation-direction:reverse] [animation-duration:22s]" />
            <div className="absolute inset-[33%] rounded-full border border-scarlet/25 animate-pulse-ring" />
            <div className="absolute inset-[21%] rounded-full border border-amber/15 animate-pulse-ring [animation-delay:1.6s]" />

            {ORBITAL_CARDS.map(({ emoji, title, detail, style }, index) => (
              <div
                key={detail}
                className={`absolute hidden w-40 border border-white/12 bg-white/[0.06] p-3 backdrop-blur-md md:block ${style}`}
                style={{
                  boxShadow: '0 24px 60px rgba(0, 0, 0, 0.35)',
                  animation: `drift ${8 + index * 2}s ease-in-out ${index * 0.5}s infinite`,
                }}
              >
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.18em] text-white/45">
                  <span>{emoji}</span>
                  <span className="text-scarlet">{title}</span>
                </div>
                <div className="mt-2 text-sm font-semibold text-white/88">{detail}</div>
              </div>
            ))}

            <div className="absolute inset-[23%] overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(160deg,rgba(255,255,255,0.12),rgba(255,255,255,0.03))] shadow-[0_30px_120px_rgba(0,0,0,0.45)] backdrop-blur-xl">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.16),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.08),transparent_38%)]" />

              {AVATAR_NODES.map(({ initials, style }, index) => (
                <div
                  key={initials}
                  className={`absolute flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/16 bg-white/[0.08] text-xs font-bold text-white shadow-[0_12px_40px_rgba(0,0,0,0.35)] ${style}`}
                  style={{ animation: `marqueeFloat ${4 + index}s ease-in-out ${index * 0.4}s infinite` }}
                >
                  {initials}
                </div>
              ))}

              <div className="absolute left-1/2 top-1/2 h-[52%] w-[52%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-scarlet/[0.08] shadow-[0_0_80px_rgba(187,0,0,0.3)]">
                <div className="absolute inset-[14%] rounded-full border border-scarlet/30" />
                <div className="absolute inset-0 grid place-items-center">
                  <div className="text-center">
                    <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/45">Live at OSU</div>
                    <div className="mt-2 font-display text-[clamp(44px,7vw,88px)] leading-none tracking-[0.08em] text-white">47</div>
                    <div className="mt-2 text-sm text-white/58">things happening around you</div>
                  </div>
                </div>
              </div>

              <div className="absolute inset-x-6 top-6 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.18em] text-white/45">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-scarlet animate-pulse-dot" />
                  Campus signal
                </span>
                <span>Real people, real plans</span>
              </div>

              <div className="absolute inset-x-6 bottom-6 grid gap-3 sm:grid-cols-2">
                <div className="border border-white/10 bg-ink/35 p-4 backdrop-blur-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-scarlet">Tonight</div>
                      <div className="mt-1 text-sm font-semibold text-white">South Oval sunset walk</div>
                    </div>
                    <div className="rounded-full border border-green-400/30 bg-green-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-green-300">
                      6 joined
                    </div>
                  </div>
                </div>
                <div className="border border-white/10 bg-ink/35 p-4 backdrop-blur-sm">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber">Club pulse</div>
                  <div className="mt-1 text-sm font-semibold text-white">Buckeye Film Society screening</div>
                  <div className="mt-2 text-[12px] text-white/45">RSVPs climbing. Starts in 2 hours.</div>
                </div>
              </div>
            </div>

            <div className="absolute bottom-4 left-1/2 w-[72%] -translate-x-1/2 border border-white/10 bg-white/[0.04] px-5 py-4 backdrop-blur-sm md:w-[62%]">
              <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold uppercase tracking-[0.16em] text-white/42">
                <span className="text-scarlet">Powered by trust</span>
                <span>Show up score</span>
                <span>Built-in chat</span>
                <span>Instant join</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
