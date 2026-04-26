import { TESTIMONIALS } from '../data/testimonials'

const ROW1 = [...TESTIMONIALS, ...TESTIMONIALS]
const ROW2 = [...[...TESTIMONIALS].reverse(), ...[...TESTIMONIALS].reverse()]

function QuoteCard({ quote, name, role, initials, gradient }) {
  return (
    <div className="flex-shrink-0 w-[320px] md:w-[360px] bg-cream border-2 border-ink/8 px-6 py-8 mx-1.5">
      <div
        aria-hidden
        className="font-display text-[80px] text-scarlet leading-none -mb-2 select-none opacity-20"
      >
        "
      </div>
      <p className="text-[14px] leading-[1.8] text-ink/75 mb-6">
        "{quote}"
      </p>
      <div className="border-t border-ink/10 pt-4 flex items-center gap-3">
        <div
          className={`w-9 h-9 bg-gradient-to-br ${gradient} flex items-center justify-center text-xs font-bold text-white flex-shrink-0`}
        >
          {initials}
        </div>
        <div>
          <div className="text-sm font-bold text-ink">{name}</div>
          <div className="text-xs text-warm-gray mt-0.5">{role}</div>
        </div>
        <div className="ml-auto text-[10px] font-bold text-scarlet tracking-widest flex-shrink-0">
          ✓ OSU
        </div>
      </div>
    </div>
  )
}

export default function Testimonials() {
  return (
    <section className="py-24 bg-cream overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-5 md:px-16 mb-14">
        <span className="reveal block text-[11px] font-bold tracking-[0.2em] uppercase text-warm-gray mb-5">
          Early Feedback
        </span>
        <h2 className="reveal font-display text-[clamp(36px,8vw,110px)] tracking-wider leading-[0.92] text-ink">
          BUCKEYES<br />
          <span className="text-scarlet">ARE EXCITED.</span>
        </h2>
      </div>

      {/* Row 1 — scrolling left */}
      <div className="relative mb-4">
        <div className="pointer-events-none absolute left-0 top-0 w-32 h-full bg-gradient-to-r from-cream to-transparent z-10" />
        <div className="pointer-events-none absolute right-0 top-0 w-32 h-full bg-gradient-to-l from-cream to-transparent z-10" />
        <div className="flex w-max animate-ticker">
          {ROW1.map((t, i) => (
            <QuoteCard key={`r1-${t.name}-${i}`} {...t} />
          ))}
        </div>
      </div>

      {/* Row 2 — scrolling right */}
      <div className="relative">
        <div className="pointer-events-none absolute left-0 top-0 w-32 h-full bg-gradient-to-r from-cream to-transparent z-10" />
        <div className="pointer-events-none absolute right-0 top-0 w-32 h-full bg-gradient-to-l from-cream to-transparent z-10" />
        <div className="flex w-max animate-ticker2">
          {ROW2.map((t, i) => (
            <QuoteCard key={`r2-${t.name}-${i}`} {...t} />
          ))}
        </div>
      </div>
    </section>
  )
}
