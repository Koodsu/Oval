const STEPS = [
  {
    step: '01',
    title: 'PICK WHAT\nYOU\'RE INTO',
    desc: 'Browse 10 activity categories — from pickup basketball to study sessions to hiking Hocking Hills. Filter by today, this week, or right now.',
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

export default function HowItWorks() {
  return (
    <section className="py-24 px-5 md:px-16 bg-cream-dark">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="mb-16">
          <span className="reveal block text-[11px] font-bold tracking-[0.2em] uppercase text-warm-gray mb-5">
            How it works
          </span>
          <h2 className="reveal font-display text-[clamp(36px,8vw,110px)] tracking-wider leading-[0.92] text-ink">
            THREE STEPS.<br />
            <span className="text-scarlet">ZERO EXCUSES.</span>
          </h2>
        </div>

        {/* Step cards: separated by 1px lines */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-ink/12">
          {STEPS.map(({ step, title, desc }, i) => (
            <div
              key={step}
              className="reveal relative overflow-hidden bg-cream-dark px-6 py-10 md:px-8"
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              {/* Watermark step number */}
              <div
                aria-hidden
                className="absolute -top-3 -right-1 font-display text-[160px] text-ink/[0.05] leading-none select-none pointer-events-none"
              >
                {step}
              </div>

              <div className="relative">
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
