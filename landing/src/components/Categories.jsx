import { CATEGORIES } from '../data/categories'

const PILL_COLORS = [
  'border-scarlet/60 text-scarlet/90',
  'border-amber/60 text-amber/90',
  'border-green-400/60 text-green-400/90',
  'border-blue-400/60 text-blue-400/90',
  'border-purple-400/60 text-purple-400/90',
  'border-pink-400/60 text-pink-400/90',
  'border-cyan-400/60 text-cyan-400/90',
  'border-orange-400/60 text-orange-400/90',
  'border-emerald-400/60 text-emerald-400/90',
  'border-rose-400/60 text-rose-400/90',
]

const HALF = Math.ceil(CATEGORIES.length / 2)
const ROW1 = [...CATEGORIES.slice(0, HALF), ...CATEGORIES.slice(0, HALF)]
const ROW2 = [...CATEGORIES.slice(HALF), ...CATEGORIES.slice(HALF)]

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

      {/* Row 1 — left to right */}
      <div className="relative mb-3">
        <div className="pointer-events-none absolute left-0 top-0 w-24 h-full bg-gradient-to-r from-scarlet to-transparent z-10" />
        <div className="pointer-events-none absolute right-0 top-0 w-24 h-full bg-gradient-to-l from-scarlet to-transparent z-10" />
        <div className="flex gap-3 animate-ticker w-max">
          {ROW1.map(({ emoji, label }, i) => (
            <div
              key={`r1-${label}-${i}`}
              className={`flex-shrink-0 flex items-center gap-2.5 bg-white/10 border ${PILL_COLORS[i % PILL_COLORS.length]} px-5 py-3 font-semibold text-sm whitespace-nowrap hover:bg-white/20 transition-colors cursor-default`}
            >
              <span className="text-lg">{emoji}</span>
              <span className="tracking-wide">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Row 2 — right to left */}
      <div className="relative">
        <div className="pointer-events-none absolute left-0 top-0 w-24 h-full bg-gradient-to-r from-scarlet to-transparent z-10" />
        <div className="pointer-events-none absolute right-0 top-0 w-24 h-full bg-gradient-to-l from-scarlet to-transparent z-10" />
        <div className="flex gap-3 animate-ticker2 w-max">
          {ROW2.map(({ emoji, label }, i) => (
            <div
              key={`r2-${label}-${i}`}
              className={`flex-shrink-0 flex items-center gap-2.5 bg-white/10 border ${PILL_COLORS[(i + 3) % PILL_COLORS.length]} px-5 py-3 font-semibold text-sm whitespace-nowrap hover:bg-white/20 transition-colors cursor-default`}
            >
              <span className="text-lg">{emoji}</span>
              <span className="tracking-wide">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="reveal text-center text-sm text-white/40 mt-12 font-medium tracking-wide px-8">
        50+ activities. 10 categories. 1 campus to explore.
      </p>
    </section>
  )
}
