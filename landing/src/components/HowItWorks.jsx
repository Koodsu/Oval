const STEPS = [
  {
    step: '1',
    word: 'see',
    title: 'See what’s forming',
    desc: 'Open Bridge and the feed is alive — pickup games, food runs, study pods, club nights. Filter by right now, today, or this week.',
    visual: (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5">
          <span className="text-sm">🏐</span>
          <span className="flex-1 truncate text-[12px] font-semibold text-white/85">Spikeball · Oval</span>
          <span className="rounded-full bg-scarlet/20 px-2 py-0.5 text-[9px] font-bold uppercase text-[#ff6b6b]">live</span>
        </div>
        <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 opacity-70">
          <span className="text-sm">📚</span>
          <span className="flex-1 truncate text-[12px] font-semibold text-white/85">Study pod · Thompson</span>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-bold uppercase text-white/50">today</span>
        </div>
      </div>
    ),
  },
  {
    step: '2',
    word: 'tap',
    title: 'Tap in',
    desc: 'Pods are 2–10 people around one plan. See who’s in and claim your spot in one tap — no group-chat archaeology required.',
    visual: (
      <div className="flex items-center justify-between rounded-xl border border-flame/25 bg-flame/[0.07] px-3.5 py-3">
        <div className="flex -space-x-2.5">
          {['from-scarlet to-flame', 'from-amber to-flame', 'from-purple-500 to-pink-500', 'from-cyan-500 to-blue-500'].map((g, i) => (
            <div key={i} className={`h-8 w-8 rounded-full border-2 border-[#100c0c] bg-gradient-to-br ${g}`} />
          ))}
        </div>
        <span className="rounded-full bg-gradient-to-r from-scarlet to-flame px-4 py-1.5 text-[11px] font-bold text-white shadow-[0_4px_16px_rgba(187,0,0,0.4)]">
          Join · 2 spots left
        </span>
      </div>
    ),
  },
  {
    step: '3',
    word: 'go',
    title: 'Show up',
    desc: 'Pod chat locks the details, you go, and your reliability score grows — so the people worth meeting know you actually show.',
    visual: (
      <div className="flex flex-col gap-2">
        <div className="max-w-[80%] self-start rounded-2xl rounded-bl-md bg-white/[0.07] px-3.5 py-2 text-[12px] text-white/75">
          we're by the south goal 🏐
        </div>
        <div className="max-w-[80%] self-end rounded-2xl rounded-br-md bg-gradient-to-r from-scarlet to-flame px-3.5 py-2 text-[12px] font-medium text-white">
          omw, 2 min
        </div>
      </div>
    ),
  },
]

export default function HowItWorks() {
  return (
    <section className="section-divider relative overflow-hidden bg-void px-5 py-28 text-white md:px-10">
      <div aria-hidden className="absolute left-[15%] top-[-6rem] h-[24rem] w-[24rem] rounded-full bg-scarlet/10 blur-[140px]" />

      <div className="relative mx-auto max-w-[1280px]">
        <div className="mb-16 text-center">
          <p className="reveal mb-5 text-[12px] font-bold uppercase tracking-[0.24em] text-flame">How it works</p>
          <h2 className="reveal font-display text-[clamp(38px,6vw,72px)] font-bold leading-[1.02] tracking-[-0.03em]">
            From <span className="font-serif font-normal italic text-white/45">"we should hang"</span>
            <br />
            to <span className="text-gradient-fire">actually hanging.</span>
          </h2>
        </div>

        <div className="relative grid gap-5 md:grid-cols-3">
          {/* connector line */}
          <div aria-hidden className="absolute left-[12%] right-[12%] top-9 hidden h-px bg-gradient-to-r from-scarlet/50 via-flame/40 to-amber/50 md:block" />

          {STEPS.map(({ step, word, title, desc, visual }, i) => (
            <div
              key={step}
              className="reveal glow-card relative flex flex-col rounded-3xl p-7"
              style={{ transitionDelay: `${i * 130}ms` }}
              onMouseMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect()
                e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`)
                e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`)
              }}
            >
              <div className="mb-7 flex items-center justify-between">
                <div className="relative flex h-[4.5rem] w-[4.5rem] items-center justify-center">
                  <div className="absolute inset-0 rounded-full border border-flame/30 bg-flame/[0.06]" />
                  <span className="font-serif text-4xl italic text-gradient-fire">{step}</span>
                </div>
                <span className="font-serif text-[64px] italic leading-none text-white/[0.07]">{word}</span>
              </div>

              <h3 className="font-display text-[22px] font-bold tracking-tight text-white">{title}</h3>
              <p className="mt-3 flex-1 text-[14px] leading-relaxed text-white/45">{desc}</p>

              <div className="mt-7 rounded-2xl border border-white/8 bg-[#0c0909]/80 p-3">
                {visual}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
