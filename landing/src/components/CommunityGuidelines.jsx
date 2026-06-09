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

function List({ items }) {
  return (
    <ul className="list-disc space-y-2 pl-5">
      {items.map((item) => <li key={item}>{item}</li>)}
    </ul>
  )
}

export default function CommunityGuidelines() {
  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Community Guidelines | Bridge'
    window.scrollTo(0, 0)
    return () => {
      document.title = previousTitle
    }
  }, [])

  return (
    <div className="min-h-screen bg-ink pb-24 pt-20">
      <div className="mx-auto max-w-3xl px-6 py-12 md:px-10">
        <div className="mb-12">
          <h1 className="mb-2 font-display text-3xl uppercase tracking-widest text-white">
            Community Guidelines
          </h1>
          <p className="text-sm text-white/35">Effective June 8, 2026</p>
        </div>

        <Section title="The Short Version">
          <p>
            Bridge is for adults with eligible OSU email addresses making real plans. Treat people like classmates,
            keep meetups lawful and safe, and use reports or blocks when something feels off.
          </p>
        </Section>

        <Section title="What Belongs Here">
          <List items={[
            'Campus activities, club updates, study plans, and real-life meetup coordination.',
            'Respectful chat before, during, and after pods or club events.',
            'Accurate profiles, club information, meeting details, and attendance activity.',
          ]} />
        </Section>

        <Section title="What Does Not Belong Here">
          <List items={[
            'Harassment, bullying, threats, hate speech, or targeted abuse.',
            'Sexual content, nudity, exploitation, or unwanted sexual messages.',
            'Illegal activity, weapons sales, drug sales, scams, impersonation, or spam.',
            'Sharing someone else\'s private information without permission.',
            'Creating pods or club posts that intentionally mislead people about who, where, or what is involved.',
          ]} />
        </Section>

        <Section title="Meetup Safety">
          <List items={[
            'Use public campus locations for first meetups whenever possible.',
            'Do not pressure anyone to share private contact details, housing information, or live location.',
            'If a meetup feels unsafe, leave and report it in the app.',
            'Bridge is not an emergency service. For emergencies, call 911 or local campus safety resources.',
          ]} />
        </Section>

        <Section title="Reports, Blocks, And Enforcement">
          <p>
            You can report users, messages, clubs, announcements, and pod behavior inside Bridge.
            Blocking separates you from the blocked user across messaging and shared pods where possible.
          </p>
          <p>
            We may remove content, restrict accounts, suspend users, preserve report records, or contact
            users when needed to protect the community and comply with law.
          </p>
          <p>
            Repeated misuse of reporting tools is also prohibited. To appeal an account action, email
            the support address below with the email on your account and relevant context.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            For support or abuse reports outside the app, email{' '}
            <a className="text-scarlet underline underline-offset-2" href={`mailto:${EMAIL}`}>{EMAIL}</a>.
          </p>
        </Section>
      </div>
    </div>
  )
}
