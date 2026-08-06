import { useEffect } from 'react'

const EMAIL = 'contactus@theovalapp.com'
const EFFECTIVE_DATE = 'August 5, 2026'

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

function Mail() {
  return <Link href={`mailto:${EMAIL}`}>{EMAIL}</Link>
}

export default function PrivacyPolicy() {
  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Privacy Policy | Oval'
    window.scrollTo(0, 0)
    return () => {
      document.title = previousTitle
    }
  }, [])

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-ink pb-24 pt-20">
      <article className="mx-auto max-w-3xl px-6 py-12 md:px-10">
        <div className="mb-12">
          <h1 className="mb-2 font-display text-3xl uppercase tracking-widest text-white">
            Privacy Policy
          </h1>
          <p className="text-sm text-white/35">Effective {EFFECTIVE_DATE}</p>
        </div>

        <Section id="scope" title="Scope And Operator">
          <p>
            This policy explains how Oval Technologies LLC, an Ohio limited liability company
            ("Oval," "we," "us"), handles personal information through the Oval mobile app,
            theovalapp.com, waitlists, and related support and moderation services. Oval Technologies
            LLC is the controller of that information.
          </p>
          <p>
            Oval is an independent service and is not affiliated with or endorsed by The Ohio State
            University.
          </p>
        </Section>

        <Section id="collection" title="Information We Collect">
          <List items={[
            'Account and verification data: name, OSU email address, password hash, age attestation, email-verification status, and acceptance of current terms.',
            'Profile data you choose to provide: class year, major, biography, interests, clubs, Instagram handle, and profile image.',
            'Content and social activity: pods, meetup details, club information, announcements, messages, reactions, invitations, friendships, blocks, reports, attendance, recaps, and reliability information.',
            'Location data: meetup locations you enter and, only with your device permission, precise coordinates used to help create or find nearby plans. See "Precise Location" below.',
            'Device and service data: push-notification token and preferences, basic first-party feature-use events, request security records, and technical logs needed to operate and protect Oval.',
            'Website submissions: waitlist email addresses and club-registration details such as club name, leader name, role, description, category, and website or social link.',
            'Support and safety communications you send to us.',
          ]} />
          <p>
            Email verification confirms control of an eligible OSU email address. It is not an
            identity check, background check, or guarantee of current enrollment.
          </p>
        </Section>

        <Section id="location" title="Precise Location">
          <p>
            Precise geolocation is treated as sensitive personal information under several state
            privacy laws. We collect it only if you grant location permission on your device, and we
            use it solely to show nearby pods and to help you set a meetup location. You can enter a
            location manually instead, and you can revoke the permission at any time in iOS Settings
            without losing access to the rest of the app.
          </p>
          <p>
            We do not use precise location for advertising, profiling, or tracking your movements
            over time, we do not sell or share it, and we do not build a location history. We retain
            it only as long as needed for the pod or plan it relates to.
          </p>
        </Section>

        <Section id="use" title="How We Use Information">
          <List items={[
            'Create and secure accounts, verify eligible email domains, and keep users signed in.',
            'Provide profiles, pods, clubs, messaging, invitations, notifications, attendance, and reliability features.',
            'Moderate text and images using automated tools and human review, investigate reports, remove content, block abuse, and suspend or ban accounts.',
            'Send service messages, verification codes, password-reset codes, safety notices, and waitlist or launch updates you requested.',
            'Diagnose failures, measure use of Oval features, prevent fraud and rate-limit abuse, and improve the service.',
            'Comply with law, enforce our terms, and protect users, Oval, and the public.',
          ]} />
          <p>
            We do not sell or share personal information as those terms are defined under state
            privacy laws, we do not run third-party advertising, and we do not track users across
            other companies' apps and websites. We do not use your personal information to train
            machine learning models, and we do not use it to make decisions producing legal or
            similarly significant effects without human involvement.
          </p>
        </Section>

        <Section id="legal-bases" title="Legal Bases For Processing">
          <p>
            Where the EU or UK GDPR applies, for example if you use Oval while located in Europe, we
            rely on these legal bases: performance of our contract with you, to operate your account
            and provide the features you use; our legitimate interests in securing the service,
            preventing abuse, moderating content, and improving Oval; your consent, for precise
            location, push notifications, and marketing email, which you may withdraw at any time;
            and compliance with legal obligations.
          </p>
        </Section>

        <Section id="sharing" title="When We Share Information">
          <p>
            Other Oval users can see information needed for the social features you use, such as your
            display name, profile, pod or club participation, messages, and reliability information.
            Visibility depends on the feature and your relationship to the viewer.
          </p>
          <p>We use service providers only to operate Oval:</p>
          <List items={[
            'Supabase for PostgreSQL database and image storage infrastructure.',
            'Vercel for backend and website hosting.',
            'Resend for transactional email, waitlists, and club-registration email.',
            'Expo for mobile builds and push-notification delivery.',
            'OpenAI moderation services to evaluate submitted text and images for safety.',
            'Apple for App Store distribution and platform services on iOS.',
          ]} />
          <p>
            These providers act on our instructions under their own contracts and privacy terms. We
            may also disclose information when required by law or valid legal process, to address an
            emergency or credible threat to someone's safety, to enforce our terms, or as part of a
            merger, acquisition, or sale of assets with appropriate protections and notice to you.
          </p>
        </Section>

        <Section id="transfers" title="International Transfers">
          <p>
            Oval is operated from the United States and our service providers store and process
            information in the United States. If you access Oval from outside the United States, you
            understand that your information will be transferred to and processed in the United
            States, where privacy laws may differ from those in your location. Where required, we
            rely on appropriate safeguards such as the European Commission's standard contractual
            clauses.
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
            'Export your Oval account data from Settings.',
            'Delete your account and active account data from Settings.',
            'Unsubscribe from promotional email using the email link or contact us.',
            'Ask to access, correct, delete, or receive a portable copy of your information by emailing us.',
          ]} />
          <p>
            We may need to verify a request before acting on it, and we may deny or limit a request
            where permitted by law, including to protect another person, preserve an active safety
            investigation, or enforce a ban. We will not discriminate against you for exercising any
            privacy right.
          </p>
        </Section>

        <Section id="state-rights" title="Notice To Residents Of Certain States">
          <p>
            Depending on where you live, state privacy laws may give you the right to confirm whether
            we process your personal information, access it, correct inaccuracies, delete it, obtain
            a portable copy, and limit the use of sensitive personal information. We do not sell
            personal information, do not share it for cross-context behavioral advertising, and do
            not use or disclose sensitive personal information beyond the purposes described in this
            policy, so there is nothing to opt out of in those categories.
          </p>
          <p>
            To exercise a right, email <Mail /> from the address on your account or use the export and
            delete tools in Settings. You may designate an authorized agent to submit a request on
            your behalf where state law allows, and we may ask for proof of that authorization. If we
            deny a request, you may appeal by replying to our decision, and we will respond within
            the time your state's law requires.
          </p>
          <p>
            Where the EU or UK GDPR applies, you also have the right to object to or restrict certain
            processing, to withdraw consent at any time without affecting prior processing, and to
            lodge a complaint with your local supervisory authority.
          </p>
        </Section>

        <Section id="security" title="Security">
          <p>
            We use administrative, technical, and organizational safeguards designed to protect
            information, including password hashing, encrypted network connections, access controls,
            expiring verification codes, and session revocation. No system can guarantee absolute
            security, and we cannot promise that unauthorized access will never occur.
          </p>
          <p>
            If we become aware of a security breach affecting your personal information, we will
            notify you and any applicable regulator as required by law, including Ohio Revised Code
            section 1349.19, without unreasonable delay. Please tell us right away at <Mail /> if you
            believe your account has been compromised.
          </p>
        </Section>

        <Section id="age" title="Age Limit">
          <p>
            Oval is for people age 18 or older. We do not knowingly collect personal information from
            anyone under 18. If we learn that a user is under 18, we will terminate the account and
            delete the associated information. Contact us at <Mail /> if you believe a minor has
            created an account.
          </p>
        </Section>

        <Section id="changes" title="Policy Changes">
          <p>
            We may update this policy as Oval changes. We will change the effective date and, for
            material changes, provide notice in the app, by email, or on the website as appropriate.
          </p>
        </Section>

        <Section id="contact" title="Contact">
          <p>
            Oval Technologies LLC, Columbus, Ohio. Questions, privacy requests, or complaints can be
            sent to <Mail />.
          </p>
        </Section>
      </article>
    </main>
  )
}
