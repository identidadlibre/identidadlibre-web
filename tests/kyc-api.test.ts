// Pruebas del proxy KYC (tarea 1.5) contra un servidor de agentes falso en
// localhost. Sin red externa, sin secretos reales y sin imágenes reales.
import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type IncomingMessage, type Server } from 'node:http'
import { randomBytes } from 'node:crypto'
import type { AddressInfo } from 'node:net'

const SECRETO = randomBytes(24).toString('hex')
const WALLET = '0x' + 'ab'.repeat(20)
const NOMBRE = 'Persona Ficticia Ñandú'
const CEDULA = '1000000001'

// Imágenes sintéticas: solo la firma de bytes + relleno.
const JPEG = (n = 2000) => { const b = new Uint8Array(n); b.set([0xff, 0xd8, 0xff, 0xe0]); return b }
const PNG = () => { const b = new Uint8Array(500); b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); return b }
const GIF = () => new TextEncoder().encode('GIF89a' + 'x'.repeat(100))

interface Recibida { ruta: string; secreto: string | undefined; tipo: string; cuerpo: string }
let recibidas: Recibida[] = []
let responder: (r: Recibida) => { estado: number; cuerpo: unknown; demora?: number }
let servidor: Server
const logs: string[] = []
const logOriginal = console.log

function leer(req: IncomingMessage): Promise<string> {
  return new Promise(res => {
    const t: Buffer[] = []
    req.on('data', c => t.push(c))
    req.on('end', () => res(Buffer.concat(t).toString('latin1')))
  })
}

before(async () => {
  servidor = createServer(async (req, res) => {
    const r: Recibida = {
      ruta: req.url ?? '', secreto: req.headers['x-agents-secret'] as string | undefined,
      tipo: req.headers['content-type'] ?? '', cuerpo: await leer(req),
    }
    recibidas.push(r)
    const { estado, cuerpo, demora } = responder(r)
    setTimeout(() => {
      res.writeHead(estado, { 'content-type': 'application/json' })
      res.end(JSON.stringify(cuerpo))
    }, demora ?? 0)
  })
  await new Promise<void>(r => servidor.listen(0, '127.0.0.1', r))
  const { port } = servidor.address() as AddressInfo
  process.env.AGENTS_URL = `http://127.0.0.1:${port}/`
  process.env.AGENTS_SHARED_SECRET = SECRETO
  console.log = (...a: unknown[]) => { logs.push(a.map(String).join(' ')) }
})

after(() => {
  console.log = logOriginal
  servidor.closeAllConnections()
  servidor.close()
  // Ningún registro contiene el secreto ni datos personales.
  const todo = logs.join('\n')
  for (const prohibido of [SECRETO, WALLET, NOMBRE, CEDULA, '127.0.0.1-cliente']) {
    assert.ok(!todo.includes(prohibido), `un log contiene un dato prohibido: ${prohibido.slice(0, 6)}…`)
  }
})

let ipSecuencia = 0
beforeEach(() => { recibidas = []; ipSecuencia++ })

function peticion(ruta: string, partes: Record<string, Uint8Array | string>, ip = `10.0.0.${ipSecuencia}`): Request {
  const f = new FormData()
  for (const [k, v] of Object.entries(partes)) {
    if (typeof v === 'string') f.append(k, v)
    else f.append(k, new Blob([v]), 'mi-foto-con-nombre-real.jpg')
  }
  return new Request(`https://identidadlibre.test${ruta}`, {
    method: 'POST', body: f, headers: { 'x-forwarded-for': `${ip}, 127.0.0.1-cliente` },
  })
}

async function cuerpo(res: Response) {
  const texto = await res.text()
  assert.ok(!texto.includes(SECRETO), 'la respuesta contiene el secreto')
  for (const [, v] of res.headers) assert.ok(!v.includes(SECRETO), 'un encabezado contiene el secreto')
  return JSON.parse(texto)
}

const documentoAgentes = (decision: string) => ({
  decision, confidence: 0.9, document_type: 'CEDULA', document_number: CEDULA,
  full_name: NOMBRE, birth_date: '1990-01-01', is_adult: true,
})

const { POST: documento } = await import('../api/kyc/documento.ts')
const { POST: verificacion } = await import('../api/kyc/verificacion.ts')
const { GET: saludGet } = await import('../api/kyc/salud.ts')
const proxy = await import('../api/_lib/kyc-proxy.ts')

// ── /api/kyc/documento ──────────────────────────────────────────────────────

