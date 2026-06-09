function track(e) {
  const r = e.currentTarget.getBoundingClientRect()
  e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`)
  e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`)
}

const VERIFIED_USERS = [
  { initials: 'AK', name: 'Alex K.', role: 'CS · Junior', g: 'from-scarlet to-flame' },
  { initials: 'MR', name: 'Maya R.', role: 'Business · Senior', g: 'from-amber to-orange-500' },
  { initials: 'JT', name: 'Jordan T.', role: 'Pre-Med · Sophomore', g: 'from-purple-500 to-pink-500' },
]

export default function FeatureBento() {
  return (
    <section className="section-divider relative overflow-hidden bg-void px-5 py-28 text-white md:px-10">
      <div aria-hidden className="absolute right-[8%] top-[20%] h-[26rem] w-[26rem] rounded-full bg-amber/10 blur-[150px]" />
      <div aria-hidden className="absolute bottom-[-8rem] left-[5%] h-[28rem] w-[28rem] rounded-full bg-scarlet/12 blur-[160px]" />

      <div className="relative mx-auto max-w-[1280px]">
        <div className="mb-16 max-w-[760px]">
          <p className="reveal mb-5 text-[12px] font-bold uppercase tracking-[0.24em] text-flame">Why Bridge</p>
          <h2 className="reveal font-display text-[clamp(38px,6vw,72px)] font-bold leading-[1.02] tracking-[-0.03em]">
            Built for showing up,
            <br />
            <span className="font-serif font-normal italic text-gradient-fire">not scrolling.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
          {/* live pods — wide */}
          <div className="reveal glow-card rounded-3xl p-7 md:col-span-4" onMouseMove={track}>
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-flame opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-flame" />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-flame">Real-time pods</span>
            </div>
            <h3 className="mt-4 font-display text-[clamp(24px,2.6vw,34px)] font-bold tracking-tight">
              No planning paralysis.
            </h3>
            <p className="mt-3 max-w-[30rem] text-[14px] leading-relaxed text-white/45">
              Bridge shows what's forming right now — so instead of "we should hang sometime,"
              you're actually doing it. Spots fill fast, which is exactly the point.
            </p>
            <div className="mt-6 flex flex-col gap-2.5">
              <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <span className="text-lg">🏀</span>
                  <div>
                    <div className="text-[13px] font-semibold text-white">3v3 at the RPAC</div>
                    <div className="text-[11px] text-white/35">Today · 4:30 PM</div>
                  </div>
                </div>
                <span className="flex items-center gap-1.5 rounded-full border border-green-400/25 bg-green-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-green-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
                  2 spots left
                </span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <span className="text-lg">🎮</span>
                  <div>
                    <div className="text-[13px] font-semibold text-white">Smash tournament</div>
                    <div className="text-[11px] text-white/35">Tonight · 7:00 PM</div>
                  </div>
                </div>
                <span className="rounded-full border border-white/12 bg-white/[0.06] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white/55">
                  forming
                </span>
              </div>
            </div>
          </div>

          {/* OSU only */}
          <div className="reveal glow-card rounded-3xl p-7 md:col-span-2" style={{ transitionDelay: '100ms' }} onMouseMove={track}>
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-flame">Verified campus</span>
            <h3 className="mt-4 font-display text-[clamp(24px,2.6vw,34px)] font-bold tracking-tight">
              Buckeyes <span className="font-serif font-normal italic text-gradient-fire">only.</span>
            </h3>
            <p className="mt-3 text-[14px] leading-relaxed text-white/45">
              Every account verifies an eligible OSU email. Real students, not random internet.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              {VERIFIED_USERS.map(({ initials, name, role, g }) => (
                <div key={initials} className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${g} text-[11px] font-bold text-white`}>
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-white/85">{name}</div>
                    <div className="truncate text-[11px] text-white/35">{role}</div>
                  </div>
                  <span className="flex-shrink-0 text-[10px] font-bold tracking-wider text-flame">✓ OSU</span>
                </div>
              ))}
            </div>
          </div>

          {/* three smalls */}
          {[
            {
              emoji: '💬',
              title: 'Group chat, built in',
              desc: 'Every pod gets its own chat. Coordinate, confirm, and go — without juggling five apps.',
            },
            {
              emoji: '🤝',
              title: 'Reliability scores',
              desc: 'Show up, earn trust. Your score builds so people know you’re worth inviting back.',
            },
            {
              emoji: '✨',
              title: 'Small by design',
              desc: 'Pods cap at 10 people. Not a massive group chat — a focused plan with room to connect.',
            },
          ].map(({ emoji, title, desc }, i) => (
            <div
              key={title}
              className="reveal glow-card rounded-3xl p-7 md:col-span-2"
              style={{ transitionDelay: `${i * 90}ms` }}
              onMouseMove={track}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-xl">
                {emoji}
              </div>
              <h3 className="mt-5 font-display text-[18px] font-bold tracking-tight text-white">{title}</h3>
              <p className="mt-2.5 text-[14px] leading-relaxed text-white/45">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
