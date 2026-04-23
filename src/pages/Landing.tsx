import { Link } from 'react-router-dom'

export default function Landing() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-20">
      <div className="text-center mb-16">
        <span className="inline-block bg-emerald-50 text-emerald-700 text-sm font-medium px-3 py-1 rounded-full mb-6">
          Identidad soberana · Colombia · Gratis
        </span>
        <h1 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">
          Tu pasaporte digital,<br />en tu billetera
        </h1>
        <p className="text-xl text-gray-500 mb-10 max-w-xl mx-auto">
          Verifica tu identidad una sola vez. Úsala en cualquier plataforma blockchain.
        </p>
        <Link to="/kyc" className="inline-block bg-emerald-600 text-white px-8 py-4 rounded-xl text-lg font-medium hover:bg-emerald-700 transition-colors">
          Obtener mi SSI Passport
        </Link>
      </div>
    </div>
  )
}
