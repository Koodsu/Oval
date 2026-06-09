import { useEffect, useRef, useState } from 'react'
import { STATS } from '../data/stats'

function parseNumber(str) {
  return parseInt(str.replace(/[^0-9]/g, ''), 10) || 0
}

function getSuffix(str) {
  return str.replace(/[0-9]/g, '')
}

function useCountUp(target, duration = 1500, active) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!active || target === 0) {
      setCount(target)
      return
    }
    const start = performance.now()
    let raf

    const tick = (now) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.floor(eased * target))
      if (progress < 1) raf = requestAnimationFrame(tick)
      else setCount(target)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active, target, duration])

  return count
}

function StatItem({ number, label, active, delay }) {
  const raw = parseNumber(number)
  const suffix = getSuffix(number)
  const count = useCountUp(raw, 1400, active)

  return (
    <div className="reveal px-6 py-10 text-center md:px-10" style={{ transitionDelay: `${delay}ms` }}>
      <div className="text-gradient-fire font-display text-[clamp(40px,5vw,72px)] font-bold leading-none tracking-tight">
        {raw === 0 ? number : `${count}${suffix}`}
      </div>
      <div className="mx-auto mt-3 max-w-[12rem] text-[11px] font-medium uppercase leading-snug tracking-[0.14em] text-white/35">
        {label}
      </div>
    </div>
  )
}

export default function StatsBar() {
  const ref = useRef(null)
  const [active, setActive] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setActive(true); observer.disconnect() } },
      { threshold: 0.2 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className="section-divider relative bg-void px-5 py-10 md:px-10">
      <div className="mx-auto grid max-w-[1280px] grid-cols-2 divide-x divide-white/[0.06] rounded-3xl border border-white/8 bg-white/[0.02] md:grid-cols-4">
        {STATS.map(({ number, label }, i) => (
          <StatItem key={label} number={number} label={label} active={active} delay={i * 90} />
        ))}
      </div>
    </div>
  )
}
