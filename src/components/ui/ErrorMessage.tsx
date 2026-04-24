// src/components/ui/ErrorMessage.tsx
// Bloque H — Errores amigables con mensajes contextuales

interface Props {
  error: string | null
  onRetry?: () => void
  onDismiss?: () => void
}

/** Mapea mensajes técnicos a frases entendibles por usuarios no técnicos */
function humanize(raw: string): { title: string; detail: string } {
  const msg = raw.toLowerCase()

  if (msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('load failed')) {
    return {
      title: 'No se pudo conectar con el servidor',
      detail: 'El servidor puede estar iniciándose. Espera unos segundos y vuelve a intentarlo.',
    }
  }
  if (msg.includes('timeout') || msg.includes('timed out')) {
    return {
      title: 'La conexión tardó demasiado',
      detail: 'El servidor puede estar ocupado. Intenta de nuevo en unos segundos.',
    }
  }
  if (msg.includes('500') || msg.includes('internal server')) {
    return {
      title: 'Error interno del servidor',
      detail: 'Algo falló al procesar tu solicitud. Intenta de nuevo o contacta soporte.',
    }
  }
  if (msg.includes('413') || msg.includes('too large') || msg.includes('payload')) {
    return {
      title: 'La imagen es demasiado grande',
      detail: 'Usa una imagen de menos de 10MB. Puedes comprimirla antes de subirla.',
    }
  }
  if (msg.includes('400') || msg.includes('bad request')) {
    return {
      title: 'Datos incorrectos',
      detail: 'Verifica que la imagen sea clara y vuelve a intentarlo.',
    }
  }
  if (msg.includes('face') || msg.includes('rostro') || msg.includes('match')) {
    return {
      title: 'No se pudo verificar el rostro',
      detail: 'Asegúrate de que tanto la cédula como la selfie sean nítidas y bien iluminadas.',
    }
  }
  if (msg.includes('document') || msg.includes('cedula') || msg.includes('cédula')) {
    return {
      title: 'No se pudo leer el documento',
      detail: 'La imagen de la cédula debe ser clara, sin reflejos y con buena iluminación.',
    }
  }

  return {
    title: 'Algo salió mal',
    detail: raw.length < 120 ? raw : 'Ocurrió un error inesperado. Intenta de nuevo.',
  }
}

export function ErrorMessage({ error, onRetry, onDismiss }: Props) {
  if (!error) return null

  const { title, detail } = humanize(error)

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 mt-4">
      <div className="flex items-start gap-3">
        {/* Icono */}
        <div className="shrink-0 w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-sm">
          !
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-red-800">{title}</p>
          <p className="text-sm text-red-600 mt-0.5">{detail}</p>

          {(onRetry || onDismiss) && (
            <div className="flex gap-3 mt-3">
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="text-sm font-medium text-red-700 hover:text-red-900 underline"
                >
                  Intentar de nuevo
                </button>
              )}
              {onDismiss && (
                <button
                  onClick={onDismiss}
                  className="text-sm text-red-500 hover:text-red-700"
                >
                  Descartar
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
