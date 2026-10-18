// GET /api/kyc/salud — despierta tokenids-agents (Render) y dice si responde.
// No expone versión, configuración ni detalles: solo { disponible }.

import { json, leerConfig, salud } from '../_lib/kyc-proxy.js'

export async function GET(): Promise<Response> {
  const cfg = leerConfig()
  if (!cfg) return json({ disponible: false }, 503)
  const disponible = await salud(cfg)
  return json({ disponible }, disponible ? 200 : 503)
}
