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
    <section className="section-divider relative overflow-hidden bg-cream-dark px-5 py-24 md:px-16">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-scarlet/20 to-transparent" />
      <div aria-hidden className="absolute left-[8%] top-24 hidden h-48 w-48 rounded-full bg-scarlet/[0.05] blur-[90px] lg:block" />
      <div aria-hidden className="absolute bottom-16 right-[10%] hidden h-40 w-40 rounded-full bg-amber/[0.08] blur-[90px] lg:block" />
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="mb-16 max-w-[980px]">
          <span className="reveal block text-[11px] font-bold tracking-[0.2em] uppercase text-warm-gray mb-5">
            How it works
          </span>
          <h2 className="reveal font-display text-[clamp(36px,8vw,110px)] tracking-wider leading-[0.92] text-ink">
            THREE STEPS.<br />
            <span className="text-scarlet">ZERO EXCUSES.</span>
          </h2>
          <p className="reveal mt-5 max-w-2xl text-[15px] leading-relaxed text-warm-gray">
            Every part of Bridge is meant to remove friction. You see what is real, claim a spot fast,
            and arrive with enough context that meeting people feels easy instead of awkward.
          </p>
        </div>

        {/* Step cards: separated by 1px lines */}
        <div className="relative grid grid-cols-1 gap-px bg-ink/12 md:grid-cols-3">
          <div aria-hidden className="pointer-events-none absolute left-[16.666%] right-[16.666%] top-1/2 hidden h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-scarlet/18 to-transparent md:block" />
          {STEPS.map(({ step, title, desc }, i) => (
            <div
              key={step}
              className="reveal relative overflow-hidden bg-cream-dark px-6 py-10 md:px-8 tilt-card"
              style={{ transitionDelay: `${i * 100}ms` }}
              onMouseMove={handleTilt}
              onMouseLeave={resetTilt}
            >
              <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-scarlet/70 to-transparent opacity-60" />
              {/* Watermark step number */}
              <div
                aria-hidden
                className="absolute -top-3 -right-1 font-display text-[160px] text-ink/[0.05] leading-none select-none pointer-events-none"
              >
                {step}
              </div>

              <div className="relative">
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center border border-scarlet/20 bg-scarlet/8 font-display text-2xl tracking-[0.08em] text-scarlet">
                    {step}
                  </div>
                  <div className="h-px flex-1 bg-ink/10" />
                </div>
                <div className="text-[11px] font-bold tracking-[0.22em] uppercase text-scarlet mb-5">
                  Step {step}
                </div>
                <div className="w-8 h-0.5 bg-scarlet mb-6" />
                <h3 className="font-display text-[clamp(22px,3vw,42px)] tracking-wider text-ink leading-[0.92] mb-5 whitespace-pre-line">
                  {title}
                </h3>
                <p className="text-sm text-warm-gray leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
