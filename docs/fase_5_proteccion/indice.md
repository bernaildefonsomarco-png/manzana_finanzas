# Fase 5 Proteccion - Confianza, Privacidad Y Riesgo

**Pregunta central:** Como protegemos al usuario sin bajar la calidad de Manzana?  
**Estado:** V1.7 - Base inicial completa; sincronizada con paquete publico Meta  
**Ultima actualizacion:** 10 de junio, 2026  

---

## 1. Proposito

Fase 5 existe para que Manzana no llegue a implementacion con una arquitectura fuerte pero una proteccion improvisada.

Manzana maneja:

- dinero,
- habitos,
- deudas,
- personas relacionadas,
- emails financieros,
- conversaciones por WhatsApp,
- trazas de IA,
- nudges,
- insights,
- preferencias sensibles.

La proteccion no debe sentirse como friccion innecesaria. Debe sentirse como confianza, control y calma.

---

## 2. Documentos De Fase 5

| Archivo | Tema | Estado | Proposito |
|---|---|---|---|
| `indice.md` | Indice de Fase 5 | V1.7 | Ordena proteccion, privacidad, costos, legal, GTM, Fase 6 visual V1 y paquete publico Meta. |
| `24_privacidad_proteccion_datos.md` | Privacidad y proteccion de datos | V1.0 | Define datos, consentimiento, retencion, eliminacion, seguridad, canales, IA y calidad de experiencia. |
| `25_unit_economics_costos.md` | Unit economics y costos de calidad | V1.0 | Define como medir y gobernar costos sin bajar calidad: WhatsApp, IA, email, infra, soporte y outcomes. |
| `26_gtm_lanzamiento_v1_primeros_usuarios.md` | GTM lanzamiento V1 directo y primeros usuarios | V1.1 | Define posicionamiento, segmentos, canales, lanzamiento V1 directo, feedback, metricas y criterios para abrir usuarios. |
| `27_legal_operativo_v1.md` | Legal operativo V1 | V1.2 | Define politicas publicas, terminos, disclaimers, soporte, incidentes, paquete publico Meta y revision legal externa. |

---

## 3. Principio Rector

```text
Privacidad no debe bajar calidad.
Debe permitir una experiencia mas confiable, personal y tranquila.
```

Esto significa:

- pedir permisos en contexto, no en bloque;
- explicar con palabras humanas;
- ocultar lo sensible cuando el contexto lo pide;
- mantener respuestas utiles aun con datos minimizados;
- dar control al usuario sin obligarlo a entender arquitectura;
- no usar datos financieros para publicidad, scoring crediticio o ventas a terceros;
- proteger trazas y prompts como datos sensibles, no como logs cualquiera.

---

## 4. Relacion Con Fases Anteriores

| Fase | Relacion |
|---|---|
| Fase 2 | Define features y reglas de producto. |
| Fase 3 | Define como se siente la confianza. |
| Fase 4 | Define arquitectura tecnica, Core, RLS, outbox, ToolGateway, adapters y plan de implementacion. |
| Fase 5 | Define proteccion, consentimiento, retencion, derechos, riesgos, costos sostenibles y operacion responsable. |
| Fase 6 visual V1 | Define como la confianza, privacidad, estados sensibles y modo discreto se ven en la interfaz. |

Nota:

```text
Fase 4 incluye `24_paquete_identidad_meta.md` y rutas publicas minimas
para verificacion operativa de Meta. Fase 5 sigue siendo la fuente del
criterio legal completo para lanzamiento publico.
```

---

## 5. Criterio De Cierre De Fase 5

Fase 5 queda lista cuando Manzana pueda responder sin improvisar:

- Que datos guarda?
- Que datos no guarda?
- Para que usa cada dato?
- Como pide consentimiento?
- Como se desconecta Gmail?
- Como se maneja WhatsApp?
- Que logs se guardan y que se redacta?
- Que puede ver soporte humano?
- Como se exportan/eliminan datos?
- Que pasa ante incidente?
- Que costos por usuario hacen viable la calidad del producto?
- Como se lanzan primeros usuarios sin exponer confianza?
- Que politicas y terminos hacen falta antes del lanzamiento V1 publico?
- Que disclaimers deben existir?
- Como se responde ante incidentes?

Nota:

```text
Fase 5 queda completa como base documental inicial.
No reemplaza revision legal externa antes de lanzamiento publico, cobro o escala.
```

---

## 6. Resumen

Fase 5 protege la confianza ganada por el producto.

No debe convertir Manzana en una app fria, defensiva o legalista. Debe ayudar a que el usuario sienta:

```text
Esto me entiende.
Esto me cuida.
Esto no va a usar mi dinero contra mi.
```

Fase 6 traduce parte de esa confianza en color, jerarquia, estados, modo discreto y calidad visual.

*Fase 5 Proteccion - Indice V1.7*
