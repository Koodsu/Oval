import { Link } from '../lib/router'

const LINK_CLASS = 'text-[12px] font-medium text-white/65 no-underline transition-colors duration-150 hover:text-white'

export default function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-white/[0.06] bg-[#060404] px-5 py-14 md:px-10">
      <div aria-hidden className="absolute bottom-[-12rem] left-1/2 h-[20rem] w-[44rem] -translate-x-1/2 rounded-full bg-scarlet/10 blur-[120px]" />

      <div className="relative mx-auto flex max-w-[1280px] flex-col items-start justify-between gap-8 md:flex-row md:items-center">
        <div>
          <div className="mb-3 flex items-center gap-2.5">
            <img src="/oval-logo.png" alt="" className="h-8 w-8 flex-shrink-0 rounded-xl shadow-[0_0_16px_rgba(187,0,0,0.4)]" />
            <span className="font-display text-lg font-bold tracking-tight text-white">oval</span>
          </div>
          <p className="text-[12px] text-white/65">
            Campus is happening <span className="font-serif italic text-flame">right now.</span> Made for Buckeyes.
          </p>
        </div>

        <div className="flex flex-wrap gap-x-7 gap-y-3">
          <a href="#waitlist" className={`${LINK_CLASS} py-2`}>Waitlist</a>
          <Link to="/clubs" className={`${LINK_CLASS} py-2`}>For Clubs</Link>
          <Link to="/community-guidelines" className={`${LINK_CLASS} py-2`}>Guidelines</Link>
          <Link to="/support" className={`${LINK_CLASS} py-2`}>Support</Link>
          <Link to="/accessibility" className={`${LINK_CLASS} py-2`}>Accessibility</Link>
          <Link to="/privacy" className={`${LINK_CLASS} py-2`}>Privacy</Link>
          <Link to="/terms" className={`${LINK_CLASS} py-2`}>Terms</Link>
        </div>
      </div>

      <div className="relative mx-auto mt-10 flex max-w-[1280px] flex-col gap-2 border-t border-white/[0.06] pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] text-white/65">© 2026 Oval Technologies LLC. Made for Buckeyes.</p>
        <p className="text-[11px] text-white/65">Not affiliated with The Ohio State University.</p>
      </div>
    </footer>
  )
}
