# Aviso — `docs/` queda congelado como referencia histórica

**Fecha de congelamiento:** 25 de julio de 2026.

---

## Qué significa esto

Los 54 documentos de esta carpeta (`docs/fase_1_identidad/` a `docs/fase_6_visual/`,
más las dos auditorías de `docs/fase_4_tecnica/`) **dejan de editarse a partir de
hoy**. Ninguno de ellos se corrige, se actualiza ni se marca como obsoleto
línea por línea.

No es que este trabajo esté mal. Es que el proyecto se reestructura: la
aplicación web se separa de WhatsApp y se documenta de nuevo, con un alcance
más ambicioso y sin la premisa de que el Dashboard es una capa subordinada a
la conversación. El detalle de por qué está en
`documentacion/app_web/01_producto/06_tesis_app_web.md` y en
`documentacion/app_web/00_gobierno/03_decisiones_producto_web.md`.

## Dónde vive la verdad ahora

**`documentacion/app_web/`** es el corpus activo para todo lo relacionado con
la aplicación web. Cualquier decisión sobre qué se conserva, qué se reescribe
y qué se descarta de estos 54 documentos está en:

```
documentacion/app_web/00_gobierno/02_mapa_herencia_corpus_legacy.md
```

Ese mapa es el único lugar autorizado para decidir si algo de `docs/` se
reutiliza. Si un documento nuevo necesita una fórmula, una regla o un dato de
`docs/`, cita la ruta exacta — no copia sin verificar contra el mapa.

## Qué NO se congela

- **El código** (`src/`, `supabase/`) sigue vivo y se sigue modificando.
- El ledger `docs/fase_4_tecnica/23b_seguimiento_construccion_v1.md` queda
  como registro histórico hasta el 23 de julio de 2026; su sucesor vivo es
  `documentacion/app_web/07_calidad_y_ejecucion/55_ledger_construccion_web.md`.

## Cuándo se descongela

Cuando se abra la fase 2 (WhatsApp como canal conversacional completo), nace
`documentacion/whatsapp/` como corpus hermano de `documentacion/app_web/`.
En ese momento se revisan los documentos de `docs/` marcados como
**CONGELAR-WHATSAPP** en el mapa de herencia y se deciden sus sucesores.
Hasta entonces, se leen solo como contexto histórico, nunca como fuente de
verdad activa.
