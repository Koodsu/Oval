import { Routes, Route } from 'react-router-dom'
import Nav from './components/Nav'
import Hero from './components/Hero'
import StatsBar from './components/StatsBar'
import HowItWorks from './components/HowItWorks'
import FeatureBento from './components/FeatureBento'
import Categories from './components/Categories'
import Testimonials from './components/Testimonials'
import FinalCta from './components/FinalCta'
import Footer from './components/Footer'
import PrivacyPolicy from './components/PrivacyPolicy'
import { useScrollReveal } from './hooks/useScrollReveal'

const GRAIN_SVG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E")`

function LandingPage() {
  useScrollReveal()
  return (
    <main>
      <Hero />
      <StatsBar />
      <HowItWorks />
      <FeatureBento />
      <Categories />
      <Testimonials />
      <FinalCta />
    </main>
  )
}

export default function App() {
  return (
    <div className="bg-cream font-sans text-ink overflow-x-hidden">
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
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
      </Routes>
      <Footer />
    </div>
  )
}