test('documento: reenvía con el secreto y devuelve solo { ok, legible }', async () => {
  responder = () => ({ estado: 200, cuerpo: documentoAgentes('APPROVED') })
  const res = await documento(peticion('/api/kyc/documento', { documento: JPEG() }))
  assert.equal(res.status, 200)
  const c = await cuerpo(res)
  assert.deepEqual(c, { ok: true, legible: true })
  assert.equal(recibidas.length, 1)
  const r = recibidas[0]
  assert.equal(r.ruta, '/kyc/extract-document')
  assert.equal(r.secreto, SECRETO)
  assert.match(r.tipo, /^multipart\/form-data/)
  assert.match(r.cuerpo, /name="file"; filename="documento\.jpg"/)
  assert.ok(!r.cuerpo.includes('mi-foto-con-nombre-real'), 'se reenvió el nombre original del archivo')
})

test('documento: REJECTED → legible false', async () => {
  responder = () => ({ estado: 200, cuerpo: documentoAgentes('REJECTED') })
  const c = await cuerpo(await documento(peticion('/api/kyc/documento', { documento: PNG() })))
  assert.deepEqual(c, { ok: true, legible: false })
  assert.match(recibidas[0].cuerpo, /filename="documento\.png"/)
})

test('documento: sin imagen → 400 y no llama a los agentes', async () => {
  const res = await documento(peticion('/api/kyc/documento', {}))
  assert.equal(res.status, 400)
  assert.equal((await cuerpo(res)).motivo, 'falta_imagen')
  assert.equal(recibidas.length, 0)
})

test('documento: imagen de más de 1,5 MB → 413', async () => {
  const res = await documento(peticion('/api/kyc/documento', { documento: JPEG(1_600_000) }))
  assert.equal(res.status, 413)
  assert.equal(recibidas.length, 0)
})

test('documento: tipo por firma de bytes (GIF disfrazado) → 415', async () => {
  const res = await documento(peticion('/api/kyc/documento', { documento: GIF() }))
  assert.equal(res.status, 415)
  assert.equal(recibidas.length, 0)
})

test('documento: campo inesperado → 400', async () => {
  const res = await documento(peticion('/api/kyc/documento', { documento: JPEG(), otro: JPEG() }))
  assert.equal(res.status, 400)
  assert.equal(recibidas.length, 0)
})

test('documento: no multipart → 400', async () => {
  const res = await documento(new Request('https://x.test/api/kyc/documento', {
    method: 'POST', body: JSON.stringify({ image: 'abc' }), headers: { 'content-type': 'application/json' },
  }))
  assert.equal(res.status, 400)
  assert.equal((await cuerpo(res)).motivo, 'formato_invalido')
})

test('documento: content-length declarado > 4 MB → 413 sin leer el cuerpo', async () => {
  const res = await documento(new Request('https://x.test/api/kyc/documento', {
    method: 'POST', body: 'x', headers: { 'content-type': 'multipart/form-data; boundary=a', 'content-length': '5000000' },
  }))
  assert.equal(res.status, 413)
})

test('documento: los agentes responden 401 → 503 amigable', async () => {
  responder = () => ({ estado: 401, cuerpo: { detail: 'Secreto de autenticación inválido o ausente' } })
  const res = await documento(peticion('/api/kyc/documento', { documento: JPEG() }))
  assert.equal(res.status, 503)
  const c = await cuerpo(res)
  assert.equal(c.motivo, 'servicio_no_disponible')
  assert.ok(!JSON.stringify(c).includes('Secreto de autenticación'))
})

test('documento: 500 de los agentes con datos personales en detail → 502 sin reenviarlos', async () => {
  responder = () => ({ estado: 500, cuerpo: { detail: `fallo con ${NOMBRE} ${CEDULA}` } })
  const res = await documento(peticion('/api/kyc/documento', { documento: JPEG() }))
  assert.equal(res.status, 502)
  const texto = JSON.stringify(await cuerpo(res))
  assert.ok(!texto.includes(NOMBRE) && !texto.includes(CEDULA))
})

test('documento: decisión desconocida → 502 (fallo cerrado)', async () => {
  responder = () => ({ estado: 200, cuerpo: { decision: 'MAYBE' } })
  const res = await documento(peticion('/api/kyc/documento', { documento: JPEG() }))
  assert.equal(res.status, 502)
})

test('documento: límite de 10 por minuto por IP → 429 con retry-after', async () => {
  responder = () => ({ estado: 200, cuerpo: documentoAgentes('APPROVED') })
  for (let i = 0; i < 10; i++) {
    assert.equal((await documento(peticion('/api/kyc/documento', { documento: JPEG() }, '10.9.9.9'))).status, 200)
  }
  const res = await documento(peticion('/api/kyc/documento', { documento: JPEG() }, '10.9.9.9'))
  assert.equal(res.status, 429)
  assert.ok(Number(res.headers.get('retry-after')) > 0)
  assert.equal((await documento(peticion('/api/kyc/documento', { documento: JPEG() }, '10.9.9.8'))).status, 200)
})

