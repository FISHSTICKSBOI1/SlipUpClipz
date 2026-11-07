import { Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { SITE } from '../config/site'
import { Footer } from './Footer'
import { Navbar } from './Navbar'

export function Layout() {
  const location = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [location.pathname])

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      {import.meta.env.DEV ? (
        <p className="bg-amber-500/15 px-4 py-2 text-center text-sm text-amber-100">
          Local preview of the v{SITE.currentVersion} website. Do not deploy until the GitHub release
          is published. Until then, the download redirect still serves the previous public installer.
        </p>
      ) : null}
      <Navbar />
      <main id="main-content" className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
