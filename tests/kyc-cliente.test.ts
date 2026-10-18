import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ERRORES, FalloKyc, errorDesdeRespuesta, interpretarVerificacion } from '../src/lib/api.ts'
import { dimensionesObjetivo } from '../src/lib/imagen.ts'

test('dimensionesObjetivo: reduce al lado máximo sin deformar ni agrandar', () => {
  assert.deepEqual(dimensionesObjetivo(4000, 3000), { ancho: 1600, alto: 1200 })
  assert.deepEqual(dimensionesObjetivo(3000, 4000), { ancho: 1200, alto: 1600 })
  assert.deepEqual(dimensionesObjetivo(800, 600), { ancho: 800, alto: 600 })
  assert.throws(() => dimensionesObjetivo(0, 100))
})

test('interpretarVerificacion: solo tres respuestas válidas; lo demás falla cerrado', () => {
  assert.equal(interpretarVerificacion({ ok: true, decision: 'APPROVED', passport: { a: 1 } }).decision, 'APPROVED')
  assert.equal(interpretarVerificacion({ ok: true, decision: 'MANUAL_REVIEW', mensaje: 'x' }).decision, 'MANUAL_REVIEW')
  assert.equal(interpretarVerificacion({ ok: true, decision: 'REJECTED', mensaje: 'x' }).decision, 'REJECTED')
  for (const malo of [
    null, {}, { ok: true, decision: 'APPROVED' }, { ok: false, decision: 'APPROVED', passport: {} },
    { ok: true, decision: 'CLEAR', mensaje: 'x' }, { ok: true, decision: 'UNVERIFIED', mensaje: 'x' },
  ]) {
    assert.throws(() => interpretarVerificacion(malo), FalloKyc)
  }
})

test('errorDesdeRespuesta: usa el mensaje del proxy y nunca muestra el código interno', () => {
  const e = errorDesdeRespuesta({ ok: false, motivo: 'imagen_grande', mensaje: 'La imagen es demasiado pesada.' })
  assert.equal(e.titulo, 'La imagen es demasiado pesada')
  assert.ok(!e.titulo.includes('imagen_grande') && !e.detalle.includes('imagen_grande'))
  assert.deepEqual(errorDesdeRespuesta({ motivo: 'desconocido', mensaje: 'x' }), ERRORES.inesperado)
  assert.deepEqual(errorDesdeRespuesta('<html>502</html>'), ERRORES.inesperado)
})

test('los textos de error del cliente no contienen códigos internos', () => {
  for (const { titulo, detalle } of Object.values(ERRORES)) {
    assert.doesNotMatch(titulo + detalle, /[A-Z]{2,}\d{3}|_|HTTP|\b[45]\d\d\b/)
  }
})
