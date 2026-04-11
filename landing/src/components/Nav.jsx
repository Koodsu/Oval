export default function Nav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-6 md:px-10 bg-ink/96 backdrop-blur-sm border-b border-white/5">
      <a href="#" className="flex items-center gap-3 no-underline group">
        <div className="w-6 h-6 bg-scarlet flex items-center justify-center flex-shrink-0">
          <span className="font-display text-white text-base leading-none">B</span>
        </div>
        <span className="font-display text-white text-2xl tracking-[0.12em] leading-none">BRIDGE</span>
      </a>

      <a
        href="#waitlist"
        className="bg-scarlet text-white font-sans font-semibold text-xs px-5 py-2.5 tracking-[0.08em] uppercase transition-all duration-150 hover:bg-scarlet-bright active:scale-95"
      >
        Join Waitlist
      </a>
    </nav>
  )
}
