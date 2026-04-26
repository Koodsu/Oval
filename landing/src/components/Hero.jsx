import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import WaitlistForm from './WaitlistForm'

const PROOF_ITEMS = [
  ['Show up faster', 'Join something that is already moving.'],
  ['Meet real students', 'Every account is tied to an OSU email.'],
  ['See campus momentum', 'Pods, clubs, and plans in one surface.'],
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
      `radial-gradient(560px circle at ${x}px ${y}px, rgba(245, 239, 228, 0.12), transparent 62%)`
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (spotlightRef.current) spotlightRef.current.style.background = 'none'
  }, [])

  return (
    <section
      ref={sceneRef}
      className="relative isolate flex min-h-[100svh] items-center overflow-hidden bg-ink pt-14 text-white"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className="absolute inset-0 bg-mesh opacity-85" />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.88), transparent 95%)',
        }}
      />
      <div aria-hidden className="absolute -left-24 top-0 h-[32rem] w-[32rem] rounded-full bg-scarlet/20 blur-[140px] animate-drift" />
      <div aria-hidden className="absolute right-[-8rem] top-[18%] h-[24rem] w-[24rem] rounded-full bg-amber/16 blur-[120px] animate-drift-slow" />
      <div aria-hidden className="absolute bottom-[-10rem] left-[35%] h-[28rem] w-[28rem] rounded-full bg-white/10 blur-[160px] animate-blob-delay-2" />
      <div ref={spotlightRef} aria-hidden className="absolute inset-0 pointer-events-none transition-[background] duration-200" />
      <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-scarlet via-amber to-white/60" />

      <div
        aria-hidden
        className="absolute right-[-2rem] top-8 hidden font-display text-[clamp(180px,24vw,360px)] leading-none tracking-[0.16em] text-white/[0.03] lg:block"
      >
        ALIVE
      </div>

      <div className="relative z-10 mx-auto grid w-full max-w-[1440px] gap-14 px-5 pb-16 pt-16 md:px-10 lg:grid-cols-[1.02fr_0.98fr] lg:px-16 lg:pt-24">
        <div className="max-w-[680px]">
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
              Ohio State launch · the social layer for actually showing up
            </span>
          </div>

          <h1 className="font-display leading-[0.84] tracking-[0.03em] text-white">
            <span
              className="block text-[clamp(58px,11vw,154px)]"
              style={{
                opacity: ready ? 1 : 0,
                transform: ready ? 'translateY(0px)' : 'translateY(42px)',
                filter: ready ? 'blur(0px)' : 'blur(10px)',
                transition: 'all 760ms cubic-bezier(0.16, 1, 0.3, 1) 180ms',
              }}
            >
              STOP
            </span>
            <span
              className="block text-[clamp(58px,11vw,154px)] text-shimmer"
              style={{
                opacity: ready ? 1 : 0,
                transform: ready ? 'translateY(0px)' : 'translateY(42px)',
                filter: ready ? 'blur(0px)' : 'blur(10px)',
                transition: 'all 760ms cubic-bezier(0.16, 1, 0.3, 1) 300ms',
              }}
            >
              WATCHING CAMPUS.
            </span>
            <span
              className="block text-[clamp(58px,11vw,154px)] text-white/26"
              style={{
                opacity: ready ? 1 : 0,
                transform: ready ? 'translateY(0px)' : 'translateY(42px)',
                filter: ready ? 'blur(0px)' : 'blur(10px)',
                transition: 'all 760ms cubic-bezier(0.16, 1, 0.3, 1) 420ms',
              }}
            >
              JOIN IT.
            </span>
          </h1>

          <p
            className="mt-7 max-w-[38rem] text-[clamp(16px,1.8vw,20px)] font-light leading-relaxed text-white/62"
            style={{
              opacity: ready ? 1 : 0,
              transform: ready ? 'translateY(0px)' : 'translateY(24px)',
              transition: 'all 720ms cubic-bezier(0.16, 1, 0.3, 1) 520ms',
            }}
          >
            Bridge turns Ohio State into a live social surface. See what is forming, who is actually
            going, and which clubs still have momentum after the first week. Less lurking. More
            showing up.
          </p>

          <div
            className="mt-10"
            style={{
              opacity: ready ? 1 : 0,
              transform: ready ? 'translateY(0px)' : 'translateY(18px)',
              transition: 'all 720ms cubic-bezier(0.16, 1, 0.3, 1) 620ms',
            }}
          >
            <WaitlistForm dark />
          </div>

          <div
            className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/48"
            style={{
              opacity: ready ? 1 : 0,
              transform: ready ? 'translateY(0px)' : 'translateY(18px)',
              transition: 'all 720ms cubic-bezier(0.16, 1, 0.3, 1) 680ms',
            }}
          >
            <span>OSU students only</span>
            <span>2-10 person pods</span>
            <span>Clubs, plans, and campus momentum in one app</span>
          </div>

          <div
            className="mt-7 flex flex-wrap items-center gap-4 text-sm text-white/50"
            style={{
              opacity: ready ? 1 : 0,
              transform: ready ? 'translateY(0px)' : 'translateY(18px)',
              transition: 'all 720ms cubic-bezier(0.16, 1, 0.3, 1) 740ms',
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
              Running a club?
              <span className="text-amber">See Bridge for clubs</span>
            </Link>
          </div>

          <div
            className="relative z-20 mt-10 grid gap-px overflow-hidden border border-white/8 bg-white/8 sm:grid-cols-3"
            style={{
              opacity: ready ? 1 : 0,
              transform: ready ? 'translateY(0px)' : 'translateY(20px)',
              transition: 'all 720ms cubic-bezier(0.16, 1, 0.3, 1) 820ms',
            }}
          >
            {PROOF_ITEMS.map(([title, caption]) => (
              <div key={title} className="bg-white/[0.05] px-4 py-4 backdrop-blur-sm">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-scarlet">{title}</div>
                <div className="mt-1 text-sm text-white/68">{caption}</div>
              </div>
            ))}
          </div>
        </div>

        <div
          className="relative mx-auto flex w-full max-w-[640px] items-center justify-center lg:justify-end"
          style={{
            opacity: ready ? 1 : 0,
            transform: ready ? 'translateX(0px)' : 'translateX(22px)',
            transition: 'all 840ms cubic-bezier(0.16, 1, 0.3, 1) 360ms',
          }}
        >
          <div className="relative w-full max-w-[620px]">
            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(160deg,rgba(255,255,255,0.12),rgba(255,255,255,0.03))] shadow-[0_30px_120px_rgba(0,0,0,0.45)] backdrop-blur-xl">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.18),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.08),transparent_38%)]" />

              <div className="absolute left-0 top-0 right-0 flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/36">Bridge in motion</div>
                  <div className="mt-1 text-sm font-semibold text-white/88">Activities and clubs that feel real</div>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5">
                  <span className="h-2 w-2 rounded-full bg-scarlet animate-live-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/65">OSU only</span>
                </div>
              </div>

              <div className="relative grid gap-4 px-4 pb-4 pt-[5.5rem]">
                <div className="grid gap-4 md:grid-cols-[1.02fr_0.98fr]">
                  <div className="rounded-[1.3rem] border border-white/10 bg-white/[0.05] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-scarlet">Activities happening now</div>
                        <div className="mt-1 text-sm font-semibold text-white/88">Join without planning from scratch</div>
                      </div>
                      <div className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/60">
                        small groups
                      </div>
                    </div>
                    <div className="mt-4 space-y-3">
                      <div className="rounded-[1rem] border border-scarlet/18 bg-scarlet/[0.08] px-3 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-white">Spikeball on the Oval</div>
                          <span className="rounded-full border border-scarlet/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-scarlet">
                            forming
                          </span>
                        </div>
                        <div className="mt-1 text-[12px] text-white/55">3 spots left · starts in 12 min</div>
                      </div>
                      <div className="rounded-[1rem] border border-white/10 bg-ink/36 px-3 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-white">Coffee at Oxley&apos;s</div>
                          <span className="rounded-full border border-white/12 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/62">
                            locking soon
                          </span>
                        </div>
                        <div className="mt-1 text-[12px] text-white/48">4 people · leaving in 14 min</div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[1.3rem] border border-white/10 bg-white/[0.05] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber">Club pulse</div>
                        <div className="mt-1 text-sm font-semibold text-white/88">Find clubs that are still active</div>
                      </div>
                      <div className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/60">
                        osu only
                      </div>
                    </div>
                    <div className="mt-4 space-y-3">
                      <div className="rounded-[1rem] border border-amber/16 bg-amber/[0.08] px-3 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-white">Chess Club weekly meeting</div>
                          <span className="rounded-full border border-amber/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-amber">
                            club
                          </span>
                        </div>
                        <div className="mt-1 text-[12px] text-white/55">28 RSVPs tonight · meeting starts at 7</div>
                      </div>
                      <div className="rounded-[1rem] border border-white/10 bg-ink/36 px-3 py-3">
                        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/34">Why clubs work here</div>
                        <div className="mt-2 text-sm leading-relaxed text-white/66">
                          Students can tell a club is active before they commit to showing up.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 py-3">
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/34">Students</div>
                    <div className="mt-2 text-sm text-white/74">Plans stop feeling hypothetical.</div>
                  </div>
                  <div className="rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 py-3">
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/34">Clubs</div>
                    <div className="mt-2 text-sm text-white/74">Visibility lasts beyond the fair.</div>
                  </div>
                  <div className="rounded-[1rem] border border-scarlet/18 bg-scarlet/[0.07] px-4 py-3">
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-scarlet">Why it matters</div>
                    <div className="mt-2 text-sm leading-relaxed text-white/72">Less lurking. More actually showing up.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
