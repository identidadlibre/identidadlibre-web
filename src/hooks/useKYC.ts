import { useState } from 'react'
import { extractDocument, fullPipeline } from '../lib/api'

export function useKYC() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [docData, setDocData] = useState<any>(null)
  const [passport, setPassport] = useState<any>(null)

  async function processDoc(base64: string) {
    setLoading(true)
    setError(null)
    try {
      const d = await extractDocument(base64)
      setDocData(d)
      setStep(2)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function processKYC(doc64: string, selfie64: string, wallet: string) {
    setLoading(true)
    setError(null)
    try {
      const p = await fullPipeline(doc64, selfie64, wallet)
      setPassport(p)
      setStep(4)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return { step, loading, error, docData, passport, processDoc, processKYC }
}
