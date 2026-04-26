import { useRef, useCallback } from 'react'
import WaitlistForm from './WaitlistForm'

export default function FinalCta() {
  const sectionRef = useRef(null)
  const spotlightRef = useRef(null)

  const handleMouseMove = useCallback((e) => {
    if (!sectionRef.current || !spotlightRef.current) return
    const rect = sectionRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    spotlightRef.current.style.background = `radial-gradient(700px circle at ${x}px ${y}px, rgba(187,0,0,0.07), transparent 60%)`
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (spotlightRef.current) spotlightRef.current.style.background = 'none'
  }, [])

  return (
    <section
      id="waitlist"
      ref={sectionRef}
      className="section-divider relative overflow-hidden px-5 py-28 md:px-16"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Animated gradient background */}
      <div
        aria-hidden
        className="absolute inset-0 animate-gradient-shift"
        style={{
          background: 'linear-gradient(135deg, #0D0D0B 0%, #1a0303 25%, #0D0D0B 50%, #0a0010 75%, #0D0D0B 100%)',
          backgroundSize: '300% 300%',
        }}
      />

      {/* Blob accents */}
      <div
        aria-hidden
        className="absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full bg-scarlet/[0.06] blur-[140px] animate-blob pointer-events-none"
      />
      <div
        aria-hidden
        className="absolute -bottom-24 left-1/4 w-[400px] h-[400px] rounded-full bg-amber/[0.12] blur-[120px] animate-blob-delay-2 pointer-events-none"
      />

      {/* Mouse-tracking spotlight */}
      <div
        ref={spotlightRef}
        aria-hidden
        className="absolute inset-0 pointer-events-none"
      />

      {/* Left scarlet edge */}
      <div className="absolute left-0 top-0 w-1 h-full bg-scarlet" />

      {/* Faint background type */}
      <div
        aria-hidden
        className="absolute bottom-0 right-0 font-display text-[clamp(160px,22vw,360px)] text-white/[0.025] leading-none select-none pointer-events-none tracking-wider"
        style={{ lineHeight: 0.85 }}
      >
        OSU
      </div>

      <div className="relative max-w-[1400px] mx-auto">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
          <div>
            <span className="reveal block text-[11px] font-bold tracking-[0.2em] uppercase text-scarlet mb-8">
              Limited Spots
            </span>

            <h2 className="reveal font-display text-[clamp(36px,9vw,130px)] tracking-wider leading-[0.92] text-white mb-8">
              DON'T LET YOUR BEST COLLEGE MEMORIES STAY{' '}
              <span className="text-shimmer">IN THE GROUP CHAT.</span>
            </h2>

            <p className="reveal text-base text-white/35 leading-relaxed max-w-xl mb-8 font-light">
              Bridge launches at Ohio State this fall. Early access members get in first, get founding-member
              status, and help shape the app from day one.
            </p>

            <div className="reveal flex flex-wrap gap-3 text-[11px] font-bold uppercase tracking-[0.16em] text-white/44">
              <span className="border border-white/10 bg-white/[0.04] px-3 py-2">OSU-verified access</span>
              <span className="border border-white/10 bg-white/[0.04] px-3 py-2">Founding-member badge</span>
              <span className="border border-white/10 bg-white/[0.04] px-3 py-2">Launch-day priority</span>
            </div>
          </div>

          <div className="reveal relative border border-white/10 bg-white/[0.04] p-6 md:p-8 backdrop-blur-sm shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full border border-scarlet/20 bg-scarlet/10 blur-[2px]" />
            <div className="relative">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-scarlet">Join the first wave</div>
                  <div className="mt-2 text-sm text-white/45">Claim your spot before the campus feed opens.</div>
                </div>
                <div className="hidden sm:flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-white/42">
                  <span className="h-2 w-2 rounded-full bg-scarlet animate-pulse-dot" />
                  Launch queue active
                </div>
              </div>
              <WaitlistForm dark />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
