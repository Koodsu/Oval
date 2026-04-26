import { STATS } from '../data/stats'
import { useEffect, useRef, useState } from 'react'

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

function StatItem({ number, label, index, active }) {
  const raw = parseNumber(number)
  const suffix = getSuffix(number)
  const count = useCountUp(raw, 1400, active)

  const isEvenCol = index % 2 === 0
  const isFirstTwo = index < 2

  return (
    <div
      className={[
        'px-6 md:px-12 py-10',
        isEvenCol ? 'border-r border-white/8' : 'md:border-r border-white/8 md:last:border-r-0',
        isFirstTwo ? 'border-b border-white/8 md:border-b-0' : '',
      ].join(' ')}
    >
      <div className="font-display text-[clamp(36px,5vw,68px)] leading-none tracking-wider bg-gradient-to-br from-scarlet via-scarlet-bright to-amber bg-clip-text text-transparent">
        {count}{suffix}
      </div>
      <div className="text-[10px] md:text-[11px] font-medium text-white/35 mt-2 tracking-[0.1em] md:tracking-[0.12em] uppercase leading-snug">
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
    <div ref={ref} className="section-divider relative bg-ink px-5 pb-6 md:px-16">
      <div className="mx-auto max-w-[1400px] border border-white/8 bg-white/[0.03] backdrop-blur-sm">
        <div className="grid grid-cols-2 md:grid-cols-4">
        {STATS.map(({ number, label }, i) => (
          <StatItem key={label} number={number} label={label} index={i} active={active} />
        ))}
        </div>
      </div>
    </div>
  )
}
