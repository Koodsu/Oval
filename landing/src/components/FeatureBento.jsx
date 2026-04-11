const MOCK_PODS = [
  {
    emoji: '🏀',
    title: '3v3 Basketball at RPAC',
    time: 'Today · 4:30 PM',
    spotsLabel: '2 spots left',
    spotStyle: 'bg-green-500/15 text-green-400 border border-green-500/25',
  },
  {
    emoji: '🎮',
    title: 'Smash Bros Tournament',
    time: 'Tonight · 7:00 PM',
    spotsLabel: 'Forming',
    spotStyle: 'bg-white/8 text-white/50 border border-white/12',
  },
]

const MOCK_USERS = [
  { initials: 'AK', name: 'Alex K.', role: 'CS Junior',        bg: 'bg-scarlet' },
  { initials: 'MR', name: 'Maya R.', role: 'Business Senior',  bg: 'bg-[#444]' },
  { initials: 'JT', name: 'Jordan T.', role: 'Pre-Med Sophomore',   bg: 'bg-ink' },
]

const SMALL_CARDS = [
  {
    num: '01',
    title: 'Group chat, built in',
    desc: 'Every pod has its own chat. Coordinate and confirm the plan — all without leaving the app.',
  },
  {
    num: '02',
    title: 'Reliability scores',
    desc: 'Show up, earn trust. Your score builds so the right people know you\'re worth inviting back.',
  },
  {
    num: '03',
    title: 'Small by design',
    desc: 'Max 8 per pod. Not a massive GroupMe — a tight group where everyone knows each other\'s name.',
  },
]

export default function FeatureBento() {
  return (
    <section className="py-24 px-5 md:px-16 bg-ink">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="mb-16">
          <span className="reveal block text-[11px] font-bold tracking-[0.2em] uppercase text-scarlet mb-5">
            Why Bridge
          </span>
          <h2 className="reveal font-display text-[clamp(36px,8vw,110px)] tracking-wider leading-[0.92]">
            <span className="text-white">BUILT</span><br />
            <span className="text-white/20">DIFFERENT.</span>
          </h2>
        </div>

        {/* Bento grid */}
        <div className="grid grid-cols-12 gap-px bg-white/6">

          {/* Big card: real-time pods */}
          <div className="reveal col-span-12 md:col-span-7 bg-ink p-6 md:p-8 transition-colors duration-200 hover:bg-white/[0.025]">
            <div className="text-[11px] font-bold tracking-[0.2em] uppercase text-scarlet mb-5">
              Real-time pods
            </div>
            <div className="w-6 h-0.5 bg-scarlet mb-5" />
            <h3 className="font-display text-[clamp(24px,3.5vw,50px)] tracking-wider text-white leading-tight mb-4">
              HAPPENING TODAY
            </h3>
            <p className="text-sm text-white/35 leading-relaxed mb-8 max-w-sm">
              No planning paralysis. Bridge shows you what's forming right now — so instead
              of "we should hang sometime," you're actually doing it. Spots fill fast.
            </p>

            <div className="flex flex-col gap-2.5">
              {MOCK_PODS.map(({ emoji, title, time, spotsLabel, spotStyle }) => (
                <div
                  key={title}
                  className="bg-white/4 border border-white/7 p-3.5 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white/8 flex items-center justify-center text-base flex-shrink-0">
                      {emoji}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white/85">{title}</div>
                      <div className="text-xs text-white/30 mt-0.5">{time}</div>
                    </div>
                  </div>
                  <span className={`${spotStyle} text-[10px] font-bold px-2.5 py-1 tracking-wide uppercase ml-4 flex-shrink-0`}>
                    {spotsLabel}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Buckeyes-only card */}
          <div className="reveal col-span-12 md:col-span-5 bg-ink p-6 md:p-8 transition-colors duration-200 hover:bg-white/[0.025]">
            <div className="text-[11px] font-bold tracking-[0.2em] uppercase text-scarlet mb-5">
              OSU-only
            </div>
            <div className="w-6 h-0.5 bg-scarlet mb-5" />
            <h3 className="font-display text-[clamp(24px,3.5vw,50px)] tracking-wider text-white leading-tight mb-4">
              BUCKEYES<br />ONLY.
            </h3>
            <p className="text-sm text-white/35 leading-relaxed mb-8">
              Every person on Bridge is OSU-verified. You already have something in
              common with everyone you meet. That changes everything.
            </p>
            <div className="flex flex-col gap-3.5">
              {MOCK_USERS.map(({ initials, name, role, bg }) => (
                <div key={initials} className="flex items-center gap-3">
                  <div className={`w-8 h-8 ${bg} flex items-center justify-center text-xs font-bold text-white flex-shrink-0`}>
                    {initials}
                  </div>
                  <span className="text-sm text-white/45">{name} · {role}</span>
                  <span className="ml-auto text-[10px] font-bold text-scarlet tracking-wider flex-shrink-0">✓ OSU</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom 3 cards */}
          {SMALL_CARDS.map(({ num, title, desc }, i) => (
            <div
              key={num}
              className="reveal col-span-12 md:col-span-4 bg-ink p-6 md:p-8 transition-colors duration-200 hover:bg-white/[0.025]"
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <div
                aria-hidden
                className="font-display text-7xl text-white/[0.05] leading-none mb-3 select-none"
              >
                {num}
              </div>
              <div className="w-6 h-0.5 bg-scarlet mb-4" />
              <h3 className="font-sans text-base font-bold text-white/85 mb-2 tracking-tight">{title}</h3>
              <p className="text-sm text-white/35 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
