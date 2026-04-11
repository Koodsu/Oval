import { CATEGORIES } from '../data/categories'

// Double the list for seamless infinite loop
const TICKER_ITEMS = [...CATEGORIES, ...CATEGORIES]

export default function Categories() {
  return (
    <section className="bg-scarlet py-20 overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-5 md:px-16 mb-14">
        <span className="reveal block text-[11px] font-bold tracking-[0.2em] uppercase text-white/40 mb-5">
          Activities
        </span>
        <h2 className="reveal font-display text-[clamp(36px,8vw,110px)] tracking-wider leading-[0.92] text-white">
          WHATEVER<br />YOU'RE INTO.
        </h2>
      </div>

      {/* Infinite scrolling ticker */}
      <div className="relative">
        {/* Left/right fade masks */}
        <div className="pointer-events-none absolute left-0 top-0 w-24 h-full bg-gradient-to-r from-scarlet to-transparent z-10" />
        <div className="pointer-events-none absolute right-0 top-0 w-24 h-full bg-gradient-to-l from-scarlet to-transparent z-10" />

        <div className="flex gap-3 animate-ticker w-max">
          {TICKER_ITEMS.map(({ emoji, label }, i) => (
            <div
              key={`${label}-${i}`}
              className="flex-shrink-0 flex items-center gap-2.5 bg-white/12 border border-white/20 px-5 py-3 text-white font-semibold text-sm whitespace-nowrap hover:bg-white/20 transition-colors cursor-default"
            >
              <span className="text-lg">{emoji}</span>
              <span className="tracking-wide">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="reveal text-center text-sm text-white/40 mt-12 font-medium tracking-wide px-8">
        Ten categories. Hundreds of possibilities. One campus to explore.
      </p>
    </section>
  )
}
