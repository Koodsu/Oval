import { useEffect } from 'react'

const EMAIL = 'contactus@theovalapp.com'

function Section({ title, children }) {
  return (
    <section className="mb-10 space-y-3 text-sm leading-relaxed text-white/70">
      <h2 className="border-b border-white/10 pb-3 text-lg font-semibold uppercase tracking-widest text-white">
        {title}
      </h2>
      {children}
    </section>
  )
}

export default function AccessibilityStatement() {
  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Accessibility | Oval'
    window.scrollTo(0, 0)
    return () => {
      document.title = previousTitle
    }
  }, [])

  return (
    <div className="min-h-screen bg-ink pb-24 pt-20">
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-3xl px-6 py-12 md:px-10">
        <div className="mb-12">
          <h1 className="mb-2 font-display text-3xl uppercase tracking-widest text-white">
            Accessibility
          </h1>
          <p className="text-sm text-white/65">Last updated August 5, 2026</p>
        </div>

        <Section title="Our Commitment">
          <p>
            Oval Technologies LLC wants Oval&apos;s mobile app and website to be usable by people
            with disabilities. We are building toward the Web Content Accessibility Guidelines
            (WCAG) 2.2 Level AA and applying relevant mobile accessibility guidance.
          </p>
        </Section>

        <Section title="Accessibility Features">
          <ul className="list-disc space-y-2 pl-5">
            <li>Screen-reader names, roles, states, and headings for important controls and content.</li>
            <li>Keyboard navigation, visible focus indicators, and a skip-to-content link on the website.</li>
            <li>Support for larger text, device orientation, and reduced-motion preferences.</li>
            <li>Color-contrast targets and text alternatives for meaningful images.</li>
          </ul>
        </Section>

        <Section title="Ongoing Work">
          <p>
            Accessibility is an ongoing process, not a one-time certification. Some complex or
            third-party experiences may still have limitations. We regularly test core flows and
            prioritize fixes that block access to account, safety, club, pod, and messaging features.
          </p>
        </Section>

        <Section title="Get Help Or Report A Barrier">
          <p>
            If you have trouble using Oval, email{' '}
            <a className="text-scarlet underline underline-offset-2" href={`mailto:${EMAIL}`}>
              {EMAIL}
            </a>
            . Tell us which page or feature you were using, what happened, and the assistive
            technology or device involved if you are comfortable sharing it. Do not send passwords
            or verification codes.
          </p>
          <p>
            We aim to acknowledge accessibility reports within five business days and can help
            provide the same information or service through an alternative method when practical.
          </p>
        </Section>
      </main>
    </div>
  )
}