// ── /api/kyc/verificacion ───────────────────────────────────────────────────

const pipeline = (pipeline_decision: string, docDecision = 'APPROVED', match: boolean | null = true) => ({
  pipeline_decision, reason: 'x', document: documentoAgentes(docDecision),
  facial_comparison_performed: true, facial: { match }, facial_skip_reason: null,
})

test('verificación APPROVED: pipeline + pasaporte en el servidor; la cédula no llega al navegador', async () => {
  const pasaporte = { ssi_passport_id: 'SSI-PRUEBA', wallet: WALLET, proofs: [] }
  responder = r => r.ruta.startsWith('/kyc/full-pipeline')
    ? { estado: 200, cuerpo: pipeline('APPROVED') }
    : { estado: 200, cuerpo: pasaporte }
  const res = await verificacion(peticion('/api/kyc/verificacion', { documento: JPEG(), selfie: JPEG(), wallet: WALLET }))
  assert.equal(res.status, 200)
  const c = await cuerpo(res)
  assert.equal(c.decision, 'APPROVED')
  assert.deepEqual(c.passport, pasaporte)
  const texto = JSON.stringify(c)
  assert.ok(!texto.includes(CEDULA) && !texto.includes(NOMBRE) && !texto.includes('1990-01-01'))

  assert.equal(recibidas.length, 2)
  const [p, g] = recibidas
  assert.equal(p.ruta, `/kyc/full-pipeline?wallet_address=${WALLET}`)
  assert.equal(p.secreto, SECRETO)
  assert.match(p.cuerpo, /name="document"; filename="documento\.jpg"/)
  assert.match(p.cuerpo, /name="selfie"; filename="selfie\.jpg"/)
  assert.equal(g.ruta, '/kyc/generate-passport')
  assert.equal(g.secreto, SECRETO)
  assert.match(g.tipo, /^application\/json/)
  assert.deepEqual(JSON.parse(g.cuerpo), {
    walletAddress: WALLET,
    kycResult: { decision: 'APPROVED', document_number: CEDULA, birth_date: '1990-01-01' },
  })
})

test('verificación MANUAL_REVIEW: no genera pasaporte', async () => {
  responder = () => ({ estado: 200, cuerpo: pipeline('MANUAL_REVIEW', 'ESCALATE') })
  const c = await cuerpo(await verificacion(peticion('/api/kyc/verificacion', { documento: JPEG(), selfie: JPEG(), wallet: WALLET })))
  assert.equal(c.decision, 'MANUAL_REVIEW')
  assert.ok(!('passport' in c))
  assert.equal(recibidas.length, 1)
})

test('verificación REJECTED por documento y por rostro: mensajes distintos, sin pasaporte', async () => {
  responder = () => ({ estado: 200, cuerpo: pipeline('REJECTED', 'REJECTED', null) })
  const a = await cuerpo(await verificacion(peticion('/api/kyc/verificacion', { documento: JPEG(), selfie: JPEG(), wallet: WALLET })))
  responder = () => ({ estado: 200, cuerpo: pipeline('REJECTED', 'APPROVED', false) })
  const b = await cuerpo(await verificacion(peticion('/api/kyc/verificacion', { documento: JPEG(), selfie: JPEG(), wallet: WALLET }, '10.1.1.1')))
  assert.equal(a.decision, 'REJECTED')
  assert.equal(b.decision, 'REJECTED')
  assert.match(a.mensaje, /cédula/)
  assert.match(b.mensaje, /selfie/)
  assert.ok(!('passport' in a) && !('passport' in b))
  assert.ok(recibidas.every(r => r.ruta.startsWith('/kyc/full-pipeline')))
})

test('verificación: decisión desconocida → 502 y sin pasaporte', async () => {
  responder = () => ({ estado: 200, cuerpo: pipeline('APROBADO_TAL_VEZ') })
  const res = await verificacion(peticion('/api/kyc/verificacion', { documento: JPEG(), selfie: JPEG(), wallet: WALLET }))
  assert.equal(res.status, 502)
  assert.equal(recibidas.length, 1)
})

test('verificación: falla el pasaporte tras APPROVED → 502, nunca APPROVED sin pasaporte', async () => {
  responder = r => r.ruta.startsWith('/kyc/full-pipeline')
    ? { estado: 200, cuerpo: pipeline('APPROVED') }
    : { estado: 500, cuerpo: { detail: 'x' } }
  const res = await verificacion(peticion('/api/kyc/verificacion', { documento: JPEG(), selfie: JPEG(), wallet: WALLET }))
  assert.equal(res.status, 502)
  assert.notEqual((await cuerpo(res)).decision, 'APPROVED')
})

