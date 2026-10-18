// api/_lib/kyc-proxy.ts — lógica común del proxy KYC (tarea 1.5, P10.11).
//
// El navegador nunca habla con tokenids-agents: llama a /api/kyc/* y esta
// capa de servidor agrega X-Agents-Secret desde AGENTS_SHARED_SECRET.
// Reglas:
//   - Nunca se registra ni se devuelve el secreto, los encabezados de la
//     petición, las imágenes, la IP ni el detalle de error de los agentes.
//   - Fallo cerrado: un error, un timeout o una respuesta desconocida nunca
//     se convierten en aprobación.
// Los archivos de api/_lib no se publican como funciones (prefijo "_").

import { Readable } from 'node:stream'
import busboy from 'busboy'

// ── Límites ─────────────────────────────────────────────────────────────────
export const MAX_IMAGEN_BYTES = 1_500_000      // 1,5 MB por imagen
export const MAX_TOTAL_BYTES = 4_000_000       // 4 MB por petición
export const TIMEOUT_AGENTES_MS = 110_000      // la función tiene maxDuration 120 s
export const TIMEOUT_SALUD_MS = 60_000         // arranque en frío medido: 43 s

const WALLET_RE = /^0x[0-9a-fA-F]{40}$/

// ── Respuestas ──────────────────────────────────────────────────────────────
export type Motivo =
  | 'metodo_no_permitido'
  | 'formato_invalido'
  | 'falta_imagen'
  | 'imagen_grande'
  | 'tipo_no_permitido'
  | 'wallet_invalida'
  | 'demasiadas_solicitudes'
  | 'servicio_no_disponible'
  | 'tiempo_agotado'
  | 'error_procesamiento'

export const MENSAJES: Record<Motivo, string> = {
  metodo_no_permitido: 'Esta dirección no acepta ese tipo de solicitud.',
  formato_invalido: 'No pudimos leer el envío. Vuelve a seleccionar las imágenes e intenta de nuevo.',
  falta_imagen: 'Falta una imagen. Selecciona la foto de tu cédula y tu selfie.',
  imagen_grande: 'La imagen es demasiado pesada. Intenta con otra foto o tómala de nuevo.',
  tipo_no_permitido: 'Solo aceptamos fotos en formato JPG o PNG.',
  wallet_invalida: 'La dirección de tu wallet no es válida. Vuelve a conectarla e intenta de nuevo.',
  demasiadas_solicitudes: 'Hiciste varios intentos seguidos. Espera un minuto y vuelve a intentarlo.',
  servicio_no_disponible: 'El servicio de verificación no está disponible en este momento. Intenta de nuevo en unos minutos.',
  tiempo_agotado: 'El servicio tardó demasiado en responder. Intenta de nuevo en unos minutos.',
  error_procesamiento: 'No pudimos procesar tus imágenes. Revisa que se vean nítidas y sin reflejos, e intenta de nuevo.',
}

const ESTADO: Record<Motivo, number> = {
  metodo_no_permitido: 405,
  formato_invalido: 400,
  falta_imagen: 400,
  imagen_grande: 413,
  tipo_no_permitido: 415,
  wallet_invalida: 400,
  demasiadas_solicitudes: 429,
  servicio_no_disponible: 503,
  tiempo_agotado: 504,
  error_procesamiento: 502,
}

export function json(cuerpo: unknown, estado = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra },
  })
}

export function error(motivo: Motivo, extra: Record<string, string> = {}): Response {
  return json({ ok: false, motivo, mensaje: MENSAJES[motivo] }, ESTADO[motivo], extra)
}

export class ErrorProxy extends Error {
  readonly motivo: Motivo
  constructor(motivo: Motivo) {
    super(motivo)
    this.motivo = motivo
  }
}

// ── Registro: solo evento, estado y duración ────────────────────────────────
export function registrar(evento: string, datos: Record<string, string | number | boolean>): void {
  console.log(JSON.stringify({ evento, ...datos }))
}

// ── Configuración (nombres exactos de Vercel) ───────────────────────────────
export interface Config { url: string; secreto: string }

export function leerConfig(env: Record<string, string | undefined> = process.env): Config | null {
  const url = (env.AGENTS_URL ?? '').trim().replace(/\/+$/, '')
  const secreto = env.AGENTS_SHARED_SECRET ?? ''
  if (!url || !secreto || !/^https?:\/\//.test(url)) {
    const faltan = [!url || !/^https?:\/\//.test(url) ? 'AGENTS_URL' : '', !secreto ? 'AGENTS_SHARED_SECRET' : '']
      .filter(Boolean).join(', ')
    registrar('kyc_config_incompleta', { faltan })
    return null
  }
  return { url, secreto }
}

// ── Tipo de imagen por firma de bytes (no por el nombre ni el MIME declarado) ─
export type TipoImagen = 'image/jpeg' | 'image/png'

export function tipoPorFirma(b: Uint8Array): TipoImagen | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (b.length >= 8 && png.every((v, i) => b[i] === v)) return 'image/png'
  return null
}

