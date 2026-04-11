import { STATS } from '../data/stats'

export default function StatsBar() {
  return (
    <div className="bg-ink">
      <div className="max-w-[1400px] mx-auto grid grid-cols-2 md:grid-cols-4 border-b border-white/5">
        {STATS.map(({ number, label }, i) => (
          <div
            key={label}
            className={[
              'px-6 md:px-12 py-10',
              // Right borders: on mobile only col 1 (index 0,2), on desktop all except last
              i % 2 === 0 ? 'border-r border-white/8' : 'md:border-r border-white/8 md:last:border-r-0',
              // Bottom border: top row on mobile (first 2 items)
              i < 2 ? 'border-b border-white/8 md:border-b-0' : '',
            ].join(' ')}
          >
            <div className="font-display text-[clamp(36px,5vw,68px)] text-scarlet leading-none tracking-wider">
              {number}
            </div>
            <div className="text-[10px] md:text-[11px] font-medium text-white/35 mt-2 tracking-[0.1em] md:tracking-[0.12em] uppercase leading-snug">
              {label}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
