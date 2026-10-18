// src/lib/imagen.ts — compresión en el navegador antes de enviar (tarea 1.5).
// El proxy acepta 1,5 MB por imagen y 4 MB en total; aquí se apunta a ~1 MB.

export const LADO_MAXIMO = 1600
export const BYTES_OBJETIVO = 1_000_000
const CALIDADES = [0.85, 0.75, 0.65, 0.55, 0.45]

/** Dimensiones que caben en un cuadrado de `max` px sin deformar ni agrandar. */
export function dimensionesObjetivo(ancho: number, alto: number, max = LADO_MAXIMO): { ancho: number; alto: number } {
  if (!(ancho > 0 && alto > 0)) throw new Error('dimensiones inválidas')
  const escala = Math.min(1, max / Math.max(ancho, alto))
  return { ancho: Math.max(1, Math.round(ancho * escala)), alto: Math.max(1, Math.round(alto * escala)) }
}

/** Redimensiona y convierte a JPEG; baja la calidad hasta quedar bajo el objetivo. */
export async function comprimirImagen(archivo: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(archivo, { imageOrientation: 'from-image' })
  try {
    const { ancho, alto } = dimensionesObjetivo(bitmap.width, bitmap.height)
    const lienzo = document.createElement('canvas')
    lienzo.width = ancho
    lienzo.height = alto
    const ctx = lienzo.getContext('2d')
    if (!ctx) throw new Error('canvas no disponible')
    ctx.drawImage(bitmap, 0, 0, ancho, alto)
    let ultimo: Blob | null = null
    for (const calidad of CALIDADES) {
      ultimo = await new Promise<Blob | null>(r => lienzo.toBlob(r, 'image/jpeg', calidad))
      if (ultimo && ultimo.size <= BYTES_OBJETIVO) return ultimo
    }
    if (!ultimo) throw new Error('no se pudo comprimir')
    return ultimo
  } finally {
    bitmap.close()
  }
}
