// Solo para las pruebas: Node resuelve "./x.js" a "./x.ts" cuando el .js no
// existe (en Vercel, el código compilado sí tiene el .js).
import { register } from 'node:module'

register('data:text/javascript,' + encodeURIComponent(`
  export async function resolve(especificador, contexto, siguiente) {
    try {
      return await siguiente(especificador, contexto)
    } catch (e) {
      if (especificador.startsWith('.') && especificador.endsWith('.js')) {
        return siguiente(especificador.slice(0, -3) + '.ts', contexto)
      }
      throw e
    }
  }
`))
