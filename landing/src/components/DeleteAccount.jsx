import { useEffect, useState } from 'react'
import { API_BASE } from '../lib/apiBase'

const EMAIL = 'contactus@theovalapp.com'

export default function DeleteAccount() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle | sending | sent | error

  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Delete Your Account | Oval'
    window.scrollTo(0, 0)
    return () => {
      document.title = previousTitle
    }
  }, [])

  async function submit(e) {
    e.preventDefault()
    if (!email.trim() || status === 'sending') return
    setStatus('sending')
    try {
      const res = await fetch(`${API_BASE}/delete-account/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      setStatus(res.ok ? 'sent' : 'error')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="min-h-screen bg-ink pb-24 pt-20">
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-3xl px-6 py-12 md:px-10">
        <div className="mb-12">
          <h1 className="mb-2 font-display text-3xl uppercase tracking-widest text-white">
            Delete Your Account
          </h1>
          <p className="text-sm text-white/35">Permanently remove your Oval account and data</p>
        </div>

        <section className="mb-10 space-y-3 text-sm leading-relaxed text-white/60">
          <p>
            Deleting your Oval account is permanent and cannot be undone.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="mb-4 border-b border-white/10 pb-3 text-lg font-semibold uppercase tracking-widest text-white">
            What Is Deleted
          </h2>
          <p className="mb-4 text-sm leading-relaxed text-white/60">
            Removed immediately and permanently when deletion completes:
          </p>
          <ul className="ml-5 list-disc space-y-2 text-sm leading-relaxed text-white/60">
            <li>
              Your account and profile — name, email address, password, bio, major, class year,
              Instagram handle, interests and campus zones
            </li>
            <li>Your profile photo, deleted from our image storage</li>
            <li>
              Every message you sent — pod chats, direct messages, club chats, officer chats and
              announcements
            </li>
            <li>Your pod memberships, club memberships, friend connections and friend requests</li>
            <li>No-show reports you filed or that were filed about you</li>
            <li>Your push notification token, so notifications stop</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="mb-4 border-b border-white/10 pb-3 text-lg font-semibold uppercase tracking-widest text-white">
            What Is Kept, And For How Long
          </h2>
          <ul className="ml-5 list-disc space-y-2 text-sm leading-relaxed text-white/60">
            <li>
              <span className="text-white/85">Safety and moderation reports</span> — reports you
              filed, or that were filed about you, are kept so we can keep the community safe. Your
              identity is unlinked from them at deletion, leaving them anonymized. Once a report is
              resolved or dismissed it is deleted automatically after{' '}
              <span className="text-white/85">730 days (2 years)</span>.
            </li>
            <li>
              <span className="text-white/85">Ban records</span> — if your account was banned for a
              safety violation, we retain a one-way cryptographic hash of your email address
              indefinitely so the banned account cannot simply be recreated. The hash cannot be
              reversed into your email address, and no other personal data is kept with it.
            </li>
            <li>
              <span className="text-white/85">Clubs you created</span> — the club itself is not
              deleted if it still has members. Ownership passes to the most senior remaining member
              so the group can continue. Your personal messages within it are still deleted.
            </li>
          </ul>
          <p className="mt-4 text-sm leading-relaxed text-white/60">
            See our{' '}
            <a className="text-scarlet underline underline-offset-2" href="/privacy">
              Privacy Policy
            </a>{' '}
            for full details.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="mb-4 border-b border-white/10 pb-3 text-lg font-semibold uppercase tracking-widest text-white">
            If You Have The App
          </h2>
          <p className="text-sm leading-relaxed text-white/60">
            Open Oval and go to <span className="text-white/85">Profile → Settings → Delete
            account</span>. You&apos;ll confirm with your password and your account is removed
            immediately.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="mb-4 border-b border-white/10 pb-3 text-lg font-semibold uppercase tracking-widest text-white">
            Without The App
          </h2>
          <p className="mb-6 text-sm leading-relaxed text-white/60">
            Enter your account email and we&apos;ll send a confirmation link. Clicking the link in
            that email permanently deletes your account — the link expires after 1 hour.
          </p>

          {status === 'sent' ? (
            <p role="status" aria-live="polite" className="rounded-xl border border-white/10 bg-white/[0.04] p-5 text-sm leading-relaxed text-white/75">
              If an Oval account exists for that email, a confirmation link is on its way. Check
              your inbox (and spam folder) and follow the link to finish deletion.
            </p>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
              <label className="sr-only" htmlFor="delete-account-email">Account email</label>
              <input
                id="delete-account-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@osu.edu"
                aria-describedby={status === 'error' ? 'delete-account-error' : undefined}
                className="w-full rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-sm text-white placeholder-white/60 outline-none focus:border-scarlet"
              />
              <button
                type="submit"
                disabled={status === 'sending'}
                className="rounded-xl bg-scarlet px-6 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {status === 'sending' ? 'Sending…' : 'Send deletion link'}
              </button>
            </form>
          )}

          {status === 'error' ? (
            <p id="delete-account-error" role="alert" className="mt-3 text-sm text-scarlet">
              Something went wrong. Try again, or email{' '}
              <a className="underline underline-offset-2" href={`mailto:${EMAIL}`}>
                {EMAIL}
              </a>{' '}
              from your account email.
            </p>
          ) : null}
        </section>

        <section className="mb-10">
          <h2 className="mb-4 border-b border-white/10 pb-3 text-lg font-semibold uppercase tracking-widest text-white">
            Deleting Some Data Without Deleting Your Account
          </h2>
          <p className="mb-4 text-sm leading-relaxed text-white/60">
            You do not have to delete your whole account to remove data. All of the following are
            available inside the Oval app and take effect immediately:
          </p>
          <ul className="ml-5 list-disc space-y-2 text-sm leading-relaxed text-white/60">
            <li>
              <span className="text-white/85">Profile photo</span> — Profile → Edit Profile → remove
              your photo. It is deleted from our image storage, not just hidden.
            </li>
            <li>
              <span className="text-white/85">Profile details</span> — Profile → Edit Profile. Your
              bio, major, class year, Instagram handle, interests and campus zones are all optional
              and can be cleared at any time.
            </li>
            <li>
              <span className="text-white/85">Messages you sent</span> — press and hold any message
              you sent in a pod chat, direct message or club chat, then choose delete.
            </li>
            <li>
              <span className="text-white/85">Friend connections</span> — open the person&apos;s
              profile and remove them, which deletes the connection for both of you.
            </li>
            <li>
              <span className="text-white/85">Club memberships</span> — open the club and leave it.
            </li>
          </ul>
          <p className="mt-4 text-sm leading-relaxed text-white/60">
            If you would prefer we do any of this for you, or you want a copy of your data first,
            email{' '}
            <a className="text-scarlet underline underline-offset-2" href={`mailto:${EMAIL}`}>
              {EMAIL}
            </a>{' '}
            from the address connected to your Oval account and tell us what you would like removed.
          </p>
        </section>

        <section>
          <h2 className="mb-4 border-b border-white/10 pb-3 text-lg font-semibold uppercase tracking-widest text-white">
            Questions
          </h2>
          <p className="text-sm leading-relaxed text-white/60">
            You can also request deletion, or a copy of your data, by emailing{' '}
            <a className="text-scarlet underline underline-offset-2" href={`mailto:${EMAIL}`}>
              {EMAIL}
            </a>{' '}
            from the address connected to your account.
          </p>
        </section>
      </main>
    </div>
  )
}
