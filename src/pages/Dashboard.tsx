import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { ConnectWallet } from '../components/ui/ConnectWallet'

export default function Dashboard() {
  const { address, isConnected } = useAccount()
  const [passport, setPassport] = useState<any>(null)

  useEffect(() => {
    const saved = localStorage.getItem('ssi_passport')
    if (saved) {
      try { setPassport(JSON.parse(saved)) } catch { /* ignore */ }
    }
  }, [])

  function downloadPassport() {
    const blob = new Blob([JSON.stringify(passport, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'ssi-passport.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!isConnected) return (
    <div className='max-w-lg mx-auto px-6 py-20 text-center'>
      <h2 className='text-2xl font-bold text-gray-900 mb-4'>
        Conecta tu wallet para ver tu identidad
      </h2>
      <ConnectWallet />
    </div>
  )

  if (!passport) return (
    <div className='max-w-2xl mx-auto px-6 py-20 text-center'>
      <h1 className='text-3xl font-bold text-gray-900 mb-4'>Mi identidad</h1>
      <p className='text-gray-500 mb-6'>
        Aún no tienes un SSI Passport generado.
      </p>
      <a href='/kyc'
        className='bg-emerald-600 text-white px-6 py-3 rounded-lg hover:bg-emerald-700 inline-block'>
        Iniciar verificación KYC
      </a>
    </div>
  )

  const vc = passport?.verifiable_credential || passport
  const subject = vc?.credentialSubject || vc?.credential_subject || {}
  const score = passport?.kyc_score || passport?.score || null

  return (
    <div className='max-w-2xl mx-auto px-6 py-12'>
      <div className='flex items-center justify-between mb-8'>
        <h1 className='text-3xl font-bold text-gray-900'>Mi SSI Passport</h1>
        <span className='text-xs bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-medium'>
          ✅ Verificado
        </span>
      </div>

      {/* Wallet */}
      <div className='mb-6 p-4 bg-gray-50 rounded-xl'>
        <p className='text-xs text-gray-400 mb-1'>Wallet conectada</p>
        <p className='font-mono text-sm text-gray-700'>{address}</p>
      </div>

      {/* Datos del sujeto */}
      <div className='mb-6 p-6 border border-gray-200 rounded-xl space-y-4'>
        <h2 className='font-semibold text-gray-900 mb-4'>Datos verificados</h2>

        {subject.nombre || subject.name ? (
          <div>
            <p className='text-xs text-gray-400'>Nombre</p>
            <p className='text-gray-800 font-medium'>{subject.nombre || subject.name}</p>
          </div>
        ) : null}

        {subject.fecha_nacimiento || subject.date_of_birth ? (
          <div>
            <p className='text-xs text-gray-400'>Fecha de nacimiento</p>
            <p className='text-gray-800'>{subject.fecha_nacimiento || subject.date_of_birth}</p>
          </div>
        ) : null}

        {subject.nacionalidad || subject.nationality ? (
          <div>
            <p className='text-xs text-gray-400'>Nacionalidad</p>
            <p className='text-gray-800'>{subject.nacionalidad || subject.nationality}</p>
          </div>
        ) : null}

        {subject.numero_documento || subject.document_number ? (
          <div>
            <p className='text-xs text-gray-400'>Número de documento</p>
            <p className='text-gray-800 font-mono'>{subject.numero_documento || subject.document_number}</p>
          </div>
        ) : null}
      </div>

      {/* Score KYC */}
      {score !== null && (
        <div className='mb-6 p-6 border border-gray-200 rounded-xl'>
          <h2 className='font-semibold text-gray-900 mb-3'>Score KYC</h2>
          <div className='flex items-center gap-4'>
            <span className='text-4xl font-bold text-emerald-600'>
              {typeof score === 'number' ? `${Math.round(score * 100)}%` : score}
            </span>
            <div className='flex-1 bg-gray-100 rounded-full h-3'>
              <div
                className='bg-emerald-500 h-3 rounded-full'
                style={{ width: typeof score === 'number' ? `${Math.round(score * 100)}%` : '80%' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Acciones */}
      <div className='flex gap-4'>
        <button
          onClick={downloadPassport}
          className='flex-1 bg-emerald-600 text-white py-3 rounded-xl font-medium hover:bg-emerald-700'>
          Descargar JSON (W3C-VC)
        </button>
        <button
          onClick={() => { localStorage.removeItem('ssi_passport'); setPassport(null) }}
          className='px-6 py-3 border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 text-sm'>
          Limpiar
        </button>
      </div>

      {/* Raw JSON colapsado */}
      <details className='mt-6'>
        <summary className='text-xs text-gray-400 cursor-pointer hover:text-gray-600'>
          Ver JSON completo
        </summary>
        <pre className='mt-3 p-4 bg-gray-50 rounded-lg text-xs text-gray-600 overflow-auto max-h-64'>
          {JSON.stringify(passport, null, 2)}
        </pre>
      </details>
    </div>
  )
}
