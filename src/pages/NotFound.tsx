import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="max-w-xl mx-auto px-6 py-20 text-center">
      <h1 className="text-6xl font-bold text-gray-200 mb-4">404</h1>
      <p className="text-gray-500 mb-8">Página no encontrada.</p>
      <Link to="/" className="text-emerald-600 hover:underline">Volver al inicio</Link>
    </div>
  )
}
