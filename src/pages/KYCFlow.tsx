// src/pages/KYCFlow.tsx — v3 (tarea 1.5)
// Cambios vs v2:
//   - Llama al proxy /api/kyc/* (sin VITE_AGENTS_URL ni secreto en el navegador)
//   - Despierta el servicio al abrir el flujo, con aviso visible
//   - Comprime las imágenes en el navegador; botón deshabilitado tras enviar
//   - Resultado de revisión manual con mensaje propio
// Cambios vs v1:
//   - RenderSpinUp durante warm-up (~50s Render spin-up)
//   - ErrorMessage con textos amigables y botón "Intentar de nuevo"
//   - Mobile responsive: padding, tap targets, font sizes

import { useState, useRef } from 'react'
import { useAccount } from 'wagmi'
import { useKYC } from '../hooks/useKYC'
import { ConnectWallet } from '../components/ui/ConnectWallet'
import { RenderSpinUp, type MensajeEspera } from '../components/ui/RenderSpinUp'
import { ErrorMessage } from '../components/ui/ErrorMessage'

// Peor caso medido: ~43 s de arranque en frío + 5 a 20 s de análisis ≈ 70 s.
const MENSAJES_ANALISIS: MensajeEspera[] = [
  { at: 0, text: 'Preparando y enviando tus imágenes de forma segura...' },
  { at: 8, text: 'Estamos analizando tu documento y tu selfie...' },
  { at: 30, text: 'Si el servicio estaba en reposo, puede tardar hasta un minuto más.' },
  { at: 75, text: 'Ya casi. Gracias por tu paciencia.' },
]

