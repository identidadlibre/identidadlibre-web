# Política de independencia y cero cross-sell — IdentidadLibre

**Versión:** 1.0  
**Fecha:** Marzo 2026  
**Autora:** Johana Niño Abella  
**Repositorio:** github.com/identidadlibre  
**Commit inicial:** Este documento es vinculante desde el primer commit público.

---

## Declaración

IdentidadLibre es el Servicio 1 del ecosistema TokenIDS, desarrollado por Johana Niño Abella como TFM de maestría. La misma investigadora desarrolla **TokenIDS** (tokenids.co), una plataforma de tokenización de activos inmobiliarios (Servicio 2).

**Son servicios completamente independientes.**

Este documento formaliza, de manera pública y auditable, los compromisos de independencia operativa entre ambos servicios.

---

## Compromisos formales

### 1. Cero cross-sell hacia TokenIDS Servicio 2

Ningún elemento de `identidadlibre.org` dirigirá, enlazará, promocionará ni sugerirá el Servicio 2 (tokenización inmobiliaria, inversión en activos) dentro del flujo de experiencia del ciudadano. Esto incluye:

- Ningún enlace hacia tokenids.co en el flujo de onboarding (registro, KYC, SSI Passport)
- Ningún CTA (call-to-action) que dirija hacia inversión, tokenización o cualquier producto financiero
- Ningún mensaje de marketing cruzado en emails transaccionales del Servicio 1
- Ningún pixel de rastreo, cookie o mecanismo de retargeting que comparta datos entre los dos servicios

**Excepción explícita:** La sección "Sobre el proyecto" de identidadlibre.org nombra la existencia de TokenIDS con fines de transparencia hacia el ciudadano. Este es un acto de honestidad, no de promoción.

### 2. Separación de experiencia de usuario

El ciudadano que obtiene su SSI Passport en identidadlibre.org:

- Nunca necesita conocer la existencia del Servicio 2 para completar el proceso
- No recibirá comunicaciones sobre el Servicio 2 a menos que haya dado consentimiento explícito separado
- Puede usar su SSI Passport indefinidamente sin ninguna interacción con TokenIDS Servicio 2

### 3. Separación de datos

Los datos de usuarios de IdentidadLibre (Servicio 1) no se comparten con el sistema de usuarios de TokenIDS (Servicio 2) sin consentimiento explícito e informado del usuario para ese fin específico.

### 4. Separación de repositorios

El código fuente del Servicio 1 se mantiene en `github.com/identidadlibre`, separado del repositorio principal `github.com/Blockchain4-0/tokenids-platform`. Esta separación es técnica y simbólica: el ciudadano que audite el código de su identidad soberana no debe encontrarse con código de tokenización inmobiliaria.

---

## Proceso de auditoría

Esta política es verificable públicamente:

1. **Git history:** Cualquier cambio a este archivo queda registrado en el historial de commits con fecha y autoría.
2. **Issues públicos:** Si algún usuario detecta una violación de esta política, puede abrir un Issue en este repositorio.
3. **Revisión periódica:** Esta política se revisa con cada release mayor del sitio web.

---

## Modificaciones

Cualquier modificación a esta política:

1. Requiere un commit explícito con mensaje descriptivo
2. Se notifica a los usuarios registrados del Servicio 1 con al menos **30 días de anticipación**
3. Nunca puede aplicarse retroactivamente a usuarios que se registraron bajo la versión anterior

---

## Contexto técnico

| Elemento | Servicio 1 (IdentidadLibre) | Servicio 2 (TokenIDS) |
|---|---|---|
| Dominio | identidadlibre.org | tokenids.co |
| Repositorio | github.com/identidadlibre | github.com/Blockchain4-0/tokenids-platform |
| Contratos principales | TokenIDSDIDRegistry, AgeVerifier, KYCVerifier | TokenIDSAsset, IdentityRegistry, ComplianceManager |
| Público objetivo | Ciudadanos colombianos | Inversores inmobiliarios |
| Costo para usuario | Gratuito | Variable |
| Relación con dinero | Ninguna en el flujo del ciudadano | Tokenización de activos |

---

## Contacto

Para consultas sobre esta política: **johana.nino.abella@gmail.com**

---

*Este documento es público, versionado en Git y constituye un compromiso formal de la investigadora y fundadora hacia los usuarios de IdentidadLibre.*