// ── Límite de peticiones en memoria (por instancia; complementa el Firewall) ─
export class LimitePorMinuto {
  private readonly golpes = new Map<string, number[]>()
  private readonly max: number
  private readonly ventanaMs: number
  private readonly maxClaves: number

  constructor(max: number, ventanaMs = 60_000, maxClaves = 10_000) {
    this.max = max
    this.ventanaMs = ventanaMs
    this.maxClaves = maxClaves
  }

  /** Devuelve los segundos de espera si se supera el límite, o 0 si se permite. */
  intentar(clave: string, ahora = Date.now()): number {
    const desde = ahora - this.ventanaMs
    const previos = (this.golpes.get(clave) ?? []).filter(t => t > desde)
    if (previos.length >= this.max) {
      this.golpes.set(clave, previos)
      return Math.max(1, Math.ceil((previos[0] + this.ventanaMs - ahora) / 1000))
    }
    previos.push(ahora)
    this.golpes.delete(clave)
    this.golpes.set(clave, previos)
    // Memoria acotada: se descartan las claves más antiguas.
    while (this.golpes.size > this.maxClaves) {
      const primera = this.golpes.keys().next().value
      if (primera === undefined) break
      this.golpes.delete(primera)
    }
    return 0
  }
}

/** IP del cliente según Vercel. Solo se usa como clave del límite; nunca se registra. */
export function ipCliente(req: Request): string {
  const xff = req.headers.get('x-forwarded-for') ?? ''
  return xff.split(',')[0].trim() || req.headers.get('x-real-ip') || 'desconocida'
}

// ── Lectura del multipart en memoria con busboy ─────────────────────────────
export interface Imagen { campo: string; bytes: Uint8Array; tipo: TipoImagen }
export interface Envio { imagenes: Map<string, Imagen>; campos: Map<string, string> }

export async function leerMultipart(
  req: Request,
  camposImagen: readonly string[],
  camposTexto: readonly string[] = [],
): Promise<Envio> {
  const tipoContenido = req.headers.get('content-type') ?? ''
  if (!tipoContenido.toLowerCase().startsWith('multipart/form-data') || !req.body) {
    throw new ErrorProxy('formato_invalido')
  }
  const declarado = Number(req.headers.get('content-length') ?? '0')
  if (declarado > MAX_TOTAL_BYTES) throw new ErrorProxy('imagen_grande')

  return new Promise<Envio>((resolve, reject) => {
    const imagenes = new Map<string, Imagen>()
    const campos = new Map<string, string>()
    let total = 0
    let fallo: ErrorProxy | null = null
    const fallar = (m: Motivo) => { if (!fallo) fallo = new ErrorProxy(m) }

    let bb: busboy.Busboy
    try {
      bb = busboy({
        headers: { 'content-type': tipoContenido },
        limits: {
          fileSize: MAX_IMAGEN_BYTES,
          files: camposImagen.length,
          fields: camposTexto.length,
          fieldSize: 200,
        },
      })
    } catch {
      reject(new ErrorProxy('formato_invalido'))
      return
    }

    bb.on('file', (nombre, flujo) => {
      if (!camposImagen.includes(nombre) || imagenes.has(nombre)) {
        fallar('formato_invalido')
        flujo.resume()
        return
      }
      const trozos: Buffer[] = []
      flujo.on('data', (t: Buffer) => {
        total += t.length
        if (total > MAX_TOTAL_BYTES) fallar('imagen_grande')
        if (!fallo) trozos.push(t)
      })
      flujo.on('limit', () => fallar('imagen_grande'))
      flujo.on('end', () => {
        if (fallo) return
        const bytes = new Uint8Array(Buffer.concat(trozos))
        const tipo = tipoPorFirma(bytes)
        if (!tipo) { fallar('tipo_no_permitido'); return }
        imagenes.set(nombre, { campo: nombre, bytes, tipo })
      })
    })
    bb.on('field', (nombre, valor) => {
      if (!camposTexto.includes(nombre)) { fallar('formato_invalido'); return }
      campos.set(nombre, valor)
    })
    bb.on('filesLimit', () => fallar('formato_invalido'))
    bb.on('fieldsLimit', () => fallar('formato_invalido'))
    bb.on('error', () => { fallar('formato_invalido'); reject(fallo) })
    bb.on('close', () => {
      if (fallo) { reject(fallo); return }
      for (const c of camposImagen) {
        if (!imagenes.has(c)) { reject(new ErrorProxy('falta_imagen')); return }
      }
      resolve({ imagenes, campos })
    })

    Readable.fromWeb(req.body as import('node:stream/web').ReadableStream).on('error', () => {
      fallar('formato_invalido')
      bb.destroy()
      reject(fallo)
    }).pipe(bb)
  })
}

export function walletValida(w: string | undefined): w is string {
  return typeof w === 'string' && WALLET_RE.test(w)
}

// ── Llamadas a tokenids-agents ──────────────────────────────────────────────
function nombreArchivo(base: string, tipo: TipoImagen): string {
  return `${base}.${tipo === 'image/png' ? 'png' : 'jpg'}`
}

