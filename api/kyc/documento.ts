// POST /api/kyc/documento — multipart con el campo "documento" (foto de la cédula).
// Reenvía a POST {AGENTS_URL}/kyc/extract-document (campo "file") con
// X-Agents-Secret. Devuelve solo { ok, legible }: ningún dato personal.

import {
  ErrorProxy, LimitePorMinuto, TIMEOUT_AGENTES_MS, error, formulario, ipCliente, json,
  leerConfig, leerMultipart, llamarAgentes, registrar, resumenDocumento,
} from '../_lib/kyc-proxy.js'

const limite = new LimitePorMinuto(10)

export async function POST(req: Request): Promise<Response> {
  const espera = limite.intentar(ipCliente(req))
  if (espera) {
    registrar('kyc_documento', { estado: 429 })
    return error('demasiadas_solicitudes', { 'retry-after': String(espera) })
  }
  const cfg = leerConfig()
  if (!cfg) return error('servicio_no_disponible')
  try {
    const { imagenes } = await leerMultipart(req, ['documento'])
    const documento = imagenes.get('documento')!
    const datos = await llamarAgentes(
      cfg, '/kyc/extract-document',
      formulario([{ campo: 'file', imagen: documento, base: 'documento' }]),
      TIMEOUT_AGENTES_MS, 'kyc_documento',
    )
    return json(resumenDocumento(datos))
  } catch (e) {
    if (e instanceof ErrorProxy) return error(e.motivo)
    registrar('kyc_documento', { estado: 500 })
    return error('error_procesamiento')
  }
}
