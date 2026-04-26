import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'

function scrollToWaitlist() {
  document.getElementById('waitlist')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export default function Nav() {
  const navigate = useNavigate()
  const location = useLocation()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  const handleBrandClick = (e) => {
    if (location.pathname !== '/') {
      e.preventDefault()
      navigate('/')
    }
  }

  const handleWaitlistClick = (e) => {
    e.preventDefault()
    if (location.pathname !== '/') {
      navigate('/')
      setTimeout(scrollToWaitlist, 100)
    } else {
      scrollToWaitlist()
    }
  }

  return (
    <nav
      className="fixed left-0 right-0 top-0 z-50 px-3 pt-3 md:px-6"
    >
      <div
        className="mx-auto flex h-14 max-w-[1400px] items-center justify-between border px-4 md:px-6 bg-ink/80 backdrop-blur-xl transition-all duration-300"
        style={{
          borderColor: scrolled ? 'rgba(187, 0, 0, 0.28)' : 'rgba(255,255,255,0.08)',
          boxShadow: scrolled
            ? '0 16px 48px rgba(0, 0, 0, 0.32), 0 0 24px rgba(187, 0, 0, 0.12)'
            : '0 8px 30px rgba(0, 0, 0, 0.18)',
        }}
      >
      <a href="#" onClick={handleBrandClick} className="flex items-center gap-3 no-underline group">
        <div
          className="flex h-7 w-7 items-center justify-center bg-scarlet flex-shrink-0 transition-all duration-300"
          style={{ boxShadow: scrolled ? '0 0 16px rgba(187,0,0,0.55)' : '0 0 0 rgba(0,0,0,0)' }}
        >
          <span className="font-display text-white text-base leading-none">B</span>
        </div>
        <div className="flex flex-col">
          <span className="font-display text-white text-2xl tracking-[0.12em] leading-none">BRIDGE</span>
          <span className="hidden text-[10px] font-bold uppercase tracking-[0.16em] text-white/36 md:block">
            Ohio State social layer
          </span>
        </div>
      </a>

      <div className="flex items-center gap-3 md:gap-6">
        <Link
          to="/clubs"
          className="hidden font-sans font-semibold text-xs text-white/70 tracking-[0.08em] uppercase transition-colors duration-150 hover:text-white no-underline md:block"
        >
          For Clubs
        </Link>
        <div className="hidden items-center gap-2 border border-white/12 bg-white/[0.08] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] md:flex">
          <span className="h-2 w-2 rounded-full bg-scarlet animate-pulse-dot" />
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/78">Founding class open</span>
        </div>
        <a
          href="#waitlist"
          onClick={handleWaitlistClick}
          className="bg-scarlet text-white font-sans font-semibold text-xs px-4 md:px-5 py-2.5 tracking-[0.08em] uppercase transition-all duration-150 hover:bg-scarlet-bright active:scale-95"
        >
          Join Waitlist
        </a>
      </div>
      </div>
    </nav>
  )
}
