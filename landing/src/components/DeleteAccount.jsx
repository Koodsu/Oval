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
            Deleting your account permanently removes your profile, messages, pods, club
            memberships, friend connections, and associated personal data. This cannot be undone.
          </p>
          <p>
            Some records may be retained where required for safety or legal reasons (for example,
            moderation reports are kept in anonymized form). See our{' '}
            <a className="text-scarlet underline underline-offset-2" href="/privacy">
              Privacy Policy
            </a>{' '}
            for details.
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
