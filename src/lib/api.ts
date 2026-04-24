const BASE = import.meta.env.VITE_AGENTS_URL

export async function extractDocument(imageBase64: string) {
  const res = await fetch(`${BASE}/kyc/extract-document`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: imageBase64 })
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function compareFaces(doc64: string, selfie64: string) {
  const res = await fetch(`${BASE}/kyc/compare-faces`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ document_image: doc64, selfie_image: selfie64 })
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function fullPipeline(doc64: string, selfie64: string, walletAddress: string) {
  const res = await fetch(`${BASE}/kyc/full-pipeline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      document_image: doc64,
      selfie_image: selfie64,
      wallet_address: walletAddress
    })
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
