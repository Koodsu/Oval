import WaitlistForm from './WaitlistForm'

export default function FinalCta() {
  return (
    <section id="waitlist" className="relative overflow-hidden py-28 px-5 md:px-16 bg-ink">
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
        <span className="reveal block text-[11px] font-bold tracking-[0.2em] uppercase text-scarlet mb-8">
          Limited Spots
        </span>

        <h2 className="reveal font-display text-[clamp(36px,9vw,130px)] tracking-wider leading-[0.92] text-white mb-14">
          DON'T LET YOUR BEST COLLEGE MEMORIES STAY{' '}
          <span className="text-scarlet">IN THE GROUP CHAT.</span>
        </h2>

        <div className="reveal">
          <p className="text-base text-white/35 leading-relaxed max-w-md mb-8 font-light">
            Bridge launches at Ohio State this fall. Early access members get in first,
            get founding-member status, and help shape the app from day one.
          </p>
          <WaitlistForm dark />
          <p className="mt-5 text-xs text-white/25">
            <strong className="text-white/45">847 Buckeyes</strong> already waiting. No spam. Unsubscribe anytime.
          </p>
        </div>
      </div>
    </section>
  )
}
