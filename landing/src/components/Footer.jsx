import { Link } from 'react-router-dom'

const LINK_CLASS = 'text-[11px] font-medium text-white/25 no-underline tracking-[0.12em] uppercase transition-colors duration-150 hover:text-white/60'

export default function Footer() {
  return (
    <footer className="bg-[#0A0A08] border-t border-white/5 px-5 md:px-16 py-10">
      <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-6 h-6 bg-scarlet flex items-center justify-center flex-shrink-0">
              <span className="font-display text-white text-sm leading-none">B</span>
            </div>
            <span className="font-display text-white text-xl tracking-[0.12em]">BRIDGE</span>
          </div>
          <p className="text-xs text-white/20 tracking-wide">Real groups. Real people. Ohio State.</p>
        </div>

        <div className="flex flex-wrap gap-6">
          <a href="#" className={LINK_CLASS}>About</a>
          <a href="#waitlist" className={LINK_CLASS}>Waitlist</a>
          <Link to="/privacy" className={LINK_CLASS}>Privacy</Link>
          <a href="#" className={LINK_CLASS}>Terms</a>
          <a href="mailto:contactus@joinbridgeapp.com" className={LINK_CLASS}>Contact</a>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto mt-8 pt-6 border-t border-white/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-xs text-white/20 tracking-wide">© 2026 Bridge. Made for Buckeyes.</p>
        <p className="text-xs text-white/20 tracking-wide">Not affiliated with The Ohio State University.</p>
      </div>
    </footer>
  )
}
