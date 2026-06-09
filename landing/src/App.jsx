import { Routes, Route, Outlet } from 'react-router-dom'
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
import PodInvitePage from './components/PodInvitePage'
import ClubsPage from './components/ClubsPage'
import { useScrollReveal } from './hooks/useScrollReveal'

const GRAIN_SVG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E")`

function LandingPage() {
  useScrollReveal()
  return (
    <main className="bg-void">
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

function MainSiteLayout() {
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
      <Outlet />
      <Footer />
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/pod/:podId" element={<PodInvitePage />} />
      <Route path="/clubs" element={<ClubsPage />} />
      <Route path="/clubs/:clubId" element={<ClubsPage />} />
      <Route element={<MainSiteLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfUse />} />
        <Route path="/community-guidelines" element={<CommunityGuidelines />} />
        <Route path="/support" element={<Support />} />
      </Route>
    </Routes>
  )
}
