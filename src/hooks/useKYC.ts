// src/hooks/useKYC.ts — v3 (tarea 1.5): usa el proxy /api/kyc/*.
// Despierta el servicio al abrir el flujo, comprime las imágenes en el
// navegador y expone estados para deshabilitar el envío y mostrar progreso.

import { useEffect, useRef, useState } from 'react'
import {
  ERRORES, FalloKyc, despertarServicio, enviarDocumento, enviarVerificacion,
  type ErrorKyc,
} from '../lib/api'
import { comprimirImagen } from '../lib/imagen'

export type EstadoServicio = 'despertando' | 'listo' | 'no_disponible'
export type Fase = 'inactivo' | 'preparando' | 'enviando'

async function despertarConReintento(): Promise<boolean> {
  return (await despertarServicio()) || (await despertarServicio())
}

function aError(e: unknown): ErrorKyc {
  return e instanceof FalloKyc ? e.error : ERRORES.inesperado
}

async function preparar(archivo: File): Promise<Blob> {
  try {
    return await comprimirImagen(archivo)
  } catch {
    throw new FalloKyc(ERRORES.imagen)
  }
}

export function useKYC() {
  const [step, setStep] = useState(1)
  const [fase, setFase] = useState<Fase>('inactivo')
  const [servicio, setServicio] = useState<EstadoServicio>('despertando')
  const [error, setError] = useState<ErrorKyc | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [documentoListo, setDocumentoListo] = useState<Blob | null>(null)
  const [passport, setPassport] = useState<Record<string, unknown> | null>(null)
  const enCurso = useRef(false)

  // Al abrir el flujo: despertar el servicio de agentes (el estado inicial ya es 'despertando').
  const [intento, setIntento] = useState(0)
  useEffect(() => {
    let activo = true
    void despertarConReintento().then(ok => {
      if (activo) setServicio(ok ? 'listo' : 'no_disponible')
    })
    return () => { activo = false }
  }, [intento])

  function despertar() {
    setServicio('despertando')
    setIntento(n => n + 1)
  }

  function reset() {
    setStep(1); setFase('inactivo'); setError(null); setAviso(null)
    setDocumentoListo(null); setPassport(null)
  }

  /** Evita envíos dobles: solo una operación a la vez. */
  async function unaVez(fn: () => Promise<void>) {
    if (enCurso.current) return
    enCurso.current = true
    setError(null); setAviso(null)
    try {
      await fn()
    } catch (e) {
      setError(aError(e))
    } finally {
      enCurso.current = false
      setFase('inactivo')
    }
  }

  function processDoc(archivo: File) {
    return unaVez(async () => {
      setFase('preparando')
      const doc = await preparar(archivo)
      setFase('enviando')
      const { legible } = await enviarDocumento(doc)
      if (!legible) {
        setDocumentoListo(null)
        setError({
          titulo: 'No pudimos leer tu cédula',
          detalle: 'Toma una foto nítida, sin reflejos y con la cédula completa, e intenta de nuevo.',
        })
        return
      }
      setDocumentoListo(doc)
      setStep(2)
    })
  }

  function processKYC(selfie: File, wallet: string) {
    return unaVez(async () => {
      if (!documentoListo) throw new FalloKyc(ERRORES.inesperado)
      setFase('preparando')
      const s = await preparar(selfie)
      setFase('enviando')
      const r = await enviarVerificacion(documentoListo, s, wallet)
      if (r.decision === 'APPROVED') {
        setPassport(r.passport)
        setStep(4)
      } else if (r.decision === 'MANUAL_REVIEW') {
        setAviso(r.mensaje)
        setStep(3)
      } else {
        setError({ titulo: 'No pudimos verificar tu identidad', detalle: r.mensaje })
      }
    })
  }

  return {
    step, fase, servicio, error, aviso, passport,
    ocupado: fase !== 'inactivo',
    documentoLeido: documentoListo !== null,
    processDoc, processKYC, reset, despertar,
  }
}
