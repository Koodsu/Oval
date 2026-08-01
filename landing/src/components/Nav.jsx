import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from '../lib/router'

function scrollToWaitlist() {
  document.getElementById('waitlist')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export default function Nav() {
  const navigate = useNavigate()
  const location = useLocation()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 24)
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
    <nav className="fixed left-0 right-0 top-0 z-50 flex justify-center px-3 pt-4">
      <div
        className="flex h-[3.4rem] w-full max-w-[1080px] items-center justify-between rounded-full border px-2.5 pl-5 transition-all duration-500"
        style={{
          background: scrolled ? 'rgba(8, 6, 6, 0.78)' : 'rgba(8, 6, 6, 0.35)',
          borderColor: scrolled ? 'rgba(187, 0, 0, 0.35)' : 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: scrolled
            ? '0 12px 48px rgba(0, 0, 0, 0.5), 0 0 32px rgba(187, 0, 0, 0.14)'
            : '0 8px 32px rgba(0, 0, 0, 0.25)',
        }}
      >
        <a href="/" onClick={handleBrandClick} className="group flex items-center gap-2.5 no-underline">
          <img
            src="/oval-logo.png"
            alt="Oval"
            className="h-8 w-8 flex-shrink-0 rounded-xl transition-shadow duration-300"
            style={{ boxShadow: scrolled ? '0 0 20px rgba(187,0,0,0.6)' : '0 0 12px rgba(187,0,0,0.35)' }}
          />
          <span className="font-display text-lg font-bold tracking-tight text-white">oval</span>
        </a>

        <div className="flex items-center gap-1.5 md:gap-3">
          <Link
            to="/clubs"
            className="hidden rounded-full px-4 py-2 text-[13px] font-semibold text-white/65 no-underline transition-colors duration-150 hover:bg-white/[0.06] hover:text-white md:block"
          >
            For Clubs
          </Link>
          <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3.5 py-1.5 md:flex">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-flame opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-flame" />
            </span>
            <span className="text-[11px] font-semibold tracking-wide text-white/80">OSU waitlist open</span>
          </div>
          <a
            href="#waitlist"
            onClick={handleWaitlistClick}
            className="group relative overflow-hidden rounded-full bg-gradient-to-r from-scarlet to-flame px-5 py-2.5 text-[13px] font-bold text-white no-underline transition-transform duration-150 hover:scale-[1.04] active:scale-95"
            style={{ boxShadow: '0 4px 24px rgba(187,0,0,0.4)' }}
          >
            <span className="relative z-10">Get early access</span>
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
          </a>
        </div>
      </div>
    </nav>
  )
}
