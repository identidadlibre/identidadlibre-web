import { Outlet, Link } from 'react-router-dom'
import { ConnectWallet } from '../ui/ConnectWallet'

export default function Layout() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold text-gray-900">
          identidadlibre<span className="text-emerald-500">.org</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm text-gray-600">
          <Link to="/">Inicio</Link>
          <Link to="/kyc">Obtener pasaporte</Link>
          <Link to="/dashboard">Mi identidad</Link>
          <ConnectWallet />
        </nav>
      </header>
      <main className="flex-1"><Outlet /></main>
      <footer className="border-t border-gray-100 px-6 py-4 text-center text-xs text-gray-400">
        <p>identidadlibre.org — Identidad Digital Soberana para Colombia</p>
        <div className="flex justify-center gap-4 mt-1">
          <a href="/terminos.html">Términos</a>
          <a href="/privacidad.html">Privacidad</a>
          <a href="/cookies.html">Cookies</a>
        </div>
      </footer>
    </div>
  )
}