test('verificación: wallet inválida → 400 y no llama a los agentes', async () => {
  const res = await verificacion(peticion('/api/kyc/verificacion', { documento: JPEG(), selfie: JPEG(), wallet: '0x123' }))
  assert.equal(res.status, 400)
  assert.equal((await cuerpo(res)).motivo, 'wallet_invalida')
  assert.equal(recibidas.length, 0)
})

test('verificación: falta la selfie → 400', async () => {
  const res = await verificacion(peticion('/api/kyc/verificacion', { documento: JPEG(), wallet: WALLET }))
  assert.equal(res.status, 400)
  assert.equal(recibidas.length, 0)
})

test('verificación: total de más de 4 MB → 413', async () => {
  const f = new FormData()
  f.append('documento', new Blob([JPEG(1_400_000)]), 'a.jpg')
  f.append('selfie', new Blob([JPEG(1_400_000)]), 'b.jpg')
  f.append('wallet', WALLET)
  // 2,8 MB: dentro del límite; se comprueba con un cuerpo declarado mayor.
  const res = await verificacion(new Request('https://x.test/api/kyc/verificacion', {
    method: 'POST', body: 'x',
    headers: { 'content-type': 'multipart/form-data; boundary=a', 'content-length': '4000001', 'x-forwarded-for': '10.7.7.7' },
  }))
  assert.equal(res.status, 413)
})

test('verificación: límite de 5 por minuto por IP', async () => {
  for (let i = 0; i < 5; i++) {
    await verificacion(peticion('/api/kyc/verificacion', { wallet: 'x' }, '10.8.8.8'))
  }
  const res = await verificacion(peticion('/api/kyc/verificacion', { wallet: 'x' }, '10.8.8.8'))
  assert.equal(res.status, 429)
  assert.equal((await cuerpo(res)).motivo, 'demasiadas_solicitudes')
})

// ── Timeout, configuración y salud ──────────────────────────────────────────

test('timeout hacia los agentes → tiempo_agotado', async () => {
  responder = () => ({ estado: 200, cuerpo: {}, demora: 1500 })
  const cfg = proxy.leerConfig()!
  await assert.rejects(
    proxy.llamarAgentes(cfg, '/kyc/extract-document', new FormData(), 200, 'prueba'),
    (e: unknown) => e instanceof proxy.ErrorProxy && e.motivo === 'tiempo_agotado',
  )
})

test('sin AGENTS_URL o sin AGENTS_SHARED_SECRET → 503 y el log solo nombra variables', async () => {
  const url = process.env.AGENTS_URL
  delete process.env.AGENTS_SHARED_SECRET
  const antes = logs.length
  const res = await documento(peticion('/api/kyc/documento', { documento: JPEG() }))
  assert.equal(res.status, 503)
  assert.equal(recibidas.length, 0)
  const nuevo = logs.slice(antes).join('\n')
  assert.match(nuevo, /AGENTS_SHARED_SECRET/)
  assert.ok(!nuevo.includes(url!))
  process.env.AGENTS_SHARED_SECRET = SECRETO
})

test('salud: agentes activos → { disponible: true }', async () => {
  responder = () => ({ estado: 200, cuerpo: { status: 'ok', service: 'tokenids-agents', version: '1.0.0' } })
  const res = await saludGet()
  assert.equal(res.status, 200)
  assert.deepEqual(await cuerpo(res), { disponible: true })
  assert.equal(recibidas[0].ruta, '/health')
  assert.equal(recibidas[0].secreto, undefined, 'salud no debe enviar el secreto')
})

test('salud: agentes con error → 503 { disponible: false }', async () => {
  responder = () => ({ estado: 502, cuerpo: {} })
  const res = await saludGet()
  assert.equal(res.status, 503)
  assert.deepEqual(await cuerpo(res), { disponible: false })
})

test('documento: dos archivos con el mismo campo → 400', async () => {
  const f = new FormData()
  f.append('documento', new Blob([JPEG()]), 'a.jpg')
  f.append('documento', new Blob([JPEG()]), 'b.jpg')
  const res = await documento(new Request('https://x.test/api/kyc/documento', {
    method: 'POST', body: f, headers: { 'x-forwarded-for': '10.6.6.6' },
  }))
  assert.equal(res.status, 400)
  assert.equal(recibidas.length, 0)
})

test('los mensajes del proxy no contienen códigos internos', () => {
  for (const m of Object.values(proxy.MENSAJES).concat(Object.values(proxy.MENSAJES_DECISION))) {
    assert.doesNotMatch(m, /[A-Z]{2,}\d{3}|_|HTTP|\b[45]\d\d\b|AGENTS/)
  }
})
