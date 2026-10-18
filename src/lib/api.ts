// src/lib/api.ts — v3 (tarea 1.5): el navegador solo llama a /api/kyc/* (proxy
// de Vercel). El secreto X-Agents-Secret y la URL de los agentes viven solo
// en el servidor; VITE_AGENTS_URL ya no se usa.

/** 130 s: la función tiene maxDuration 120 s y 110 s hacia los agentes. */
export const TIMEOUT_CLIENTE_MS = 130_000

export interface ErrorKyc { titulo: string; detalle: string }

export const ERRORES = {
  sinConexion: {
    titulo: 'No pudimos conectarnos',
    detalle: 'Revisa tu conexión a internet e intenta de nuevo.',
  },
  tiempoAgotado: {
    titulo: 'La verificación tardó demasiado',
    detalle: 'El servicio está muy ocupado. Intenta de nuevo en unos minutos.',
  },
  inesperado: {
    titulo: 'Algo salió mal',
    detalle: 'No pudimos completar la verificación. Intenta de nuevo en unos minutos.',
  },
  imagen: {
    titulo: 'No pudimos preparar la imagen',
    detalle: 'Intenta con otra foto en formato JPG o PNG.',
  },
} satisfies Record<string, ErrorKyc>

export class FalloKyc extends Error {
  readonly error: ErrorKyc
  constructor(error: ErrorKyc) {
    super(error.titulo)
    this.error = error
  }
}

const TITULOS: Record<string, string> = {
  imagen_grande: 'La imagen es demasiado pesada',
  tipo_no_permitido: 'Formato de imagen no válido',
  falta_imagen: 'Falta una imagen',
  wallet_invalida: 'Wallet no válida',
  demasiadas_solicitudes: 'Demasiados intentos',
  servicio_no_disponible: 'Servicio no disponible',
  tiempo_agotado: 'La verificación tardó demasiado',
  error_procesamiento: 'No pudimos procesar tus imágenes',
}

/** Convierte la respuesta de error del proxy en un mensaje amigable (sin códigos). */
export function errorDesdeRespuesta(cuerpo: unknown): ErrorKyc {
  const c = (typeof cuerpo === 'object' && cuerpo !== null ? cuerpo : {}) as { motivo?: unknown; mensaje?: unknown }
  const titulo = typeof c.motivo === 'string' ? TITULOS[c.motivo] : undefined
  const detalle = typeof c.mensaje === 'string' && c.mensaje.length <= 300 ? c.mensaje : undefined
  return titulo && detalle ? { titulo, detalle } : ERRORES.inesperado
}

async function pedir(ruta: string, init: RequestInit = {}, timeoutMs = TIMEOUT_CLIENTE_MS): Promise<unknown> {
  let res: Response
  try {
    res = await fetch(ruta, { ...init, signal: AbortSignal.timeout(timeoutMs) })
  } catch (e) {
    const agotado = e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError')
    throw new FalloKyc(agotado ? ERRORES.tiempoAgotado : ERRORES.sinConexion)
  }
  const cuerpo = await res.json().catch(() => null)
  if (!res.ok) throw new FalloKyc(errorDesdeRespuesta(cuerpo))
  return cuerpo
}

/**
 * Despierta el servicio de agentes (Render puede tardar ~45 s en arrancar).
 * Nunca lanza: devuelve true si responde.
 */
export async function despertarServicio(): Promise<boolean> {
  try {
    const c = await pedir('/api/kyc/salud', {}, 70_000) as { disponible?: unknown }
    return c?.disponible === true
  } catch {
    return false
  }
}

export async function enviarDocumento(documento: Blob): Promise<{ legible: boolean }> {
  const f = new FormData()
  f.append('documento', documento, 'documento.jpg')
  const c = await pedir('/api/kyc/documento', { method: 'POST', body: f }) as { ok?: unknown; legible?: unknown }
  if (c?.ok !== true || typeof c.legible !== 'boolean') throw new FalloKyc(ERRORES.inesperado)
  return { legible: c.legible }
}

export type ResultadoVerificacion =
  | { decision: 'APPROVED'; passport: Record<string, unknown> }
  | { decision: 'MANUAL_REVIEW' | 'REJECTED'; mensaje: string }

/** Fallo cerrado: cualquier respuesta que no sea una de las tres esperadas es un error. */
export function interpretarVerificacion(c: unknown): ResultadoVerificacion {
  const r = (typeof c === 'object' && c !== null ? c : {}) as Record<string, unknown>
  if (r.ok === true && r.decision === 'APPROVED' && typeof r.passport === 'object' && r.passport !== null) {
    return { decision: 'APPROVED', passport: r.passport as Record<string, unknown> }
  }
  if (r.ok === true && (r.decision === 'MANUAL_REVIEW' || r.decision === 'REJECTED') && typeof r.mensaje === 'string') {
    return { decision: r.decision, mensaje: r.mensaje }
  }
  throw new FalloKyc(ERRORES.inesperado)
}

export async function enviarVerificacion(documento: Blob, selfie: Blob, wallet: string): Promise<ResultadoVerificacion> {
  const f = new FormData()
  f.append('documento', documento, 'documento.jpg')
  f.append('selfie', selfie, 'selfie.jpg')
  f.append('wallet', wallet)
  return interpretarVerificacion(await pedir('/api/kyc/verificacion', { method: 'POST', body: f }))
}
