// src/hooks/useKYC.ts — v2 con warm-up + spinup elapsed
// Bloque H: expone `warming`, `warmElapsed` para que KYCFlow muestre RenderSpinUp

import { useState } from 'react'
import { extractDocument, fullPipeline, warmUp } from '../lib/api'

export function useKYC() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [warming, setWarming] = useState(false)
  const [warmElapsed, setWarmElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [docData, setDocData] = useState<any>(null)
  const [faceMatch, setFaceMatch] = useState<any>(null)
  const [passport, setPassport] = useState<any>(null)

  function reset() {
    setStep(1); setLoading(false); setWarming(false)
    setWarmElapsed(0); setError(null)
    setDocData(null); setFaceMatch(null); setPassport(null)
  }

  async function processDoc(base64: string) {
    setLoading(true); setError(null); setWarming(true); setWarmElapsed(0)
    try {
      // Warm-up Render mientras el usuario espera
      await warmUp(secs => setWarmElapsed(secs))
      setWarming(false)

      const d = await extractDocument(base64)
      setDocData(d)
      setStep(2)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false); setWarming(false)
    }
  }

  async function processKYC(doc64: string, selfie64: string, wallet: string) {
    setLoading(true); setError(null); setWarming(true); setWarmElapsed(0)
    try {
      await warmUp(secs => setWarmElapsed(secs))
      setWarming(false)

      const p = await fullPipeline(doc64, selfie64, wallet)
      setPassport(p)
      setStep(4)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false); setWarming(false)
    }
  }

  return {
    step, loading, warming, warmElapsed, error,
    docData, faceMatch, passport,
    processDoc, processKYC, reset,
  }
}
