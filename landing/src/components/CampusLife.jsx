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
            <span className="text-white/24">TWO LIVE SURFACES.</span>
          </h2>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.88fr_1.12fr]">
          <div className="reveal border border-white/8 bg-white/[0.04] p-6 md:p-8 backdrop-blur-sm">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-scarlet">Why it feels different</div>
                <div className="mt-2 max-w-sm text-sm leading-relaxed text-white/55">
                  Bridge is useful when you want plans now and when you want a club that still feels alive a month from now.
                </div>
              </div>
              <div className="hidden h-24 w-24 rounded-full border border-white/10 md:grid place-items-center">
                <div className="h-12 w-12 rounded-full border border-scarlet/25 bg-scarlet/10 shadow-[0_0_45px_rgba(187,0,0,0.2)]" />
              </div>
            </div>

            <div className="grid gap-4">
              <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-ink/38">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-scarlet">Activity layer</div>
                    <div className="mt-1 text-sm text-white/68">Quick plans with clear momentum.</div>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/55">
                    right now
                  </div>
                </div>
                <div className="grid gap-3 p-4">
                  <div className="rounded-[1rem] border border-scarlet/18 bg-scarlet/[0.08] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-white">3v3 at RPAC</div>
                      <span className="rounded-full border border-scarlet/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-scarlet">Live</span>
                    </div>
                    <div className="mt-1 text-[12px] text-white/54">2 spots left · starts at 6:30 PM</div>
                  </div>
                  <div className="rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-white">Sunset walk</div>
                      <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/58">Near you</span>
                    </div>
                    <div className="mt-1 text-[12px] text-white/48">Oval · starts in 22 min</div>
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-ink/38">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber">Club layer</div>
                    <div className="mt-1 text-sm text-white/68">Clubs stay discoverable after the fair.</div>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/55">
                    all semester
                  </div>
                </div>
                <div className="grid gap-3 p-4">
                  <div className="rounded-[1rem] border border-amber/16 bg-amber/[0.08] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-white">Buckeye Film Society</div>
                      <span className="rounded-full border border-amber/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-amber">Trending</span>
                    </div>
                    <div className="mt-1 text-[12px] text-white/54">Screening tonight · 41 RSVPs</div>
                  </div>
                  <div className="rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-white">Climbing Club</div>
                      <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/58">Open</span>
                    </div>
                    <div className="mt-1 text-[12px] text-white/48">Outdoor trip this weekend</div>
                  </div>
                </div>
              </div>
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
