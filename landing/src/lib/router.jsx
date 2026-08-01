import { useCallback, useSyncExternalStore } from 'react'

const listeners = new Set()

function locationSnapshot() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`
}

function subscribe(listener) {
  listeners.add(listener)
  window.addEventListener('popstate', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('popstate', listener)
  }
}

function notifyNavigation() {
  for (const listener of listeners) listener()
}

export function navigate(to, { replace = false } = {}) {
  const target = new URL(to, window.location.origin)
  if (target.origin !== window.location.origin) {
    window.location.assign(target.href)
    return
  }
  window.history[replace ? 'replaceState' : 'pushState']({}, '', target)
  notifyNavigation()
  window.scrollTo({ top: 0, behavior: 'auto' })
}

export function useLocation() {
  useSyncExternalStore(subscribe, locationSnapshot)
  return {
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
  }
}

export function useNavigate() {
  return useCallback((to, options) => navigate(to, options), [])
}

export function useParams() {
  const { pathname } = useLocation()
  const parts = pathname.split('/').filter(Boolean).map(decodeURIComponent)
  if (parts[0] === 'pod' && parts[1]) return { podId: parts[1] }
  if (parts[0] === 'users' && parts[1]) return { userId: parts[1] }
  if (parts[0] === 'clubs' && parts[1]) return { clubId: parts[1] }
  return {}
}

export function Link({ to, onClick, target, children, ...props }) {
  const handleClick = (event) => {
    onClick?.(event)
    if (
      event.defaultPrevented
      || event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.shiftKey
      || event.altKey
      || target === '_blank'
    ) {
      return
    }
    const destination = new URL(to, window.location.origin)
    if (destination.origin !== window.location.origin) return
    event.preventDefault()
    navigate(`${destination.pathname}${destination.search}${destination.hash}`)
  }

  return (
    <a href={to} target={target} onClick={handleClick} {...props}>
      {children}
    </a>
  )
}
