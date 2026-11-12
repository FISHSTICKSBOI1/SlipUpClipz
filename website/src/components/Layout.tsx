import { scrollToSection, sectionFromHash } from '../lib/scrollToSection'
import { Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { SITE } from '../config/site'
import { Footer } from './Footer'
import { Navbar } from './Navbar'

export function Layout() {
  const location = useLocation()

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const id = sectionFromHash(location.hash)
      if (id) scrollToSection(id)
      else window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    })
    return () => cancelAnimationFrame(frame)
  }, [location.key, location.pathname, location.hash])

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      {import.meta.env.DEV ? (
        <p className="bg-amber-500/15 px-4 py-2 text-center text-sm text-amber-100">
          Local website preview · v{SITE.currentVersion} · Production is unchanged.
        </p>
      ) : null}
      <Navbar />
      <main id="main-content" tabIndex={-1} className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
