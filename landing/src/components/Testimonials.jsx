import { TESTIMONIALS } from '../data/testimonials'

export default function Testimonials() {
  return (
    <section className="py-24 px-8 md:px-16 bg-cream">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="mb-16">
          <span className="reveal block text-[11px] font-bold tracking-[0.2em] uppercase text-warm-gray mb-5">
            Early Feedback
          </span>
          <h2 className="reveal font-display text-[clamp(52px,8vw,110px)] tracking-wider leading-[0.88] text-ink">
            BUCKEYES<br />
            <span className="text-scarlet">ARE EXCITED.</span>
          </h2>
        </div>

        {/* Quote grid with 1px dividers */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-ink/12">
          {TESTIMONIALS.map(({ quote, name, role, initials, gradient }, i) => (
            <div
              key={name}
              className="reveal bg-cream px-8 py-10 relative"
              style={{ transitionDelay: `${i * 90}ms` }}
            >
              {/* Decorative open-quote */}
              <div
                aria-hidden
                className="font-display text-[110px] text-scarlet leading-none -mb-4 select-none opacity-20"
              >
                "
              </div>

              <p className="text-[15px] leading-[1.85] text-ink/75 mb-8">
                "{quote}"
              </p>

              <div className="border-t border-ink/10 pt-5 flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-none bg-gradient-to-br ${gradient} flex items-center justify-center text-xs font-bold text-white flex-shrink-0`}
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
          ))}
        </div>
      </div>
    </section>
  )
}
