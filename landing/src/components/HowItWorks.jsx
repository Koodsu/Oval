const STEPS = [
  {
    step: '01',
    title: 'PICK WHAT\nYOU\'RE INTO',
    desc: 'Browse 50+ activities across 10 categories — from pickup basketball to study sessions to movie nights. Filter by today, this week, or right now.',
  },
  {
    step: '02',
    title: 'JOIN\nA POD',
    desc: 'Pods are small groups of 2–8 people forming around a single activity. See who\'s in, when it\'s happening, and claim your spot in one tap.',
  },
  {
    step: '03',
    title: 'SHOW UP\n& CONNECT',
    desc: 'Chat with your pod, lock in a time, and go. Your reliability score builds over time so people know you\'re the real deal.',
  },
]

function handleTilt(e) {
  const rect = e.currentTarget.getBoundingClientRect()
  const x = ((e.clientX - rect.left) / rect.width - 0.5) * 12
  const y = ((e.clientY - rect.top) / rect.height - 0.5) * -12
  e.currentTarget.style.transform = `perspective(800px) rotateX(${y}deg) rotateY(${x}deg) scale(1.02)`
}

function resetTilt(e) {
  e.currentTarget.style.transform = ''
}

export default function HowItWorks() {
  return (
    <section className="section-divider relative overflow-hidden bg-ink px-5 py-24 text-white md:px-16">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(187,0,0,0.14),transparent_24%),radial-gradient(circle_at_82%_26%,rgba(245,158,11,0.1),transparent_20%)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      <div aria-hidden className="absolute left-[8%] top-24 hidden h-48 w-48 rounded-full bg-scarlet/[0.08] blur-[90px] lg:block" />
      <div aria-hidden className="absolute bottom-16 right-[10%] hidden h-40 w-40 rounded-full bg-amber/[0.10] blur-[90px] lg:block" />
      <div className="max-w-[1400px] mx-auto">
        <div className="mb-16 max-w-[980px]">
          <span className="reveal mb-5 block text-[11px] font-bold tracking-[0.2em] uppercase text-scarlet">
            How it works
          </span>
          <h2 className="reveal font-display text-[clamp(36px,8vw,110px)] leading-[0.92] tracking-wider text-white">
            THREE STEPS.<br />
            <span className="text-white/24">ZERO EXCUSES.</span>
          </h2>
          <p className="reveal mt-5 max-w-2xl text-[15px] leading-relaxed text-white/55">
            Every part of Bridge is meant to remove friction. You see what is real, claim a spot fast,
            and arrive with enough context that meeting people feels easy instead of awkward.
          </p>
        </div>

        <div className="relative grid grid-cols-1 gap-4 md:grid-cols-3">
          {STEPS.map(({ step, title, desc }, i) => (
            <div
              key={step}
              className="reveal tilt-card relative overflow-hidden border border-white/8 bg-white/[0.04] px-6 py-10 backdrop-blur-sm md:px-8"
              style={{ transitionDelay: `${i * 100}ms` }}
              onMouseMove={handleTilt}
              onMouseLeave={resetTilt}
            >
              <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-scarlet/80 to-transparent" />
              <div
                aria-hidden
                className="pointer-events-none absolute -top-3 -right-1 select-none font-display text-[160px] leading-none text-white/[0.04]"
              >
                {step}
              </div>

              <div className="relative">
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center border border-scarlet/24 bg-scarlet/10 font-display text-2xl tracking-[0.08em] text-scarlet">
                    {step}
                  </div>
                  <div className="h-px flex-1 bg-white/10" />
                </div>
                <div className="mb-5 text-[11px] font-bold tracking-[0.22em] uppercase text-scarlet">
                  Step {step}
                </div>
                <div className="mb-6 h-0.5 w-8 bg-scarlet" />
                <h3 className="mb-5 whitespace-pre-line font-display text-[clamp(22px,3vw,42px)] leading-[0.92] tracking-wider text-white">
                  {title}
                </h3>
                <p className="text-sm leading-relaxed text-white/52">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
