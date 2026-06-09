import { useEffect } from 'react'

const EMAIL = 'contactus@joinbridgeapp.com'

function Section({ title, children }) {
  return (
    <section className="mb-10">
      <h2 className="mb-4 border-b border-white/10 pb-3 text-lg font-semibold uppercase tracking-widest text-white">
        {title}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed text-white/60">{children}</div>
    </section>
  )
}

export default function Support() {
  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Support | Bridge'
    window.scrollTo(0, 0)
    return () => {
      document.title = previousTitle
    }
  }, [])

  return (
    <div className="min-h-screen bg-ink pb-24 pt-20">
      <main className="mx-auto max-w-3xl px-6 py-12 md:px-10">
        <div className="mb-12">
          <h1 className="mb-2 font-display text-3xl uppercase tracking-widest text-white">
            Bridge Support
          </h1>
          <p className="text-sm text-white/35">Account, safety, and privacy help</p>
        </div>

        <Section title="Contact Us">
          <p>
            Email <a className="text-scarlet underline underline-offset-2" href={`mailto:${EMAIL}`}>{EMAIL}</a>{' '}
            from the address connected to your Bridge account. Include a short description and any relevant
            pod, club, message, or report details. Do not email passwords or verification codes.
          </p>
        </Section>

        <Section title="Safety And Abuse">
          <p>
            Use the in-app report and block controls when possible. We prioritize credible threats and
            immediate safety concerns, then harassment and other serious violations.
          </p>
          <p>
            Bridge is not an emergency service. Call 911 for an emergency. For non-emergency campus safety
            resources, contact the appropriate university or local service directly.
          </p>
        </Section>

        <Section title="Account Access">
          <p>
            Use the password-reset option on the sign-in screen if you can access your OSU email. Contact us
            if you believe someone else accessed your account or changed account information without permission.
          </p>
        </Section>

        <Section title="Export Or Delete Your Data">
          <p>
            In Bridge, open Settings, then Privacy &amp; Data. You can export a copy of your account data or
            permanently delete your account without contacting support.
          </p>
          <p>
            Limited safety and moderation records may be retained as described in the Privacy Policy.
          </p>
        </Section>

        <Section title="Appeals And Privacy Requests">
          <p>
            To appeal a moderation action or make a privacy request, email us from the account address and
            clearly label the request. We may ask for information needed to verify that the account is yours.
          </p>
        </Section>

        <Section title="Independent Service">
          <p>Bridge is not affiliated with or endorsed by The Ohio State University.</p>
        </Section>
      </main>
    </div>
  )
}
