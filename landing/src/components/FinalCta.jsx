import { useCallback, useRef } from 'react'
import WaitlistForm from './WaitlistForm'

const CATEGORY_PILLS = [
  '🏈 Sports & Fitness', '🍕 Food & Drink', '📚 Academic', '🎨 Arts & Creative',
  '🎉 Social', '🌳 Outdoors', '🎵 Music', '🧘 Wellness', '🎮 Gaming', '🤝 Volunteering',
]

export default function FinalCta() {
  const sectionRef = useRef(null)
  const spotlightRef = useRef(null)

  const handleMouseMove = useCallback((e) => {
    if (!sectionRef.current || !spotlightRef.current) return
    const rect = sectionRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    spotlightRef.current.style.background =
      `radial-gradient(640px circle at ${x}px ${y}px, rgba(255,75,38,0.08), transparent 60%)`
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (spotlightRef.current) spotlightRef.current.style.background = 'none'
  }, [])

  return (
    <section
      id="waitlist"
      ref={sectionRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="section-divider relative overflow-hidden bg-void px-5 py-32 text-white md:px-10"
    >
      {/* glow core */}
      <div aria-hidden className="absolute left-1/2 top-1/2 h-[42rem] w-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-scarlet/15 blur-[180px]" />
      <div aria-hidden className="absolute left-1/2 top-1/2 hidden h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-flame/15 md:block animate-spin-slow" />
      <div aria-hidden className="absolute left-1/2 top-1/2 hidden h-[44rem] w-[44rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.05] md:block" />
      <div ref={spotlightRef} aria-hidden className="pointer-events-none absolute inset-0" />

      <div className="relative mx-auto flex max-w-[880px] flex-col items-center text-center">
        <div className="reveal mb-8 inline-flex items-center gap-2.5 rounded-full border border-white/12 bg-white/[0.05] py-2 pl-3 pr-4 backdrop-blur-md">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-flame opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-flame" />
          </span>
          <span className="text-[12px] font-semibold tracking-wide text-white/75">Launch queue is open</span>
        </div>

        <h2 className="reveal font-display text-[clamp(40px,7vw,88px)] font-bold leading-[1.0] tracking-[-0.03em]">
          Your best college
          <br />
          memories are
          <span className="text-gradient-fire font-serif font-normal italic"> out there.</span>
        </h2>

        <p className="reveal mt-7 max-w-[32rem] text-[16px] leading-relaxed text-white/50">
          Not in the group chat. Not in your camera roll of screenshots. Out there —
          and Bridge is how you find them. Join the waitlist and be first in when we launch at OSU.
        </p>

        <div className="reveal mt-10 w-full max-w-[480px]">
          <WaitlistForm dark centered />
        </div>

        <div className="reveal mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px] text-white/35">
          <span>Early access</span>
          <span className="h-1 w-1 rounded-full bg-white/20" />
          <span>Launch updates</span>
          <span className="h-1 w-1 rounded-full bg-white/20" />
          <span>Shape the app with feedback</span>
        </div>

        <div className="reveal mt-14 flex max-w-[720px] flex-wrap items-center justify-center gap-2.5">
          {CATEGORY_PILLS.map((pill) => (
            <span
              key={pill}
              className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[12px] font-medium text-white/55 transition-colors duration-200 hover:border-flame/40 hover:text-white"
            >
              {pill}
            </span>
          ))}
        </div>
        <p className="reveal mt-6 text-[12px] font-medium uppercase tracking-[0.18em] text-white/25">
          50 activities · 10 categories · 1 campus
        </p>
      </div>
    </section>
  )
}
