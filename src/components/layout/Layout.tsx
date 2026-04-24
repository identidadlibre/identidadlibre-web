// src/components/layout/Layout.tsx — v2 Sprint 3 / Bloque H
// Mobile responsive: hamburger menu, tap targets, safe areas

import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Link, useLocation } from 'react-router-dom'
import { ConnectWallet } from '../ui/ConnectWallet'

const NAV_LINKS = [
  { to: '/',          label: 'Inicio' },
  { to: '/kyc',       label: 'Verificar identidad' },
  { to: '/dashboard', label: 'Mi Passport' },
]

export default function Layout() {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* ── Navbar ── */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <span className="text-xl font-bold text-emerald-700 tracking-tight">
              Identidad<span className="text-gray-900">Libre</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                  ${pathname === to
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Right — wallet + hamburger */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:block">
              <ConnectWallet />
            </div>

            {/* Hamburger (mobile) */}
            <button
              onClick={() => setOpen(o => !o)}
              className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Menú"
            >
              {open ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {open && (
          <div className="md:hidden border-t border-gray-100 bg-white px-4 py-3 flex flex-col gap-1">
            {NAV_LINKS.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                className={`px-4 py-3 rounded-xl text-sm font-medium min-h-[44px] flex items-center
                  ${pathname === to
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-gray-700 hover:bg-gray-50'}`}
              >
                {label}
              </Link>
            ))}
            <div className="pt-2 border-t border-gray-100 mt-1">
              <ConnectWallet />
            </div>
          </div>
        )}
      </header>

      {/* ── Main ── */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-100 py-6 px-4 text-center">
        <div className="flex flex-wrap justify-center gap-4 text-xs text-gray-400">
          <a href="/terminos.html"      className="hover:text-gray-600 min-h-[44px] flex items-center">Términos</a>
          <a href="/privacidad.html"    className="hover:text-gray-600 min-h-[44px] flex items-center">Privacidad</a>
          <a href="/cookies.html"       className="hover:text-gray-600 min-h-[44px] flex items-center">Cookies</a>
          <a href="/consentimiento.html" className="hover:text-gray-600 min-h-[44px] flex items-center">Consentimiento</a>
        </div>
        <p className="mt-3 text-xs text-gray-300">
          © {new Date().getFullYear()} IdentidadLibre — Polygon Amoy · SSI W3C-VC 2.0
        </p>
      </footer>
    </div>
  )
}
