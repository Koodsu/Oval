import { TESTIMONIALS } from '../data/testimonials'

const ROW = [...TESTIMONIALS, ...TESTIMONIALS, ...TESTIMONIALS]

function QuoteCard({ quote, name, role, initials, gradient }) {
  return (
    <div className="glass mx-2 w-[320px] flex-shrink-0 rounded-3xl px-7 py-8 md:w-[380px]">
      <div aria-hidden className="font-serif text-5xl italic leading-none text-flame/60">“</div>
      <p className="mt-2 text-[14px] leading-[1.75] text-white/70">{quote}</p>
      <div className="mt-6 flex items-center gap-3 border-t border-white/8 pt-5">
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradient} text-xs font-bold text-white`}>
          {initials}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-white">{name}</div>
          <div className="truncate text-[11px] text-white/35">{role}</div>
        </div>
        <span className="ml-auto flex-shrink-0 text-[10px] font-bold tracking-widest text-flame">✓ OSU</span>
      </div>
    </div>
  )
}

export default function Testimonials() {
  return (
    <section className="section-divider relative overflow-hidden bg-void py-28 text-white">
      <div aria-hidden className="absolute left-[40%] top-[-8rem] h-[26rem] w-[26rem] rounded-full bg-scarlet/10 blur-[150px]" />

      <div className="relative mx-auto mb-14 max-w-[1280px] px-5 md:px-10">
        <p className="reveal mb-5 text-[12px] font-bold uppercase tracking-[0.24em] text-flame">Early feedback</p>
        <h2 className="reveal font-display text-[clamp(38px,6vw,72px)] font-bold leading-[1.02] tracking-[-0.03em]">
          Buckeyes are
          <span className="text-gradient-fire font-serif font-normal italic"> already talking.</span>
        </h2>
      </div>

      <ul className="sr-only">
        {TESTIMONIALS.map(({ quote, name, role }) => (
          <li key={name}>{quote} — {name}, {role}</li>
        ))}
      </ul>

      <div aria-hidden="true" className="relative">
        <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-24 bg-gradient-to-r from-void to-transparent md:w-40" />
        <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-24 bg-gradient-to-l from-void to-transparent md:w-40" />
        <div className="animate-ticker flex w-max">
          {ROW.map((t, i) => (
            <QuoteCard key={`${t.name}-${i}`} {...t} />
          ))}
        </div>
      </div>
    </section>
  )
}
