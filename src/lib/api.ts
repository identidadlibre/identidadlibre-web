// src/lib/api.ts — v2 con warm-up detection para Render free tier
// Bloque H: detecta el spin-up de ~50s y notifica el progreso

const BASE = import.meta.env.VITE_AGENTS_URL

// Timeout generoso: 90s para dar margen al spin-up de Render (~50s) + tiempo real de IA
const TIMEOUT_MS = 90_000

async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(id)
    return res
  } catch (err: any) {
    clearTimeout(id)
    if (err.name === 'AbortError') {
      throw new Error('timeout')
    }
    throw err
  }
}

/** Warm-up: llama /health primero para despertar Render antes del pipeline real */
export async function warmUp(
  onProgress?: (seconds: number) => void
): Promise<boolean> {
  const start = Date.now()

  return new Promise(resolve => {
    let attempts = 0
    const MAX = 20 // 20 × 3s = 60s máx

    const tick = setInterval(async () => {
      attempts++
      const elapsed = Math.round((Date.now() - start) / 1000)
      onProgress?.(elapsed)

      try {
        const res = await fetch(`${BASE}/health`, {
          signal: AbortSignal.timeout(4000),
        })
        if (res.ok) {
          clearInterval(tick)
          resolve(true)
        }
      } catch {
        // sigue intentando
      }

      if (attempts >= MAX) {
        clearInterval(tick)
        resolve(false) // falló el warm-up pero dejamos intentar igual
      }
    }, 3000)

    // Primer intento inmediato
    fetch(`${BASE}/health`, { signal: AbortSignal.timeout(4000) })
      .then(r => {
        if (r.ok) { clearInterval(tick); resolve(true) }
      })
      .catch(() => {})
  })
}

export async function extractDocument(imageBase64: string) {
  const res = await fetchWithTimeout(`${BASE}/kyc/extract-document`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: imageBase64 }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function compareFaces(doc64: string, selfie64: string) {
  const res = await fetchWithTimeout(`${BASE}/kyc/compare-faces`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ document_image: doc64, selfie_image: selfie64 }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function fullPipeline(
  doc64: string,
  selfie64: string,
  walletAddress: string
) {
  const res = await fetchWithTimeout(`${BASE}/kyc/full-pipeline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      document_image: doc64,
      selfie_image: selfie64,
      wallet_address: walletAddress,
    }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
