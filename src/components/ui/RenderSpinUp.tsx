// src/components/ui/RenderSpinUp.tsx
// Bloque H — Loading state para el spin-up de Render (~50s)
// Muestra un mensaje amigable mientras el backend se despierta

import { useEffect, useState } from 'react'

const MESSAGES = [
  { at: 0,  text: 'Conectando con el servidor...' },
  { at: 8,  text: 'El servidor está arrancando, esto puede tardar ~50 segundos la primera vez...' },
  { at: 20, text: 'Casi listo — los servidores gratuitos se duermen cuando no hay actividad 😴' },
  { at: 35, text: 'Unos segundos más...' },
  { at: 48, text: 'A punto de conectar...' },
]

interface Props {
  /** Texto que aparece en el título del spinner */
  title?: string
  /** Segundos que lleva esperando (se puede controlar externamente) */
  elapsed?: number
}

export function RenderSpinUp({ title = 'Procesando...', elapsed }: Props) {
  const [seconds, setSeconds] = useState(elapsed ?? 0)

  useEffect(() => {
    if (elapsed !== undefined) return // controlado externamente
    const id = setInterval(() => setSeconds(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [elapsed])

  const current = [...MESSAGES]
    .reverse()
    .find(m => seconds >= m.at)

  const pct = Math.min((seconds / 55) * 100, 95)

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {/* Spinner animado */}
      <div className="relative mb-6">
        <div className="w-16 h-16 rounded-full border-4 border-emerald-100 border-t-emerald-600 animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-mono text-emerald-700">{seconds}s</span>
        </div>
      </div>

      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>

      <p className="text-sm text-gray-500 max-w-xs min-h-[2.5rem] transition-all duration-500">
        {current?.text}
      </p>

      {/* Barra de progreso */}
      <div className="mt-6 w-full max-w-xs bg-gray-100 rounded-full h-1.5">
        <div
          className="h-1.5 bg-emerald-500 rounded-full transition-all duration-1000"
          style={{ width: `${pct}%` }}
        />
      </div>

      {seconds > 55 && (
        <p className="mt-4 text-xs text-amber-600 max-w-xs">
          Está tardando más de lo esperado. Puedes{' '}
          <button
            onClick={() => window.location.reload()}
            className="underline font-medium"
          >
            recargar la página
          </button>{' '}
          e intentarlo de nuevo.
        </p>
      )}
    </div>
  )
}
