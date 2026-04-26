const LANES = [
  {
    eyebrow: 'Activities',
    title: 'Jump into plans that are already moving.',
    body: 'Pickup runs, late-night food missions, study resets, jam sessions. You are not starting from zero every time you want to leave your room.',
    accent: 'from-scarlet/20 via-scarlet/8 to-transparent',
    panels: [
      { title: '3v3 at RPAC', meta: '6:30 PM · 2 spots left', badge: 'Live' },
      { title: 'Sunset walk', meta: 'Oval · starts in 22 min', badge: 'Near you' },
    ],
  },
  {
    eyebrow: 'Clubs',
    title: 'Find your people before the flyer disappears.',
    body: 'Bridge keeps clubs visible after the first week of classes. Search by vibe, category, and who actually shows up, not just who posted once.',
    accent: 'from-amber/20 via-amber/8 to-transparent',
    panels: [
      { title: 'Buckeye Film Society', meta: 'Screening tonight · 41 RSVPs', badge: 'Trending' },
      { title: 'Climbing Club', meta: 'Outdoor trip this weekend', badge: 'Open' },
    ],
  },
  {
    eyebrow: 'Events',
    title: 'Know where the energy is, not after it is over.',
    body: 'Tonight, this week, this month. Events stop feeling hidden because Bridge turns campus into a pulse instead of a bulletin board.',
    accent: 'from-white/18 via-white/6 to-transparent',
    panels: [
      { title: 'South Oval concert', meta: 'Student bands · 8:00 PM', badge: 'Tonight' },
      { title: 'Career mixer', meta: 'Fisher Hall · Thu 5 PM', badge: 'Soon' },
    ],
  },
]

export default function CampusLife() {
  return (
    <section className="section-divider relative overflow-hidden bg-ink px-5 py-24 text-white md:px-16">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(187,0,0,0.16),transparent_24%),radial-gradient(circle_at_80%_30%,rgba(245,158,11,0.12),transparent_18%)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

      <div className="relative mx-auto max-w-[1400px]">
        <div className="mb-14 max-w-[900px]">
          <p className="reveal mb-5 text-[11px] font-bold uppercase tracking-[0.2em] text-scarlet">
            Everything on campus
          </p>
          <h2 className="reveal font-display text-[clamp(38px,8vw,112px)] leading-[0.9] tracking-wider">
            ONE APP.
            <br />
            <span className="text-white/24">THREE WHOLE WORLDS.</span>
          </h2>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.88fr_1.12fr]">
          <div className="reveal border border-white/8 bg-white/[0.04] p-6 md:p-8 backdrop-blur-sm">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-scarlet">Campus radar</div>
                <div className="mt-2 max-w-sm text-sm leading-relaxed text-white/55">
                  Bridge does not just list things. It maps momentum across campus so you can feel where people are gathering.
                </div>
              </div>
              <div className="hidden h-24 w-24 rounded-full border border-white/10 md:grid place-items-center">
                <div className="h-12 w-12 rounded-full border border-scarlet/25 bg-scarlet/10 shadow-[0_0_45px_rgba(187,0,0,0.2)]" />
              </div>
            </div>

            <div className="relative h-[360px] overflow-hidden border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))]">
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  backgroundImage:
                    'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
                  backgroundSize: '44px 44px',
                }}
              />
              <div className="absolute left-[18%] top-[24%] h-28 w-28 rounded-full border border-scarlet/22 bg-scarlet/10 animate-pulse-ring" />
              <div className="absolute left-[54%] top-[18%] h-24 w-24 rounded-full border border-amber/18 bg-amber/10 animate-pulse-ring [animation-delay:1s]" />
              <div className="absolute left-[42%] top-[55%] h-36 w-36 rounded-full border border-white/12 bg-white/[0.04] animate-pulse-ring [animation-delay:2s]" />
              {[
                ['RPAC', 'left-[16%] top-[20%]'],
                ['Oval', 'left-[60%] top-[16%]'],
                ['Union', 'left-[45%] top-[56%]'],
                ['North', 'left-[74%] top-[52%]'],
                ['South', 'left-[24%] top-[72%]'],
              ].map(([label, style]) => (
                <div key={label} className={`absolute ${style} -translate-x-1/2 -translate-y-1/2`}>
                  <div className="mb-2 flex h-3 w-3 rounded-full bg-white shadow-[0_0_18px_rgba(255,255,255,0.35)]" />
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">{label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            {LANES.map(({ eyebrow, title, body, panels, accent }, index) => (
              <div
                key={eyebrow}
                className="reveal group relative overflow-hidden border border-white/8 bg-white/[0.04] p-6 md:p-8 backdrop-blur-sm transition-colors duration-300 hover:bg-white/[0.06]"
                style={{ transitionDelay: `${index * 90}ms` }}
              >
                <div className={`absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l ${accent} opacity-90`} />
                <div className="relative grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
                  <div className="max-w-[38rem]">
                    <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-scarlet">{eyebrow}</div>
                    <h3 className="mt-3 font-display text-[clamp(26px,3vw,44px)] leading-[0.95] tracking-wider text-white">
                      {title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-white/52">{body}</p>
                  </div>

                  <div className="grid w-full max-w-[280px] gap-3">
                    {panels.map(({ title: panelTitle, meta, badge }) => (
                      <div key={panelTitle} className="border border-white/10 bg-ink/55 p-4 shadow-[0_16px_38px_rgba(0,0,0,0.18)]">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-white/88">{panelTitle}</div>
                          <div className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-scarlet">
                            {badge}
                          </div>
                        </div>
                        <div className="mt-1 text-[12px] text-white/40">{meta}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
