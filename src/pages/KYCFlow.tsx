// src/pages/KYCFlow.tsx — v2 Sprint 3 / Bloque H
// Cambios vs v1:
//   - RenderSpinUp durante warm-up (~50s Render spin-up)
//   - ErrorMessage con textos amigables y botón "Intentar de nuevo"
//   - Mobile responsive: padding, tap targets, font sizes

import { useState, useRef } from 'react'
import { useAccount } from 'wagmi'
import { useKYC } from '../hooks/useKYC'
import { ConnectWallet } from '../components/ui/ConnectWallet'
import { RenderSpinUp } from '../components/ui/RenderSpinUp'
import { ErrorMessage } from '../components/ui/ErrorMessage'

function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res((r.result as string).split(',')[1])
    r.onerror = rej
    r.readAsDataURL(file)
  })
}

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
}: {
  title: string
  hint: string
  file: File | null
  onSelect: (f: File) => void
  inputRef: React.RefObject<HTMLInputElement>
}) {
  return (
    <div className="border-2 border-dashed border-gray-200 rounded-2xl p-6 sm:p-8 text-center hover:border-emerald-400 transition-colors">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onSelect(f) }}
      />
      <div className="text-3xl mb-3">{file ? '✅' : '📷'}</div>
      <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-400 mb-4">{hint}</p>

      {file && (
        <p className="text-xs text-emerald-700 font-medium mb-3 truncate px-4">{file.name}</p>
      )}

      <button
        onClick={() => inputRef.current?.click()}
        className="w-full sm:w-auto bg-emerald-600 text-white px-6 py-3 rounded-xl
          text-sm font-medium hover:bg-emerald-700 active:scale-95 transition-all
          min-h-[44px]"   // accesibilidad mobile: tap target ≥ 44px
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
    step, loading, warming, warmElapsed,
    error, docData, passport,
    processDoc, processKYC, reset,
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
    setDocFile(file)
    const b64 = await fileToBase64(file)
    await processDoc(b64)
  }

  async function handleGenerate() {
    if (!docFile || !selfieFile || !address) return
    const doc64 = await fileToBase64(docFile)
    const s64 = await fileToBase64(selfieFile)
    await processKYC(doc64, s64, address)
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

      {/* Loading — warm-up de Render */}
      {warming && (
        <RenderSpinUp
          title="Conectando con el servidor de IA..."
          elapsed={warmElapsed}
        />
      )}

      {/* Loading — procesando IA (después del warm-up) */}
      {loading && !warming && (
        <RenderSpinUp title="La IA está analizando tu documento..." elapsed={0} />
      )}

      {/* Contenido de pasos — solo visible cuando no está cargando */}
      {!loading && !warming && (
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
            />
            {docData && (
              <div className="mt-3 flex items-center gap-2 text-sm text-emerald-700 font-medium px-1">
                <span>✅</span>
                <span>Documento procesado: {docData.nombre || docData.name || 'OK'}</span>
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
              />
            </div>
          )}

          {/* Paso 3 — Generar passport */}
          {step >= 2 && selfieFile && !error && (
            <button
              onClick={handleGenerate}
              className="w-full bg-emerald-600 text-white py-4 rounded-2xl text-base sm:text-lg
                font-semibold hover:bg-emerald-700 active:scale-95 transition-all
                shadow-lg shadow-emerald-200 min-h-[56px]"
            >
              🪪 Generar mi SSI Passport
            </button>
          )}
        </>
      )}
    </div>
  )
}
