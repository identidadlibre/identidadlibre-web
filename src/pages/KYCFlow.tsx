import { useState, useRef } from 'react'
import { useAccount } from 'wagmi'
import { useKYC } from '../hooks/useKYC'
import { ConnectWallet } from '../components/ui/ConnectWallet'

function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res((r.result as string).split(',')[1])
    r.onerror = rej
    r.readAsDataURL(file)
  })
}

export default function KYCFlow() {
  const { address, isConnected } = useAccount()
  const { step, loading, error, docData, passport, processDoc, processKYC } = useKYC()
  const docRef = useRef<HTMLInputElement>(null)
  const selfieRef = useRef<HTMLInputElement>(null)
  const [docFile, setDocFile] = useState<File | null>(null)
  const [selfieFile, setSelfieFile] = useState<File | null>(null)

  async function handleDoc(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setDocFile(f)
    const b64 = await fileToBase64(f)
    await processDoc(b64)
  }

  async function handleGenerate() {
    if (!docFile || !selfieFile || !address) return
    const doc64 = await fileToBase64(docFile)
    const s64 = await fileToBase64(selfieFile)
    await processKYC(doc64, s64, address)
  }

  if (!isConnected) return (
    <div className='max-w-lg mx-auto px-6 py-20 text-center'>
      <h2 className='text-2xl font-bold text-gray-900 mb-4'>
        Conecta tu wallet para comenzar
      </h2>
      <ConnectWallet />
    </div>
  )

  if (step === 4 && passport) {
    localStorage.setItem('ssi_passport', JSON.stringify(passport))
    window.location.href = '/dashboard'
    return null
  }

  return (
    <div className='max-w-2xl mx-auto px-6 py-12'>
      <h1 className='text-3xl font-bold text-gray-900 mb-2'>
        Verificación de identidad
      </h1>
      <p className='text-gray-500 mb-8'>
        Wallet: {address?.slice(0, 6)}...{address?.slice(-4)}
      </p>

      {/* Paso 1 — Cédula */}
      <div className='mb-8 p-6 border border-gray-200 rounded-xl'>
        <h3 className='font-semibold text-gray-900 mb-1'>
          Paso 1 — Sube tu cédula colombiana
        </h3>
        <p className='text-sm text-gray-500 mb-3'>
          Foto clara de la parte frontal. JPG o PNG.
        </p>
        <input ref={docRef} type='file' accept='image/*'
          onChange={handleDoc} className='hidden' />
        <button
          onClick={() => docRef.current?.click()}
          disabled={loading}
          className='bg-emerald-600 text-white px-6 py-3 rounded-lg hover:bg-emerald-700 disabled:opacity-50'>
          {loading && step === 1 ? 'Procesando...' : docFile ? docFile.name : 'Seleccionar imagen'}
        </button>
        {docData && (
          <p className='mt-3 text-sm text-emerald-700'>
            ✅ Documento procesado: {docData.nombre || docData.name || 'OK'}
          </p>
        )}
      </div>

      {/* Paso 2 — Selfie */}
      {step >= 2 && (
        <div className='mb-8 p-6 border border-gray-200 rounded-xl'>
          <h3 className='font-semibold text-gray-900 mb-1'>
            Paso 2 — Sube tu selfie
          </h3>
          <p className='text-sm text-gray-500 mb-3'>
            Foto de tu rostro con buena iluminación.
          </p>
          <input ref={selfieRef} type='file' accept='image/*'
            onChange={e => setSelfieFile(e.target.files?.[0] || null)}
            className='hidden' />
          <button
            onClick={() => selfieRef.current?.click()}
            className='bg-emerald-600 text-white px-6 py-3 rounded-lg hover:bg-emerald-700'>
            {selfieFile ? selfieFile.name : 'Seleccionar selfie'}
          </button>
          {selfieFile && (
            <p className='mt-3 text-sm text-emerald-700'>
              ✅ Selfie lista
            </p>
          )}
        </div>
      )}

      {/* Paso 3 — Generar */}
      {step >= 2 && selfieFile && (
        <button
          onClick={handleGenerate}
          disabled={loading}
          className='w-full bg-emerald-600 text-white py-4 rounded-xl text-lg font-medium hover:bg-emerald-700 disabled:opacity-50'>
          {loading ? 'Procesando con IA... puede tardar ~30s' : 'Generar mi SSI Passport'}
        </button>
      )}

      {error && (
        <div className='mt-4 p-4 bg-red-50 border border-red-200 rounded-lg'>
          <p className='text-red-600 text-sm font-medium'>Error: {error}</p>
          <p className='text-red-400 text-xs mt-1'>Intenta de nuevo o verifica tu conexión.</p>
        </div>
      )}
    </div>
  )
}
