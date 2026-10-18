// POST /api/kyc/verificacion — multipart con "documento", "selfie" y "wallet".
// 1. POST {AGENTS_URL}/kyc/full-pipeline (documento + selfie; wallet_address en la URL).
// 2. Solo si la decisión es APPROVED: POST /kyc/generate-passport desde el
//    servidor. El número de cédula y la fecha de nacimiento nunca llegan al
//    navegador. Ambas llamadas comparten el límite de 110 s.
// Cualquier valor desconocido o error se trata como "no aprobado".

import {
  ErrorProxy, LimitePorMinuto, MENSAJES_DECISION, TIMEOUT_AGENTES_MS, error, formulario,
  interpretarPipeline, ipCliente, json, leerConfig, leerMultipart, llamarAgentes, registrar,
  walletValida,
} from '../_lib/kyc-proxy.js'

const limite = new LimitePorMinuto(5)

export async function POST(req: Request): Promise<Response> {
  const inicio = Date.now()
  const espera = limite.intentar(ipCliente(req))
  if (espera) {
    registrar('kyc_verificacion', { estado: 429 })
    return error('demasiadas_solicitudes', { 'retry-after': String(espera) })
  }
  const cfg = leerConfig()
  if (!cfg) return error('servicio_no_disponible')
  try {
    const { imagenes, campos } = await leerMultipart(req, ['documento', 'selfie'], ['wallet'])
    const wallet = campos.get('wallet')
    if (!walletValida(wallet)) return error('wallet_invalida')

    const restante = () => TIMEOUT_AGENTES_MS - (Date.now() - inicio)
    const pipeline = interpretarPipeline(await llamarAgentes(
      cfg, `/kyc/full-pipeline?wallet_address=${encodeURIComponent(wallet)}`,
      formulario([
        { campo: 'document', imagen: imagenes.get('documento')!, base: 'documento' },
        { campo: 'selfie', imagen: imagenes.get('selfie')!, base: 'selfie' },
      ]),
      restante(), 'kyc_pipeline',
    ))

    if (pipeline.decision === 'MANUAL_REVIEW') {
      return json({ ok: true, decision: 'MANUAL_REVIEW', mensaje: MENSAJES_DECISION.MANUAL_REVIEW })
    }
    if (pipeline.decision === 'REJECTED') {
      return json({ ok: true, decision: 'REJECTED', mensaje: MENSAJES_DECISION[`REJECTED_${pipeline.causa}`] })
    }

    const passport = await llamarAgentes(cfg, '/kyc/generate-passport', {
      walletAddress: wallet,
      kycResult: { decision: 'APPROVED', ...pipeline.documento },
    }, restante(), 'kyc_pasaporte')
    if (typeof passport !== 'object' || passport === null) throw new ErrorProxy('error_procesamiento')
    return json({ ok: true, decision: 'APPROVED', passport })
  } catch (e) {
    if (e instanceof ErrorProxy) return error(e.motivo)
    registrar('kyc_verificacion', { estado: 500 })
    return error('error_procesamiento')
  }
}
