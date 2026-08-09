import { useEffect } from 'react'

const EMAIL = 'contactus@theovalapp.com'

function Section({ id, title, children }) {
  return (
    <section id={id} className="mb-10 scroll-mt-28">
      <h2 className="mb-4 border-b border-white/10 pb-3 text-lg font-semibold uppercase tracking-widest text-white">
        {title}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed text-white/60">{children}</div>
    </section>
  )
}

function List({ items }) {
  return (
    <ul className="list-disc space-y-2 pl-5">
      {items.map((item) => <li key={item}>{item}</li>)}
    </ul>
  )
}

export default function ChildSafetyStandards() {
  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Child Safety Standards | Oval'
    window.scrollTo(0, 0)
    return () => {
      document.title = previousTitle
    }
  }, [])

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-ink pb-24 pt-20">
      <div className="mx-auto max-w-3xl px-6 py-12 md:px-10">
        <div className="mb-12">
          <h1 className="mb-2 font-display text-3xl uppercase tracking-widest text-white">
            Child Safety Standards
          </h1>
          <p className="text-sm text-white/35">Effective August 9, 2026</p>
        </div>

        <Section id="commitment" title="Our Commitment">
          <p>
            Oval, operated by Oval Technologies LLC, has zero tolerance for child sexual abuse and
            exploitation (CSAE) and child sexual abuse material (CSAM). Although Oval is intended
            only for adults age 18 and older with an eligible university email address, content or
            conduct that sexually exploits, abuses, or endangers a child is strictly prohibited.
          </p>
        </Section>

        <Section id="prohibited-conduct" title="Prohibited Conduct">
          <p>Users may not use Oval to create, upload, share, request, promote, or facilitate:</p>
          <List items={[
            'Child sexual abuse material, including real, altered, or computer-generated depictions involving a minor.',
            'Grooming, sexual solicitation of a minor, sextortion, or attempts to arrange sexual contact with a minor.',
            'Child trafficking, commercial sexual exploitation of a child, or content that supports or normalizes child sexual abuse.',
            'Any other content or behavior that sexually exploits, abuses, or endangers a person under 18.',
          ]} />
        </Section>

        <Section id="reporting" title="How To Report A Concern">
          <p>
            Users can report profiles, messages, clubs, announcements, and pod activity using Oval's
            in-app report controls. Reports are sent to Oval for review without requiring the user to
            leave the app. Users may also report a child safety concern by emailing{' '}
            <a className="text-scarlet underline underline-offset-2" href={`mailto:${EMAIL}`}>
              {EMAIL}
            </a>.
          </p>
          <p>
            If a child is in immediate danger, contact local emergency services or law enforcement
            before contacting Oval. Do not download, copy, or redistribute suspected CSAM in order to
            report it.
          </p>
        </Section>

        <Section id="response" title="Our Response">
          <p>
            Oval reviews child safety reports and takes action consistent with these standards and
            applicable law. When Oval obtains actual knowledge of CSAM or other prohibited CSAE
            activity, actions may include:
          </p>
          <List items={[
            'Removing or disabling access to prohibited content.',
            'Suspending or permanently terminating accounts involved in prohibited activity.',
            'Preserving information when required for an investigation or legal obligation.',
            'Reporting confirmed CSAM and related conduct to the National Center for Missing & Exploited Children (NCMEC) or other appropriate regional or national authorities as required by law.',
            'Cooperating with valid requests from law enforcement and child safety authorities.',
          ]} />
        </Section>

        <Section id="compliance" title="Compliance">
          <p>
            Oval complies with applicable child safety laws and maintains processes for reviewing,
            escalating, preserving, and reporting child safety concerns. These standards apply across
            Oval's user-generated content and communication features and supplement our Community
            Guidelines and Terms of Use.
          </p>
        </Section>

        <Section id="contact" title="Child Safety Contact">
          <p>
            Google Play and relevant authorities may contact Oval's designated child safety point of
            contact at{' '}
            <a className="text-scarlet underline underline-offset-2" href={`mailto:${EMAIL}`}>
              {EMAIL}
            </a>. This contact is prepared to discuss Oval's CSAM prevention, enforcement, reporting,
            and policy-compliance practices.
          </p>
        </Section>
      </div>
    </main>
  )
}