export function formulario(partes: Array<{ campo: string; imagen: Imagen; base: string }>): FormData {
  const f = new FormData()
  for (const p of partes) {
    // Nunca se reenvía el nombre original del archivo del usuario.
    f.append(p.campo, new Blob([p.imagen.bytes], { type: p.imagen.tipo }), nombreArchivo(p.base, p.imagen.tipo))
  }
  return f
}

export interface RespuestaAgentes { estado: number; datos: unknown }

/**
 * POST a los agentes con X-Agents-Secret. Lanza ErrorProxy con un motivo
 * amigable ante timeout, red o códigos distintos de 200. El detalle de error
 * de los agentes no se lee ni se registra (puede contener datos personales).
 */
export async function llamarAgentes(
  cfg: Config,
  ruta: string,
  cuerpo: FormData | object,
  limiteMs: number,
  evento: string,
): Promise<unknown> {
  const inicio = Date.now()
  const esForm = cuerpo instanceof FormData
  let res: Response
  try {
    res = await fetch(`${cfg.url}${ruta}`, {
      method: 'POST',
      headers: esForm
        ? { 'X-Agents-Secret': cfg.secreto }
        : { 'X-Agents-Secret': cfg.secreto, 'content-type': 'application/json' },
      body: esForm ? cuerpo : JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(Math.max(1, limiteMs)),
    })
  } catch (e) {
    const agotado = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')
    registrar(evento, { agentes: agotado ? 'timeout' : 'sin_conexion', ms: Date.now() - inicio })
    throw new ErrorProxy(agotado ? 'tiempo_agotado' : 'servicio_no_disponible')
  }
  registrar(evento, { agentes: res.status, ms: Date.now() - inicio })
  if (res.status !== 200) {
    await res.body?.cancel().catch(() => {})
    // 401/403: secreto o configuración; 5xx/422: fallo al procesar.
    throw new ErrorProxy(res.status === 401 || res.status === 403 || res.status === 404
      ? 'servicio_no_disponible'
      : 'error_procesamiento')
  }
  try {
    return await res.json()
  } catch {
    throw new ErrorProxy('error_procesamiento')
  }
}

export async function salud(cfg: Config, limiteMs = TIMEOUT_SALUD_MS): Promise<boolean> {
  const inicio = Date.now()
  try {
    const res = await fetch(`${cfg.url}/health`, { signal: AbortSignal.timeout(limiteMs) })
    const datos = res.ok ? await res.json().catch(() => null) : null
    const ok = res.ok && (datos as { status?: unknown } | null)?.status === 'ok'
    registrar('kyc_salud', { agentes: res.status, ok, ms: Date.now() - inicio })
    return ok
  } catch {
    registrar('kyc_salud', { agentes: 'sin_respuesta', ok: false, ms: Date.now() - inicio })
    return false
  }
}

// ── Interpretación de respuestas (fallo cerrado) ────────────────────────────
type Dict = Record<string, unknown>
const esDict = (v: unknown): v is Dict => typeof v === 'object' && v !== null && !Array.isArray(v)

export type DecisionDocumento = 'APPROVED' | 'ESCALATE' | 'REJECTED'

/** Del documento solo se devuelve si se pudo leer: ningún dato personal. */
export function resumenDocumento(datos: unknown): { ok: true; legible: boolean } {
  const d = esDict(datos) ? datos.decision : undefined
  if (d !== 'APPROVED' && d !== 'ESCALATE' && d !== 'REJECTED') throw new ErrorProxy('error_procesamiento')
  return { ok: true, legible: d !== 'REJECTED' }
}

export type ResultadoPipeline =
  | { decision: 'APPROVED'; documento: { document_number: unknown; birth_date: unknown } }
  | { decision: 'MANUAL_REVIEW' }
  | { decision: 'REJECTED'; causa: 'documento' | 'rostro' }

export function interpretarPipeline(datos: unknown): ResultadoPipeline {
  if (!esDict(datos)) throw new ErrorProxy('error_procesamiento')
  const decision = datos.pipeline_decision
  const doc = esDict(datos.document) ? datos.document : {}
  if (decision === 'APPROVED') {
    return { decision, documento: { document_number: doc.document_number, birth_date: doc.birth_date } }
  }
  if (decision === 'MANUAL_REVIEW') return { decision }
  if (decision === 'REJECTED') {
    return { decision, causa: doc.decision === 'REJECTED' ? 'documento' : 'rostro' }
  }
  // Valor desconocido: nunca avanza.
  throw new ErrorProxy('error_procesamiento')
}

export const MENSAJES_DECISION = {
  MANUAL_REVIEW: 'Recibimos tus imágenes. Tu verificación quedó en revisión manual; te avisaremos cuando termine.',
  REJECTED_documento: 'No pudimos validar tu cédula. Toma una foto nítida, sin reflejos y con la cédula completa, e intenta de nuevo.',
  REJECTED_rostro: 'Tu selfie no coincide con la foto de la cédula. Tómate una selfie de frente, con buena luz, e intenta de nuevo.',
} as const

