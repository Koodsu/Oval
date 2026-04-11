import { useEffect } from 'react'

const EMAIL = 'contactus@joinbridgeapp.com'

function Section({ id, title, children }) {
  return (
    <section id={id} className="mb-10">
      <h2 className="text-lg font-semibold text-white mb-4 uppercase tracking-widest border-b border-white/10 pb-3">
        {title}
      </h2>
      {children}
    </section>
  )
}

function P({ children }) {
  return <p className="text-sm text-white/55 leading-relaxed mb-3">{children}</p>
}

function A({ href, children }) {
  return (
    <a
      href={href}
      target={href.startsWith('http') ? '_blank' : undefined}
      rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
      className="text-scarlet hover:text-scarlet/80 underline underline-offset-2 transition-colors"
    >
      {children}
    </a>
  )
}

export default function TermsOfUse() {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="bg-ink min-h-screen pt-20 pb-24">
      <div className="max-w-3xl mx-auto px-6 md:px-10 py-12">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-3xl font-display text-white tracking-widest uppercase mb-2">
            Terms of Use
          </h1>
          <p className="text-sm text-white/35">Last updated April 11, 2026</p>
        </div>

        <Section id="agreement" title="Agreement to Terms">
          <P>
            By accessing joinbridgeapp.com you agree to these Terms of Use. If you do not agree,
            stop using the site immediately.
          </P>
        </Section>

        <Section id="who-we-are" title="Who We Are">
          <P>
            Bridge is a pre-launch mobile application being developed to help college students
            connect through real-life activity pods on campus. The site is operated by Brady Van
            Bibber ("we," "us," "our").
          </P>
        </Section>

        <Section id="use-of-site" title="Use of the Site">
          <P>
            You may use this site only for lawful purposes. You agree not to use it to submit false
            information, attempt to gain unauthorized access to our systems, or engage in any
            conduct that could damage or impair the site.
          </P>
        </Section>

        <Section id="waitlist" title="Waitlist">
          <P>
            By submitting your email to join our waitlist you agree to receive occasional updates
            about Bridge's launch and related news. You may unsubscribe at any time. We will not
            sell or share your email with third parties.
          </P>
        </Section>

        <Section id="intellectual-property" title="Intellectual Property">
          <P>
            All content on this site including text, graphics, logos, and design is owned by Bridge
            and may not be copied or reproduced without permission.
          </P>
        </Section>

        <Section id="disclaimer" title="Disclaimer">
          <P>
            This site is provided "as is" without warranties of any kind. We do not guarantee the
            site will be available at all times or free from errors.
          </P>
        </Section>

        <Section id="limitation-of-liability" title="Limitation of Liability">
          <P>
            To the fullest extent permitted by law, Bridge shall not be liable for any indirect,
            incidental, or consequential damages arising from your use of this site.
          </P>
        </Section>

        <Section id="changes-to-terms" title="Changes to Terms">
          <P>
            We may update these terms at any time. Continued use of the site after changes
            constitutes acceptance of the new terms.
          </P>
        </Section>

        <Section id="not-affiliated" title="Not Affiliated with The Ohio State University">
          <P>
            Bridge is an independent product and is not affiliated with, endorsed by, or officially
            connected to The Ohio State University.
          </P>
        </Section>

        <Section id="contact" title="Contact">
          <P>
            Questions? Email us at <A href={`mailto:${EMAIL}`}>{EMAIL}</A>
          </P>
        </Section>
      </div>
    </div>
  )
}
