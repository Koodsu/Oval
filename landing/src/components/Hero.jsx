import { useState, useEffect } from 'react'
import WaitlistForm from './WaitlistForm'

const ACTIVITY_CARDS = [
  {
    emoji: '🏀',
    title: '3v3 Basketball at RPAC',
    meta: 'Today · 4:30 PM',
    tag: '2 spots',
    tagColor: 'bg-green-500 text-white',
    rotate: '-2deg',
    top: '0px',
    left: '0px',
  },
  {
    emoji: '☕',
    title: 'Cafe Study Group',
    meta: 'Knowlton · Forming now',
    tag: 'Open',
    tagColor: 'bg-ink text-white',
    rotate: '2.5deg',
    top: '72px',
    left: '48px',
  },
  {
    emoji: '🎸',
    title: 'Jam Session',
    meta: 'Hopkins Hall · 5pm',
    tag: '3 spots',
    tagColor: 'bg-scarlet text-white',
    rotate: '-1.5deg',
    top: '144px',
    left: '16px',
  },
]

export default function Hero() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 80)
    return () => clearTimeout(t)
  }, [])

  return (
    <section className="relative overflow-hidden min-h-[100svh] flex flex-col justify-center bg-cream pt-14">
      {/* Left scarlet edge */}
      <div className="absolute left-0 top-0 w-1 h-full bg-scarlet" />

      {/* Subtle background texture — large faint type */}
      <div
        aria-hidden
        className="absolute bottom-0 right-0 font-display text-[clamp(200px,30vw,420px)] text-ink/[0.03] leading-none select-none pointer-events-none tracking-wider"
        style={{ lineHeight: 0.85 }}
      >
        BRIDGE
      </div>

      <div className="relative px-5 md:px-16 pt-16 pb-16 max-w-[1400px] mx-auto w-full">
        {/* Eyebrow */}
        <div
          className="flex items-center gap-2.5 mb-7 transition-all duration-500"
          style={{
            opacity: ready ? 1 : 0,
            transform: ready ? 'translateY(0)' : 'translateY(14px)',
            transitionDelay: '0ms',
          }}
        >
          <span className="w-2 h-2 rounded-full bg-scarlet animate-pulse-dot flex-shrink-0" />
          <span className="font-sans text-[11px] font-bold tracking-[0.2em] uppercase text-warm-gray">
            Coming to Ohio State · Fall 2026
          </span>
        </div>

        {/* Main headline */}
        <h1 className="font-display leading-[0.88] tracking-wider mb-8">
          {[
            { text: 'STOP', color: 'text-ink' },
            { text: 'SCROLLING.', color: 'text-scarlet' },
          ].map(({ text, color }, i) => (
            <span
              key={text}
              className={`block text-[clamp(52px,13vw,190px)] ${color} transition-all duration-700`}
              style={{
                opacity: ready ? 1 : 0,
                transform: ready ? 'translateY(0)' : 'translateY(48px)',
                transitionDelay: `${0.15 + i * 0.13}s`,
                transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              {text}
            </span>
          ))}
        </h1>

        {/* Horizontal rule */}
        <div
          className="h-px bg-ink/12 mb-10 origin-left transition-all duration-700"
          style={{
            opacity: ready ? 1 : 0,
            transform: ready ? 'scaleX(1)' : 'scaleX(0)',
            transitionDelay: '0.42s',
            transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />

        {/* Two-column: body + cards */}
        <div className="flex flex-col lg:flex-row gap-12 lg:gap-20 items-start">
          {/* Left column */}
          <div
            className="flex-1 max-w-[520px] transition-all duration-700"
            style={{
              opacity: ready ? 1 : 0,
              transform: ready ? 'translateY(0)' : 'translateY(20px)',
              transitionDelay: '0.48s',
              transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <p className="text-[clamp(16px,1.7vw,20px)] text-warm-gray leading-relaxed mb-10 font-light">
              Bridge connects OSU students through real-life activity groups, clubs, and campus events — happening today.
            </p>
            <WaitlistForm />
          </div>

          {/* Right column: sticker cards */}
          <div
            className="relative w-full lg:w-72 h-60 flex-shrink-0 mx-auto lg:mx-0"
            style={{
              maxWidth: '320px',
              opacity: ready ? 1 : 0,
              transition: 'opacity 0.5s ease 0.56s',
            }}
          >
            {ACTIVITY_CARDS.map(({ emoji, title, meta, tag, tagColor, rotate, top, left }, i) => (
              <div
                key={title}
                className="absolute bg-white border-2 border-ink shadow-[5px_5px_0_0_#0D0D0B] px-4 py-3 w-52 sm:w-56 transition-all"
                style={{
                  top,
                  left,
                  transform: ready ? `rotate(${rotate})` : `rotate(${rotate}) translateY(24px)`,
                  opacity: ready ? 1 : 0,
                  transitionDuration: '0.5s',
                  transitionDelay: `${0.62 + i * 0.1}s`,
                  transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
                  zIndex: 3 - i,
                }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xl">{emoji}</span>
                  <span className={`${tagColor} text-[10px] font-bold px-2 py-0.5 tracking-wider uppercase`}>
                    {tag}
                  </span>
                </div>
                <div className="text-sm font-bold text-ink leading-snug">{title}</div>
                <div className="text-[11px] text-warm-gray mt-0.5">{meta}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
