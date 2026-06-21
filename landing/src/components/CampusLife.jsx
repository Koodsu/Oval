const MARQUEE_WORDS = [
  'pickup runs', 'study pods', 'late-night food', 'club nights', 'jam sessions',
  'sunrise hikes', 'movie marathons', 'gym partners', 'coffee crawls', 'game nights',
]

const ACTIVITY_CARDS = [
  {
    emoji: '🏐',
    title: 'Spikeball on the Oval',
    meta: '3 spots left · starts in 12 min',
    tag: 'forming',
    tone: 'scarlet',
    bar: 72,
  },
  {
    emoji: '🍜',
    title: 'Ramen mission to High St',
    meta: '4 going · leaving in 20 min',
    tag: 'locking soon',
    tone: 'amber',
    bar: 88,
  },
  {
    emoji: '📚',
    title: 'Midterm study reset',
    meta: 'Thompson floor 2 · happening now',
    tag: 'live',
    tone: 'green',
    bar: 100,
  },
]

const CLUB_CARDS = [
  {
    emoji: '🎬',
    title: 'Buckeye Film Society',
    meta: 'Screening tonight · 41 RSVPs',
    tag: 'trending',
    tone: 'amber',
    bar: 92,
  },
  {
    emoji: '🧗',
    title: 'Climbing Club',
    meta: 'Outdoor trip this weekend · 6 seats',
    tag: 'open',
    tone: 'green',
    bar: 64,
  },
  {
    emoji: '♟️',
    title: 'Chess Club',
    meta: 'Weekly meeting at 7 · 28 going',
    tag: 'active',
    tone: 'scarlet',
    bar: 80,
  },
]

const TONE = {
  scarlet: { chip: 'border-scarlet/30 bg-scarlet/15 text-[#ff6b6b]', bar: 'from-scarlet to-flame' },
  amber: { chip: 'border-amber/30 bg-amber/15 text-amber', bar: 'from-amber to-flame' },
  green: { chip: 'border-green-400/30 bg-green-400/15 text-green-400', bar: 'from-green-500 to-emerald-400' },
}

function MomentumCard({ emoji, title, meta, tag, tone, bar, delay }) {
  const t = TONE[tone]
  return (
    <div
      className="reveal glow-card rounded-2xl p-5"
      style={{ transitionDelay: `${delay}ms` }}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`)
        e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`)
      }}
    >
      <div className="flex items-center gap-3.5">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-white/[0.06] text-xl">
          {emoji}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold text-white">{title}</div>
          <div className="mt-0.5 truncate text-[12px] text-white/40">{meta}</div>
        </div>
        <span className={`flex-shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] ${t.chip}`}>
          {tag}
        </span>
      </div>
      <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/[0.07]">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${t.bar}`}
          style={{ width: `${bar}%` }}
        />
      </div>
      <div className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-white/25">momentum</div>
    </div>
  )
}

export default function CampusLife() {
  return (
    <>
      {/* ---------------- kinetic marquee divider ---------------- */}
      <div className="relative overflow-hidden border-y border-white/8 bg-void py-6">
        <div className="animate-ticker flex w-max items-center">
          {[...MARQUEE_WORDS, ...MARQUEE_WORDS].map((word, i) => (
            <span key={i} className="flex items-center whitespace-nowrap">
              <span className={`px-6 font-display text-[clamp(28px,4vw,52px)] font-bold tracking-tight ${i % 2 === 0 ? 'text-white/90' : 'text-stroke'}`}>
                {word}
              </span>
              <span className="font-serif text-2xl italic text-flame">✦</span>
            </span>
          ))}
        </div>
      </div>

      {/* ---------------- two live surfaces ---------------- */}
      <section className="relative overflow-hidden bg-void px-5 py-28 text-white md:px-10">
        <div aria-hidden className="absolute right-[-10rem] top-[10%] h-[30rem] w-[30rem] rounded-full bg-scarlet/12 blur-[150px]" />
        <div aria-hidden className="absolute bottom-[5%] left-[-8rem] h-[26rem] w-[26rem] rounded-full bg-amber/10 blur-[140px]" />

        <div className="relative mx-auto grid max-w-[1280px] gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          {/* sticky narrative column */}
          <div className="lg:sticky lg:top-32 lg:self-start">
            <p className="reveal mb-6 text-[12px] font-bold uppercase tracking-[0.24em] text-flame">
              Two live surfaces
            </p>
            <h2 className="reveal font-display text-[clamp(36px,5.5vw,64px)] font-bold leading-[1.02] tracking-[-0.03em]">
              Tonight's plans.
              <br />
              <span className="font-serif font-normal italic text-white/45">and</span> this semester's
              <br />
              <span className="text-gradient-fire">people.</span>
            </h2>
            <p className="reveal mt-6 max-w-[26rem] text-[15px] leading-relaxed text-white/50">
              Oval runs on two layers. <span className="text-white/85">Activities</span> are quick plans
              forming right now — claim a spot before it fills. <span className="text-white/85">Clubs</span> stay
              discoverable all semester, so you can see which ones are actually alive before you commit.
            </p>
            <div className="reveal mt-8 flex flex-wrap gap-2.5">
              <span className="rounded-full border border-scarlet/30 bg-scarlet/10 px-4 py-2 text-[12px] font-semibold text-[#ff6b6b]">
                ⚡ Activities · right now
              </span>
              <span className="rounded-full border border-amber/30 bg-amber/10 px-4 py-2 text-[12px] font-semibold text-amber">
                🏛 Clubs · all semester
              </span>
            </div>
          </div>

          {/* stacked live cards */}
          <div className="flex flex-col gap-10">
            <div>
              <div className="reveal mb-4 flex items-center gap-3">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-flame opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-flame" />
                </span>
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/55">Forming near you</span>
                <span className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />
              </div>
              <div className="flex flex-col gap-3">
                {ACTIVITY_CARDS.map((card, i) => (
                  <MomentumCard key={card.title} {...card} delay={i * 110} />
                ))}
              </div>
            </div>

            <div>
              <div className="reveal mb-4 flex items-center gap-3">
                <span className="text-amber">✦</span>
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/55">Clubs with a pulse</span>
                <span className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />
              </div>
              <div className="flex flex-col gap-3">
                {CLUB_CARDS.map((card, i) => (
                  <MomentumCard key={card.title} {...card} delay={i * 110} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
