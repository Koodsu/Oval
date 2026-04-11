const LINKS = ['About', 'Waitlist', 'Privacy', 'Terms', 'Contact']

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
          {LINKS.map((link) => (
            <a
              key={link}
              href={link === 'Contact' ? 'mailto:hello@bridge.app' : '#'}
              className="text-[11px] font-medium text-white/25 no-underline tracking-[0.12em] uppercase transition-colors duration-150 hover:text-white/60"
            >
              {link}
            </a>
          ))}
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto mt-8 pt-6 border-t border-white/5">
        <p className="text-xs text-white/12 tracking-wide">© 2026 Bridge. Made for Buckeyes.</p>
      </div>
    </footer>
  )
}
