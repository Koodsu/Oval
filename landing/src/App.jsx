import { useEffect, useRef } from 'react'
import Nav from './components/Nav'
import Hero from './components/Hero'
import CampusLife from './components/CampusLife'
import HowItWorks from './components/HowItWorks'
import FeatureBento from './components/FeatureBento'
import StatsBar from './components/StatsBar'
import Testimonials from './components/Testimonials'
import FinalCta from './components/FinalCta'
import Footer from './components/Footer'
import PrivacyPolicy from './components/PrivacyPolicy'
import TermsOfUse from './components/TermsOfUse'
import CommunityGuidelines from './components/CommunityGuidelines'
import Support from './components/Support'
import DeleteAccount from './components/DeleteAccount'
import PodInvitePage from './components/PodInvitePage'
import UserProfilePage from './components/UserProfilePage'
import ClubsPage from './components/ClubsPage'
import AccessibilityStatement from './components/AccessibilityStatement'
import ChildSafetyStandards from './components/ChildSafetyStandards'
import { useScrollReveal } from './hooks/useScrollReveal'
import { useLocation } from './lib/router'

const GRAIN_SVG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E")`

function LandingPage() {
  useScrollReveal()
  return (
    <main id="main-content" tabIndex={-1} className="bg-void">
      <Hero />
      <CampusLife />
      <HowItWorks />
      <FeatureBento />
      <StatsBar />
      <Testimonials />
      <FinalCta />
    </main>
  )
}

function MainSiteLayout({ children }) {
  return (
    <div className="overflow-x-hidden bg-void font-sans text-white">
      {/* Grain overlay */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 9999,
          opacity: 0.028,
          backgroundImage: GRAIN_SVG,
          backgroundRepeat: 'repeat',
        }}
      />
      <Nav />
      {children}
      <Footer />
    </div>
  )
}

export default function App() {
  const { pathname } = useLocation()
  const route = pathname.replace(/\/+$/, '') || '/'
  const previousRoute = useRef(route)

  useEffect(() => {
    const routeTitles = {
      '/': 'Oval — Campus is happening right now',
      '/privacy': 'Privacy Policy | Oval',
      '/terms': 'Terms of Use | Oval',
      '/community-guidelines': 'Community Guidelines | Oval',
      '/support': 'Support | Oval',
      '/accessibility': 'Accessibility | Oval',
      '/child-safety': 'Child Safety Standards | Oval',
      '/delete-account': 'Delete Your Account | Oval',
    }
    document.title = routeTitles[route]
      ?? (route.startsWith('/clubs')
        ? 'Oval for Clubs'
        : route.startsWith('/pod/')
          ? 'Pod Invite | Oval'
          : route.startsWith('/users/')
            ? 'Profile | Oval'
            : 'Oval — Campus is happening right now')

    if (previousRoute.current === route) return
    previousRoute.current = route
    window.requestAnimationFrame(() => {
      document.getElementById('main-content')?.focus({ preventScroll: true })
    })
  }, [route])

  let content

  if (/^\/pod\/[^/]+$/.test(route)) content = <PodInvitePage />
  else if (/^\/users\/[^/]+$/.test(route)) content = <UserProfilePage />
  else if (route === '/clubs' || /^\/clubs\/[^/]+$/.test(route)) content = <ClubsPage />
  else {
    const page = {
      '/': <LandingPage />,
      '/privacy': <PrivacyPolicy />,
      '/terms': <TermsOfUse />,
      '/community-guidelines': <CommunityGuidelines />,
      '/support': <Support />,
      '/accessibility': <AccessibilityStatement />,
      '/child-safety': <ChildSafetyStandards />,
      '/delete-account': <DeleteAccount />,
    }[route] ?? <LandingPage />

    content = <MainSiteLayout>{page}</MainSiteLayout>
  }

  return (
    <>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      {content}
    </>
  )
}
