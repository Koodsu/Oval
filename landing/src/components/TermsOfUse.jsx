import { useEffect } from 'react'

const EMAIL = 'contactus@theovalapp.com'

function Section({ id, title, children }) {
  return (
    <section id={id} className="mb-10">
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

export default function TermsOfUse() {
  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Terms of Use | Oval'
    window.scrollTo(0, 0)
    return () => {
      document.title = previousTitle
    }
  }, [])

  return (
    <div className="min-h-screen bg-ink pb-24 pt-20">
      <article className="mx-auto max-w-3xl px-6 py-12 md:px-10">
        <div className="mb-12">
          <h1 className="mb-2 font-display text-3xl uppercase tracking-widest text-white">
            Terms of Service
          </h1>
          <p className="text-sm text-white/35">Effective June 8, 2026</p>
        </div>

        <Section id="agreement" title="Agreement">
          <p>
            These Terms govern your use of the Oval mobile app, theovalapp.com, and related
            services operated by Brady Van Bibber, doing business as Oval ("Oval," "we," "us").
            By creating an account or using Oval, you agree to these Terms, the Privacy Policy,
            and the Community Guidelines. If you do not agree, do not use Oval.
          </p>
        </Section>

        <Section id="eligibility" title="Eligibility And Accounts">
          <List items={[
            'You must be at least 18 years old and legally able to agree to these Terms.',
            'A Oval account requires an eligible OSU email address. Email verification confirms control of that address, not identity, current enrollment, character, or background.',
            'Provide accurate information, keep your credentials secure, and promptly tell us about unauthorized account use.',
            'You may not impersonate another person, create an account for someone else, evade a suspension or ban, or use Oval for unlawful activity.',
          ]} />
        </Section>

        <Section id="service" title="The Service">
          <p>
            Oval provides tools for campus profiles, activity pods, clubs, messaging, invitations,
            attendance, notifications, and in-person plans. Features may change, be limited, or be
            discontinued. Oval is independent and is not affiliated with, endorsed by, or officially
            connected to The Ohio State University.
          </p>
        </Section>

        <Section id="content" title="Your Content">
          <p>
            You keep ownership of content you submit. You give Oval a nonexclusive, worldwide,
            royalty-free license to host, copy, display, transmit, format, moderate, and remove that
            content only as reasonably needed to provide, improve, secure, and promote the service.
            This license ends when the content is deleted, except for limited backups, legal
            obligations, and retained safety records described in the Privacy Policy.
          </p>
          <p>
            You represent that you have the rights needed to submit your content and that it does not
            violate law, another person's rights, or the Community Guidelines.
          </p>
        </Section>

        <Section id="conduct" title="Acceptable Use">
          <p>You may not:</p>
          <List items={[
            'Harass, threaten, exploit, discriminate against, stalk, or expose private information about another person.',
            'Post illegal, infringing, deceptive, sexually exploitative, hateful, violent, or malicious content.',
            'Spam, scrape, probe, reverse engineer, disrupt, overload, or gain unauthorized access to Oval or another account.',
            'Use automated systems to create accounts, collect data, send messages, or manipulate attendance, reports, or reliability information.',
            'Misrepresent a meetup, club, affiliation, identity, location, or safety condition.',
          ]} />
        </Section>

        <Section id="meetups" title="In-Person Plans And Safety">
          <p>
            Oval helps users coordinate; it does not organize, supervise, endorse, insure, or
            conduct meetups. We do not perform background checks or guarantee another user's identity,
            conduct, attendance, or statements. Use judgment, meet in public, tell someone your plans,
            and leave if a situation feels unsafe.
          </p>
          <p>
            You are responsible for your own interactions and participation. Oval is not an emergency
            service. Call 911 or the appropriate local authority in an emergency.
          </p>
        </Section>

        <Section id="moderation" title="Moderation And Enforcement">
          <p>
            We may review reports, use automated moderation, remove content, restrict features,
            revoke sessions, suspend or ban accounts, and preserve limited safety records when
            reasonably necessary to enforce these Terms, protect users, prevent ban evasion, or comply
            with law. We are not required to host any content.
          </p>
          <p>
            Email <a className="text-scarlet underline underline-offset-2" href={`mailto:${EMAIL}`}>{EMAIL}</a>{' '}
            to appeal an account action. We may ask for information needed to review the appeal.
          </p>
        </Section>

        <Section id="communications" title="Communications">
          <p>
            You agree to receive transactional messages needed to operate your account, including
            verification, password reset, security, moderation, and service notices. Waitlist and
            launch marketing email may be unsubscribed from at any time. You can manage optional push
            notifications in Oval and iOS settings.
          </p>
        </Section>

        <Section id="ip" title="Oval Property">
          <p>
            Oval's software, branding, design, and service content, excluding user content, are
            owned by Oval or its licensors and protected by law. These Terms give you a limited,
            personal, revocable, nontransferable license to use the service as intended.
          </p>
        </Section>

        <Section id="termination" title="Termination">
          <p>
            You may stop using Oval and delete your account in the app. We may suspend or terminate
            access for violations, safety risks, legal requirements, prolonged service shutdown, or
            conduct that materially harms Oval or its users. Provisions that logically survive
            termination, including ownership, disclaimers, liability limits, and dispute terms, remain effective.
          </p>
        </Section>

        <Section id="disclaimers" title="Disclaimers">
          <p>
            To the fullest extent permitted by law, Oval is provided "as is" and "as available."
            We disclaim implied warranties, including merchantability, fitness for a particular
            purpose, and noninfringement. We do not guarantee uninterrupted service, error-free
            features, successful meetups, user conduct, or the accuracy of user content.
          </p>
        </Section>

        <Section id="liability" title="Limitation Of Liability">
          <p>
            To the fullest extent permitted by law, Oval and its operator will not be liable for
            indirect, incidental, special, consequential, exemplary, or punitive damages, lost data,
            lost profits, personal interactions, or reliance on user content arising from the service.
            Where liability cannot be excluded, total liability will not exceed the greater of $100
            or the amount you paid Oval during the 12 months before the claim.
          </p>
          <p>Some jurisdictions do not allow certain exclusions, so parts of this section may not apply to you.</p>
        </Section>

        <Section id="law" title="Governing Law">
          <p>
            Ohio law governs these Terms, without regard to conflict-of-law rules. Unless applicable
            law requires otherwise, disputes must be brought in the state or federal courts serving
            Franklin County, Ohio, and you consent to their jurisdiction.
          </p>
        </Section>

        <Section id="changes" title="Changes">
          <p>
            We may update these Terms. For material changes, we will provide reasonable notice and
            may ask you to accept the new version before continuing. Changes apply prospectively from
            the stated effective date.
          </p>
        </Section>

        <Section id="general" title="General">
          <p>
            If one provision is unenforceable, the rest remain effective. A failure to enforce a
            provision is not a waiver. You may not transfer these Terms without our consent. These
            Terms, the Privacy Policy, and the Community Guidelines are the entire agreement about Oval.
          </p>
        </Section>

        <Section id="contact" title="Contact">
          <p>
            Questions can be sent to{' '}
            <a className="text-scarlet underline underline-offset-2" href={`mailto:${EMAIL}`}>{EMAIL}</a>.
          </p>
        </Section>
      </article>
    </div>
  )
}
