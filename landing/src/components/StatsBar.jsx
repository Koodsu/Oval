import { STATS } from '../data/stats'

export default function StatsBar() {
  return (
    <div className="bg-ink">
      <div className="max-w-[1400px] mx-auto px-0 flex flex-wrap border-b border-white/5">
        {STATS.map(({ number, label }, i) => (
          <div
            key={label}
            className="flex-1 min-w-[140px] px-8 md:px-12 py-10 border-r border-white/8 last:border-r-0"
          >
            <div className="font-display text-[clamp(40px,5vw,68px)] text-scarlet leading-none tracking-wider">
              {number}
            </div>
            <div className="text-[11px] font-medium text-white/35 mt-2 tracking-[0.12em] uppercase">
              {label}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
