import { useEffect } from 'react'

const EMAIL = 'contactus@joinbridgeapp.com'

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

function Link({ href, children }) {
  return (
    <a
      className="text-scarlet underline underline-offset-2"
      href={href}
      target={href.startsWith('http') ? '_blank' : undefined}
      rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
    >
      {children}
    </a>
  )
}

export default function PrivacyPolicy() {
  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Privacy Policy | Bridge'
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
            Privacy Policy
          </h1>
          <p className="text-sm text-white/35">Effective June 8, 2026</p>
        </div>

        <Section id="scope" title="Scope And Operator">
          <p>
            This policy explains how Brady Van Bibber, doing business as Bridge ("Bridge," "we,"
            "us"), handles personal information through the Bridge mobile app, joinbridgeapp.com,
            waitlists, and related support and moderation services.
          </p>
          <p>
            Bridge is an independent service and is not affiliated with or endorsed by The Ohio
            State University.
          </p>
        </Section>

        <Section id="collection" title="Information We Collect">
          <List items={[
            'Account and verification data: name, OSU email address, password hash, age attestation, email-verification status, and acceptance of current terms.',
            'Profile data you choose to provide: class year, major, biography, interests, clubs, Instagram handle, and profile image.',
            'Content and social activity: pods, meetup details, club information, announcements, messages, reactions, invitations, friendships, blocks, reports, attendance, recaps, and reliability information.',
            'Location data: meetup locations you enter and, only with device permission, coordinates used to help create or find nearby plans. You can enter a location manually instead.',
            'Device and service data: push-notification token and preferences, basic first-party feature-use events, request security records, and technical logs needed to operate and protect Bridge.',
            'Website submissions: waitlist email addresses and club-registration details such as club name, leader name, role, description, category, and website or social link.',
            'Support and safety communications you send to us.',
          ]} />
          <p>
            Email verification confirms control of an eligible OSU email address. It is not an
            identity check, background check, or guarantee of current enrollment.
          </p>
        </Section>

        <Section id="use" title="How We Use Information">
          <List items={[
            'Create and secure accounts, verify eligible email domains, and keep users signed in.',
            'Provide profiles, pods, clubs, messaging, invitations, notifications, attendance, and reliability features.',
            'Moderate text and images, investigate reports, remove content, block abuse, and suspend or ban accounts.',
            'Send service messages, verification codes, password-reset codes, safety notices, and waitlist or launch updates you requested.',
            'Diagnose failures, measure use of Bridge features, prevent fraud and rate-limit abuse, and improve the service.',
            'Comply with law, enforce our terms, and protect users, Bridge, and the public.',
          ]} />
          <p>We do not sell personal information, run third-party advertising, or track users across other companies' apps and websites.</p>
        </Section>

        <Section id="sharing" title="When We Share Information">
          <p>
            Other Bridge users can see information needed for the social features you use, such as
            your display name, profile, pod or club participation, messages, and reliability
            information. Visibility depends on the feature and your relationship to the viewer.
          </p>
          <p>We use service providers only to operate Bridge:</p>
          <List items={[
            'Supabase for PostgreSQL database and image storage infrastructure.',
            'Vercel for backend and website hosting.',
            'Resend for transactional email, waitlists, and club-registration email.',
            'Expo for mobile builds and push-notification delivery.',
            'OpenAI moderation services to evaluate submitted text and images for safety.',
            'Apple for App Store distribution and platform services on iOS.',
          ]} />
          <p>
            These providers process information under their own contracts and privacy terms. We
            may also disclose information when required by law, to address an emergency or credible
            safety threat, to enforce our terms, or as part of a business transfer with appropriate
            protections.
          </p>
        </Section>

        <Section id="retention" title="Retention And Deletion">
          <List items={[
            'Account and feature data is generally kept while your account is active.',
            'Deleting your account in Settings removes the account, profile, authored content, messages, memberships, and associated service data from the active database.',
            'A limited safety report, including a capped snapshot of reported content, may remain after account or content deletion. Closed reports are ordinarily deleted after 730 days; open investigations are kept until closed.',
            'Hashed identifiers used for rate limiting are ordinarily deleted after 48 hours.',
            'If an account is banned, a one-way hash of its email may remain while the ban is active to prevent evasion.',
            'Waitlist and club-registration information remains until it is no longer needed, you unsubscribe, or you ask us to delete it.',
            'Service providers may retain encrypted backups for a limited recovery period, and we may retain information longer when law, fraud prevention, disputes, or safety requires it.',
          ]} />
        </Section>

        <Section id="choices" title="Your Choices And Rights">
          <List items={[
            'Edit profile and notification settings in the app.',
            'Decline location or push-notification permission in iOS settings; core app access does not require either permission.',
            'Export your Bridge account data from Settings.',
            'Delete your account and active account data from Settings.',
            'Unsubscribe from promotional email using the email link or contact us.',
            'Ask to access, correct, or delete information by emailing us. Applicable law may provide additional rights.',
          ]} />
          <p>
            We may need to verify a request and may deny or limit it where permitted by law, including
            to protect another person, preserve an active safety investigation, or enforce a ban.
          </p>
        </Section>

        <Section id="security" title="Security">
          <p>
            We use administrative, technical, and organizational safeguards designed to protect
            information, including password hashing, encrypted network connections, access controls,
            expiring verification codes, and session revocation. No system can guarantee absolute security.
          </p>
        </Section>

        <Section id="age" title="Age Limit">
          <p>
            Bridge is for people age 18 or older. We do not knowingly collect personal information
            from anyone under 18. Contact us if you believe a minor has created an account.
          </p>
        </Section>

        <Section id="changes" title="Policy Changes">
          <p>
            We may update this policy as Bridge changes. We will change the effective date and, for
            material changes, provide notice in the app, by email, or on the website as appropriate.
          </p>
        </Section>

        <Section id="contact" title="Contact">
          <p>
            Questions, privacy requests, or complaints can be sent to{' '}
            <Link href={`mailto:${EMAIL}`}>{EMAIL}</Link>.
          </p>
          <p>
            Brady Van Bibber, 10058 Cartgate Ct, Dublin, Ohio 43017, United States.
          </p>
        </Section>
      </article>
    </div>
  )
}
