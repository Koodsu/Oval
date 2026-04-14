import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'

const API_BASE =
  import.meta.env.VITE_BRIDGE_API_URL ?? import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

const SCARLET = '#CC0000'
const CREAM = '#F5F0E8'

function formatMeetup(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export default function PodInvitePage() {
  const { podId } = useParams()
  const [status, setStatus] = useState('loading')
  const [pod, setPod] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!podId) {
      setStatus('error')
      setErrorMessage('Invalid link')
      return
    }

    let cancelled = false
    setStatus('loading')
    setPod(null)
    setErrorMessage('')

    const url = `${API_BASE.replace(/\/$/, '')}/pods/${podId}/public`

    fetch(url)
      .then(async (res) => {
        const text = await res.text()
        let data
        try {
          data = text ? JSON.parse(text) : null
        } catch {
          data = null
        }
        if (cancelled) return
        if (!res.ok) {
          setStatus('error')
          setErrorMessage(data?.error ?? 'Pod not found')
          return
        }
        if (!data?.id) {
          setStatus('error')
          setErrorMessage('Pod not found')
          return
        }
        setPod(data)
        setStatus('success')
      })
      .catch(() => {
        if (!cancelled) {
          setStatus('error')
          setErrorMessage('Pod not found')
        }
      })

    return () => {
      cancelled = true
    }
  }, [podId])

  return (
    <div
      className="min-h-screen font-sans text-ink flex flex-col"
      style={{ backgroundColor: CREAM }}
    >
      <div className="flex-1 w-full max-w-[480px] mx-auto px-6 py-12 flex flex-col">
        <header className="flex items-center gap-3 mb-10">
          <div
            className="w-9 h-9 flex items-center justify-center flex-shrink-0 font-display text-white text-lg leading-none"
            style={{ backgroundColor: SCARLET }}
          >
            B
          </div>
          <span className="font-display text-ink text-3xl tracking-[0.12em] leading-none">BRIDGE</span>
        </header>

        {status === 'loading' && (
          <div className="flex-1 flex items-center justify-center py-20">
            <p className="text-warm-gray text-base">Loading…</p>
          </div>
        )}

        {status === 'error' && (
          <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
            <p className="text-lg font-semibold text-ink mb-2">Pod not found</p>
            <p className="text-warm-gray text-sm mb-8">{errorMessage}</p>
            <Link to="/" className="text-[#CC0000] font-semibold underline underline-offset-2">
              Back to home
            </Link>
          </div>
        )}

        {status === 'success' && pod && (
          <>
            <h1 className="text-2xl sm:text-3xl font-bold text-ink leading-tight mb-4">
              You were invited to join a pod
            </h1>
            <p
              className="text-2xl sm:text-3xl font-bold leading-tight mb-8"
              style={{ color: SCARLET }}
            >
              {pod.name}
            </p>

            <dl className="space-y-4 text-base text-ink mb-10">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-warm-gray mb-0.5">
                  Activity type
                </dt>
                <dd>{pod.activityType}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-warm-gray mb-0.5">
                  When
                </dt>
                <dd>{formatMeetup(pod.meetupTime)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-warm-gray mb-0.5">
                  Location
                </dt>
                <dd>{pod.location}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-warm-gray mb-0.5">
                  Members
                </dt>
                <dd>
                  {pod.memberCount}
                  {typeof pod.maxMembers === 'number' ? ` / ${pod.maxMembers}` : ''}
                </dd>
              </div>
            </dl>

            <a
              href={`bridge://pod/${podId}`}
              className="w-full block text-center font-semibold text-white py-4 px-6 text-base tracking-wide transition-opacity hover:opacity-90 active:opacity-100"
              style={{ backgroundColor: SCARLET }}
            >
              Open in Bridge
            </a>

            <p className="mt-8 text-center text-sm text-warm-gray leading-relaxed">
              Don&apos;t have Bridge yet? Launching at Ohio State Fall 2026 —{' '}
              <Link to="/" className="text-[#CC0000] font-medium underline underline-offset-2">
                join the waitlist
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
