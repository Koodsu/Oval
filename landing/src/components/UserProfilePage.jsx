import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from '../lib/router'
import { API_BASE } from '../lib/apiBase'

const SCARLET = '#CC0000'
const CREAM = '#F8F2E9'

function initials(name) {
  return String(name ?? 'Oval')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export default function UserProfilePage() {
  const { userId } = useParams()
  const [status, setStatus] = useState('loading')
  const [profile, setProfile] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const appLink = useMemo(() => `oval://users/${encodeURIComponent(userId ?? '')}`, [userId])

  useEffect(() => {
    if (!userId) {
      setStatus('error')
      setErrorMessage('This profile link is incomplete.')
      return
    }

    let cancelled = false
    setStatus('loading')
    setProfile(null)
    setErrorMessage('')

    fetch(`${API_BASE}/users/${encodeURIComponent(userId)}/public`)
      .then(async (response) => {
        const data = await response.json().catch(() => null)
        if (cancelled) return
        if (!response.ok || !data?.id || !data?.name) {
          setStatus('error')
          setErrorMessage(data?.error ?? 'This profile is no longer available.')
          return
        }
        setProfile(data)
        setStatus('success')
      })
      .catch(() => {
        if (!cancelled) setStatus('offline')
      })

    return () => {
      cancelled = true
    }
  }, [userId])

  const firstName = profile?.name?.split(' ')[0] ?? 'this profile'
  const details = [profile?.major, profile?.classYear].filter(Boolean)

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="min-h-screen font-sans text-ink overflow-hidden relative"
      style={{ backgroundColor: CREAM }}
    >
      <div
        aria-hidden
        className="absolute -top-28 -right-24 w-80 h-80 rounded-full opacity-20"
        style={{ backgroundColor: '#F7A8A8' }}
      />
      <div
        aria-hidden
        className="absolute top-32 -left-32 w-72 h-72 rounded-full opacity-20"
        style={{ backgroundColor: '#B7A4F6' }}
      />

      <div className="relative min-h-screen w-full max-w-[520px] mx-auto px-6 py-10 sm:py-14 flex flex-col">
        <header className="flex items-center gap-3 mb-10">
          <img src="/oval-logo.png" alt="" className="w-10 h-10 rounded-xl flex-shrink-0" />
          <span className="font-display text-ink text-3xl tracking-[0.12em] leading-none">OVAL</span>
        </header>

        {status === 'loading' && (
          <div className="flex-1 flex items-center justify-center py-20">
            <h1 className="sr-only">Oval profile</h1>
            <p className="text-warm-gray text-base">Opening profile…</p>
          </div>
        )}

        {(status === 'error' || status === 'offline') && (
          <section className="flex-1 flex flex-col items-center justify-center py-16 text-center">
            <div className="w-24 h-24 rounded-full bg-white border border-black/10 flex items-center justify-center mb-6">
              <span className="text-4xl" aria-hidden>👋</span>
            </div>
            <h1 className="text-3xl font-bold text-ink mb-3">
              {status === 'offline' ? 'Couldn’t reach Oval' : 'Profile unavailable'}
            </h1>
            <p className="text-warm-gray text-base leading-relaxed max-w-sm mb-8">
              {status === 'offline'
                ? 'Check your connection and try this link again.'
                : errorMessage}
            </p>
            <Link
              to="/"
              className="font-semibold underline underline-offset-4"
              style={{ color: SCARLET }}
            >
              Visit Oval
            </Link>
          </section>
        )}

        {status === 'success' && profile && (
          <section className="flex-1 flex flex-col">
            <div className="bg-white border border-black/10 rounded-[2rem] p-6 sm:p-8 shadow-[0_24px_80px_rgba(75,42,34,0.10)]">
              <div className="relative w-fit mx-auto mb-6">
                {profile.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt={`${profile.name}'s profile`}
                    className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-lg"
                  />
                ) : (
                  <div
                    className="w-32 h-32 rounded-full border-4 border-white shadow-lg flex items-center justify-center text-white text-4xl font-bold"
                    style={{ background: 'linear-gradient(145deg, #7C5AC8, #CC0000)' }}
                    aria-label={`${profile.name}'s initials`}
                  >
                    {initials(profile.name)}
                  </div>
                )}
                <div
                  aria-hidden
                  className="absolute -right-2 bottom-2 w-9 h-9 rounded-full border-4 border-white flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: SCARLET }}
                >
                  ✓
                </div>
              </div>

              <div className="text-center">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] mb-2" style={{ color: SCARLET }}>
                  Find me on Oval
                </p>
                <h1 className="text-3xl sm:text-4xl font-bold text-ink leading-tight">
                  {profile.name}
                </h1>
                {details.length > 0 && (
                  <p className="text-warm-gray mt-2">{details.join(' · ')}</p>
                )}
                {profile.bio && (
                  <p className="text-ink/80 text-base leading-relaxed mt-5 max-w-sm mx-auto">
                    {profile.bio}
                  </p>
                )}
              </div>

              <a
                href={appLink}
                className="w-full mt-8 block text-center font-semibold text-white rounded-2xl py-4 px-6 text-base tracking-wide transition-transform hover:-translate-y-0.5 active:translate-y-0"
                style={{ backgroundColor: SCARLET }}
              >
                Open {firstName}’s profile in Oval
              </a>
            </div>

            <div className="mt-7 rounded-2xl border border-black/10 bg-white/70 px-5 py-4 flex items-center gap-4">
              <div className="w-11 h-11 rounded-full bg-[#FDE7E7] flex items-center justify-center text-xl" aria-hidden>
                ↗
              </div>
              <p className="text-sm leading-relaxed text-warm-gray">
                The button opens this exact profile in the Oval app. If Oval isn’t installed yet,{' '}
                <Link to="/" className="font-semibold underline underline-offset-2" style={{ color: SCARLET }}>
                  learn more here
                </Link>.
              </p>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