// ── Indicador de pasos ───────────────────────────────────────────────────────
function StepIndicator({ current }: { current: number }) {
  const steps = ['Wallet', 'Cédula', 'Selfie', 'Passport']
  return (
    <div className="flex items-center justify-center gap-1 mb-8">
      {steps.map((label, i) => {
        const n = i + 1
        const done = current > n
        const active = current === n
        return (
          <div key={n} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors
                  ${done ? 'bg-emerald-600 text-white' : active ? 'bg-emerald-600 text-white ring-4 ring-emerald-100' : 'bg-gray-100 text-gray-400'}`}
              >
                {done ? '✓' : n}
              </div>
              <span className={`text-xs mt-1 hidden sm:block ${active ? 'text-emerald-700 font-medium' : 'text-gray-400'}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-8 sm:w-12 h-0.5 mx-1 mb-5 sm:mb-0 ${done ? 'bg-emerald-400' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Upload card ──────────────────────────────────────────────────────────────
function UploadCard({
  title,
  hint,
  file,
  onSelect,
  inputRef,
  disabled = false,
  capture = 'environment',
}: {
  title: string
  hint: string
  file: File | null
  onSelect: (f: File) => void
  inputRef: React.RefObject<HTMLInputElement>
  disabled?: boolean
  capture?: 'environment' | 'user'
}) {
  return (
    <div className="border-2 border-dashed border-gray-200 rounded-2xl p-6 sm:p-8 text-center hover:border-emerald-400 transition-colors">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/*"
        capture={capture}
        className="hidden"
        disabled={disabled}
        onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onSelect(f) }}
      />
      <div className="text-3xl mb-3">{file ? '✅' : '📷'}</div>
      <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-400 mb-4">{hint}</p>

      {file && (
        <p className="text-xs text-emerald-700 font-medium mb-3 truncate px-4">{file.name}</p>
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className="w-full sm:w-auto bg-emerald-600 text-white px-6 py-3 rounded-xl
          text-sm font-medium hover:bg-emerald-700 active:scale-95 transition-all
          min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"   // accesibilidad mobile: tap target ≥ 44px
      >
        {file ? 'Cambiar imagen' : 'Seleccionar imagen'}
      </button>
    </div>
  )
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function KYCFlow() {
  const { address, isConnected } = useAccount()
  const {
    step, fase, servicio, error, aviso, passport, ocupado, documentoLeido,
    processDoc, processKYC, reset, despertar,
  } = useKYC()

  const docRef = useRef<HTMLInputElement>(null)
  const selfieRef = useRef<HTMLInputElement>(null)
  const [docFile, setDocFile] = useState<File | null>(null)
  const [selfieFile, setSelfieFile] = useState<File | null>(null)

  // Wallet no conectada
  if (!isConnected) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 sm:py-24 text-center">
        <div className="text-5xl mb-6">🔐</div>
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
          Conecta tu wallet
        </h2>
        <p className="text-gray-500 mb-8 text-sm sm:text-base">
          Necesitamos tu dirección en Polygon Amoy para generar tu SSI Passport.
        </p>
        <ConnectWallet />
      </div>
    )
  }

  // Redirigir al dashboard cuando el passport está listo
  if (step === 4 && passport) {
    localStorage.setItem('ssi_passport', JSON.stringify(passport))
    window.location.href = '/dashboard'
    return null
  }

  async function handleDoc(file: File) {
    if (ocupado) return
    setDocFile(file)
    setSelfieFile(null)
    await processDoc(file)
  }

  async function handleGenerate() {
    if (ocupado || !documentoLeido || !selfieFile || !address) return
    await processKYC(selfieFile, address)
  }

  function handleRetry() {
    reset()
    setDocFile(null)
    setSelfieFile(null)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">
          Verificación de identidad
        </h1>
        <p className="text-xs sm:text-sm text-gray-400 font-mono">
          {address?.slice(0, 6)}...{address?.slice(-4)}
        </p>
      </div>

      <StepIndicator current={step} />

      {/* Aviso: despertando el servicio de agentes (no bloquea el flujo) */}
      {servicio === 'despertando' && !ocupado && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800" role="status" aria-live="polite">
          <p className="font-medium">Estamos despertando el servicio, puede tardar hasta un minuto.</p>
          <p className="mt-1 text-amber-700">Mientras tanto, puedes ir preparando la foto de tu cédula.</p>
        </div>
      )}
      {servicio === 'no_disponible' && !ocupado && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
          <p className="font-medium">El servicio de verificación no respondió.</p>
          <p className="mt-1">Puede estar en mantenimiento. Intenta de nuevo en unos minutos.</p>
          <button type="button" onClick={() => void despertar()} className="mt-2 underline font-medium min-h-[44px]">
            Reintentar
          </button>
        </div>
      )}

      {/* Progreso — preparando o enviando */}
      {ocupado && (
        <RenderSpinUp
          title={fase === 'preparando' ? 'Preparando tus imágenes...' : step === 1 ? 'Leyendo tu cédula...' : 'Verificando tu identidad...'}
          mensajes={MENSAJES_ANALISIS}
          esperado={70}
          avisoTrasSegundos={125}
        />
      )}

      {/* Revisión manual */}
      {!ocupado && aviso && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center" role="status">
          <div className="text-3xl mb-3">🕒</div>
          <h2 className="font-semibold text-gray-900 mb-2">Verificación en revisión</h2>
          <p className="text-sm text-gray-600">{aviso}</p>
        </div>
      )}

      {/* Contenido de pasos — solo visible cuando no está cargando */}
      {!ocupado && !aviso && (
        <>
          {/* Error */}
          <ErrorMessage error={error} onRetry={handleRetry} onDismiss={() => reset()} />

          {/* Paso 1 — Cédula */}
          <div className="mb-6">
            <UploadCard
              title="Foto de tu cédula colombiana"
              hint="Imagen clara, sin reflejos ni bordes cortados"
              file={docFile}
              onSelect={handleDoc}
              inputRef={docRef as React.RefObject<HTMLInputElement>}
              disabled={ocupado}
            />
            {documentoLeido && (
              <div className="mt-3 flex items-center gap-2 text-sm text-emerald-700 font-medium px-1">
                <span>✅</span>
                <span>Leímos tu cédula correctamente</span>
              </div>
            )}
          </div>

          {/* Paso 2 — Selfie (visible cuando doc fue procesado) */}
          {step >= 2 && (
            <div className="mb-6">
              <UploadCard
                title="Tu selfie"
                hint="Mira de frente a la cámara con buena iluminación"
                file={selfieFile}
                onSelect={f => setSelfieFile(f)}
                inputRef={selfieRef as React.RefObject<HTMLInputElement>}
                disabled={ocupado}
                capture="user"
              />
            </div>
          )}

          {/* Paso 3 — Generar passport */}
          {step >= 2 && selfieFile && !error && (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={ocupado}
              aria-disabled={ocupado}
              className="w-full bg-emerald-600 text-white py-4 rounded-2xl text-base sm:text-lg
                font-semibold hover:bg-emerald-700 active:scale-95 transition-all
                shadow-lg shadow-emerald-200 min-h-[56px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              🪪 Generar mi SSI Passport
            </button>
          )}
        </>
      )}
    </div>
  )
}
