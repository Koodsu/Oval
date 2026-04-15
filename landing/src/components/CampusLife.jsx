const CARDS = [
  {
    emoji: '⚡',
    title: 'Activities',
    description:
      'Pickup games, study sessions, food runs, jam sessions — forming right now, near you.',
  },
  {
    emoji: '🎓',
    title: 'Clubs',
    description: 'Discover clubs you never knew existed. Join the ones that actually fit you.',
  },
  {
    emoji: '📅',
    title: 'Events',
    description:
      'See what's happening tonight, this week, this semester. Never miss out again.',
  },
]

export default function CampusLife() {
  return (
    <section className="bg-cream py-24">
      <div className="max-w-[1200px] mx-auto px-6">
        {/* Label */}
        <p className="reveal text-scarlet text-xs font-bold tracking-[0.2em] uppercase mb-4">
          Everything on Campus
        </p>

        {/* Headline */}
        <h2 className="reveal font-display leading-[0.9] tracking-wide mb-14">
          <span className="block text-ink text-[clamp(40px,7vw,96px)]">ONE APP.</span>
          <span className="block text-scarlet text-[clamp(40px,7vw,96px)]">ALL OF CAMPUS LIFE.</span>
        </h2>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {CARDS.map(({ emoji, title, description }) => (
            <div
              key={title}
              className="reveal bg-white rounded-2xl shadow-md p-8"
            >
              <div className="text-5xl mb-4">{emoji}</div>
              <h3 className="font-sans font-bold text-xl text-ink mb-2">{title}</h3>
              <p className="font-sans text-[15px] text-[#666666] leading-relaxed">{description}</p>
            </div>
          ))}
        </div>

        {/* Verification line */}
        <p className="reveal text-center text-[14px] text-[#999999] mt-10">
          Every person verified with their OSU email. 100% Buckeyes.
        </p>
      </div>
    </section>
  )
}
