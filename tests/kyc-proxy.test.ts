import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LimitePorMinuto, tipoPorFirma, walletValida, interpretarPipeline, ErrorProxy, ipCliente } from '../api/_lib/kyc-proxy.ts'

test('tipoPorFirma: JPEG y PNG por bytes; el resto se rechaza', () => {
  assert.equal(tipoPorFirma(new Uint8Array([0xff, 0xd8, 0xff, 0xdb])), 'image/jpeg')
  assert.equal(tipoPorFirma(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'image/png')
  assert.equal(tipoPorFirma(new TextEncoder().encode('GIF89a')), null)
  assert.equal(tipoPorFirma(new TextEncoder().encode('RIFF....WEBP')), null)
  assert.equal(tipoPorFirma(new Uint8Array([0xff, 0xd8])), null)
})

test('LimitePorMinuto: ventana deslizante por clave', () => {
  const l = new LimitePorMinuto(2, 60_000)
  assert.equal(l.intentar('a', 0), 0)
  assert.equal(l.intentar('a', 1_000), 0)
  assert.equal(l.intentar('a', 2_000), 58)
  assert.equal(l.intentar('b', 2_000), 0)
  assert.equal(l.intentar('a', 60_001), 0)
})

test('LimitePorMinuto: memoria acotada', () => {
  const l = new LimitePorMinuto(1, 60_000, 3)
  for (const k of ['a', 'b', 'c', 'd']) l.intentar(k, 0)
  assert.equal(l.intentar('a', 1), 0, 'la clave más antigua se descartó')
})

test('walletValida', () => {
  assert.ok(walletValida('0x' + 'aB'.repeat(20)))
  assert.ok(!walletValida('0x' + 'a'.repeat(39)))
  assert.ok(!walletValida(undefined))
  assert.ok(!walletValida('0x' + 'g'.repeat(40)))
})

test('interpretarPipeline: solo APPROVED, MANUAL_REVIEW y REJECTED; lo demás falla cerrado', () => {
  for (const v of [null, [], 'APPROVED', { pipeline_decision: 'approved' }, { pipeline_decision: undefined }]) {
    assert.throws(() => interpretarPipeline(v), ErrorProxy)
  }
  assert.deepEqual(interpretarPipeline({ pipeline_decision: 'MANUAL_REVIEW' }), { decision: 'MANUAL_REVIEW' })
})

test('ipCliente usa el primer valor de x-forwarded-for', () => {
  const r = new Request('https://x.test', { headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } })
  assert.equal(ipCliente(r), '1.2.3.4')
})
