# Tareas - bot-norbridge

## 2026-09-04 — Bot no responde: Groq 429 OTPM (limit 1000)

### Síntoma

El bot dejó de responder el 4/9/2026. Recibía mensajes pero cada llamada a la IA fallaba y respondía el fallback genérico "tuve un error interno".

### Causa raíz

Groq empezó a aplicar un límite nuevo al plan gratuito (`on_demand`) para el modelo `qwen/qwen3.6-27b`: **OTPM (output tokens per minute) = 1000**. Como `groq.ts` **no setea `max_tokens`**, Groq estimaba ~1400-1600 tokens de salida por pedido (según el largo del historial) y rechazaba con:

```
429 rate_limit_exceeded — Request too large for model `qwen/qwen3.6-27b` ... on output tokens per minute (OTPM): Limit 1000, Requested 1411
```

El bot venía funcionando (1, 2 y 3 de sep sin errores). No hubo cambios de código (último cambio a `groq.ts`: 13-ago) ni de deploy (contenedor del 31-ago): fue un cambio de límites del lado de Groq. `bot-dgcatra` no se vio afectado porque sí setea `max_tokens: 30`.

### Fix aplicado

| Archivo | Cambio |
|---------|--------|
| `servidor/src/bot/groq.ts` | Agregado `max_tokens: 800` al body del fetch (por debajo del tope OTPM=1000, con margen). |

### Deploy

- Backend: `docker compose up --build -d chatbot` (rebuild, el contenedor corre desde `dist/`).
- Verificación: `docker logs -f bot-norbridge-server` — no deben aparecer más `OTPM`/`429`.

### Nota de decisión

- Se eligió `max_tokens: 800` para quedar por debajo del tope gratuito. Si en el futuro varios usuarios escriben a la vez y vuelve a rozar 1000 tokens de salida/min, la alternativa es subir a **Dev Tier** en Groq (sube el OTPM). Con 800 alcanza para el uso actual (respuestas JSON de ~300-400 tokens).

---

## 2026-08-31 — Desactivar usuario no funcionaba + loop infinito con otro bot + registro desde dashboard

### Problema

1. Un bot externo (número de Tuenti `5491122864999`, renombrado "TUENTI") le escribía al bot y quedaban en **loop infinito**: el bot respondía "❌ Selección inválida..." (atrapado en `pasoRegistro = 2` del registro) y el otro bot volvía a responder, sin parar. En 1h: 54 inbound / 55 outbound.
2. El admin desactivó al usuario desde el dashboard (`activo = false`) pero **el bot seguía respondiendo igual**.
3. Desde el dashboard no se podía marcar a un usuario como "Registro completo": aunque se cargaban todos los datos, seguía en "Pendiente".

### Causas raíz

- **`activo` nunca se leía**: el flag se guarda (dashboard → `PATCH /api/usuarios/:telefono`) pero `handleIncomingMessage` (`bot/handler.ts`) jamás lo consultaba. Desactivar no tenía efecto sobre las respuestas del bot.
- **Sin protección anti-loop**: no había ningún límite de respuestas por número; cada mensaje entrante (con `msgId` distinto) disparaba una respuesta nueva.
- **`registroCompleto` no se podía escribir**: `usuarios.controller.update` solo guardaba `nombreCompleto, email, roleId, activo` (+`esAdmin`) y sectores; nunca `registroCompleto` ni `pasoRegistro`.

### Fixes aplicados

| Archivo | Cambio |
|---------|--------|
| `servidor/src/bot/handler.ts` | Guard de `activo`: si `user.activo === false`, se ignora el mensaje por completo (`🚫 [Bloqueado]`). Guard de rate-limit: si `puedeResponder(telefono)` devuelve `false`, se ignora (no gasta tokens de Groq ni responde). |
| `servidor/src/bot/enviar.ts` | Nueva función `puedeResponder(telefono)`: cuenta respuestas por número en ventana de 60s (umbral `MAX_RESPUESTAS = 10`); al superarlo bloquea el número por `COOLDOWN_MS = 5 min`. Constantes configurables. |
| `servidor/src/controllers/usuarios.controller.ts` | `update` acepta `registroCompleto`. Si es `true`: setea `pasoRegistro = 7` y limpia `context.registro` / `context.rolPendienteId`. |
| `cliente/src/pages/admin/UsuariosPage.tsx` | Checkbox "Registro completo" en el modal de edición + se incluye `registroCompleto` en el PATCH. |

### Deploy

- Backend: `docker compose build chatbot && docker compose up -d chatbot` (el rebuild corta el loop al desplegar el guard de `activo`).
- Frontend: redeploy en Vercel (`school-flow-inky.vercel.app`).
- Verificación: logs deben mostrar `🚫 [Bloqueado] Mensaje de 5491122864999 ignorado` y `⏱️ [RateLimit] Bloqueado ...`.

---

## 2026-08-28 — Alucinación con "cancelar" + confirmaciones por palabra

### Fix "cancelar" sin alucinar (commit `dec6f93`)

El bot respondió "no se creó ningún ticket" cuando el ticket #211 sí se había creado. Causa: "cancelar" no lo capturaba ningún comando determinista y caía a Groq, que inventó el estado.

- [x] **`groq.ts` (prompt)**: reglas para intención "cancelar/interrumpir/cerrar" (`cancelar`, `anular`, `ya se arregló`, `solucionado`, `no lo necesito más`, etc.): 0 abiertos → "no tenés tickets abiertos"; 1 abierto → `CERRAR_TICKET` con ese id (dispara confirmación SI/NO ya existente); varios → pregunta cuál.
- [x] **`handler.ts` (confirmaciones)**: matcheo por **palabra** con `coincide()` (no más `.includes`, que hacía que "si" matcheara "sistema" y "no" matcheara "notebook").
  - `confirma`: `si, sí, confirmo, confirmar, dale, ok, perfecto, claro, de una, vamos, hagamoslo`.
  - `cancela`: `no, cancelo, cancelar, mejor no, no quiero, al final no, no gracias, dejalo, abortar, me arrepentí, ya esta, se arreglo, solucionado, resuelto, listo`.
- [x] **`helpers.ts`**: nueva función `coincide()` (boundary por palabra, ignora tildes y puntuación).
- [x] **`actions.ts`**: setea `ticketData.id` real al crear el ticket, para que el historial registre `Ticket #N creado exitosamente` con número (antes quedaba vacío).

### Nota de decisión

- Las frases "ya está / se arregló / solucionado / resuelto / listo" se tratan como **cancelar** (el usuario las usa para interrumpir: "no crees el ticket, ya se resolvió"). Por eso van en `cancela`, no en `confirma`.

---

## 2026-08-28 — Fix respuestas duplicadas + FK en historial + sesión 24h

### Fix respuestas duplicadas (commit `507d0e5`)

El bot respondía dos veces lo mismo. Causa raíz (confirmada en logs y DB):

- [x] **Mensajes vacíos**: `whatsapp.ts` ignora mensajes con `body` vacío (ecos, reacciones, indicadores) → antes cada uno disparaba una llamada a Groq y generaba respuestas duplicadas.
- [x] **`fromMe`**: se ignora el mensaje si `msg.fromMe` (evita responder a los propios mensajes del bot).
- [x] **Teléfono real vs LID**: `whatsapp.ts` resolvía el teléfono desde `msg.from` (LID `213223785636000`), distinto al `getContact().number` (`5491156243636`) que usa `handler.ts` → la FK de `conversaciones` fallaba y el historial de salida no se persistía. Ahora `whatsapp.ts` resuelve el teléfono real vía `getContact().number`.

### Sesión del dashboard de 24h

- [x] **`AuthContext.tsx`**: `INACTIVITY_TIMEOUT` 30 min → **24h** (alineado con la expiración del JWT).
- [x] **`cliente/src/api/client.ts`**: cualquier 401 redirige a `/login` (token expirado o usuario eliminado), no solo `eliminado`.

### Pendiente (documentado, no implementado)

- [ ] El primer mensaje de un usuario **nuevo** (aún no registrado) da FK en `conversaciones` porque `guardarMensaje` corre antes de que `manejarRegistro` cree la fila en `usuarios`. No se tocó para no romper el flujo de registro.

---

## 2026-08-24 — Asunto en los mensajes del bot

- [x] Todo mensaje que referencia un ticket ahora incluye el asunto (`*Ticket #N*: "asunto"`): notificaciones de estado (`tickets.controller`), mensajes de chat (`chat.controller`) y confirmaciones del bot (`actions.ts`, `commands.ts`).

---

## 2026-08-24 — Comentarios separados del historial

- [x] **Modelo `Ticket`**: agregado campo `comentarios` (JSON, `[{ fecha, autor, texto }]`).
- [x] **Backend**: `tickets.controller.update` (`nuevaNota` → `comentarios` + evento `"{autor} agregó un comentario"` en `historial`); `bot/actions.ts` (`AGREGAR_COMENTARIO` → `comentarios` + evento); `bot/commands.ts` ("ticket #N [comentario]" → `comentarios`; `/comentarios` y "ver comentarios del N" leen `comentarios`).
- [x] **Frontend `TicketDetail`**: 3 solapas — Historial (solo eventos) · Comentarios (texto completo + input) · Conversación (chat).
- Nota: tickets viejos **no migrados** (quedan con el historial mezclado como estaban; solo lo nuevo va limpio).

---

## 2026-08-24 — Fixes y mejoras post-deploy

- [x] **Historial de conversación**: al crear un ticket por WhatsApp, los mensajes recientes (`conversaciones` con `ticketId NULL`) se asocian al ticket en `bot/actions.ts` (`Conversacion.update`). Backfill manual del ticket #200 (7 mensajes).
- [x] **Sonidos**: copiados `ticket-creado.mp3` y `ticket-asignado.mp3` desde dgcatra a `cliente/public/sounds/`; `useSocket.ts` reproduce sonido en `nuevo-ticket` y `ticket-asignado`.
- [x] **Ticket manual**: botón "+ Nuevo ticket" en `TicketsList` con modal (asunto/descripción/ubicación/prioridad) → `POST /api/tickets` (`origen=manual`, `userTelefono=null`). Disponible para cualquier usuario autenticado.
- [x] **Loader chat**: spinner en "Tomar control" y "Devolver al bot" (`chatLoading`). `ConfirmButton` ahora acepta prop `loading`.

---

## 2026-08-21 — Paridad con bot-dgcatra (plan) + Backup de BD

> **Estado:** completado. Punto de retorno: commit checkpoint con tag `pre-paridad` en `main`.
>
> Objetivo: portar las mejoras de **bot-dgcatra** a este proyecto, manteniendo **intacta la IA** (Groq NLP multi-turno en `groq.ts`) y el **modelo de dominio** (roles/sectores, sin "bases"). `bot-dgcatra` NO se toca.

### Backup lógico de base de datos (realizado 2026-08-21)

Backup previo a cualquier cambio, guardado en `/home/tic/backups/norbridge/` (fuera del repo, NO commiteado):

- `norbridge-2026-08-21.dump` — formato binario `pg_dump -Fc -Z9` (restaurar con `pg_restore`)
- `norbridge-2026-08-21.sql` — SQL plano (`--clean --if-exists --no-owner`)

Estado al momento del backup: `usuarios` 71 · `tickets` 156 · `roles` 8 · `sectores` 4 · `usuarios_sectores` 62.

**Restaurar si hace falta:**
```bash
docker exec -i bot-norbridge-db pg_restore -U norbridge -d norbridge --clean --if-exists < /home/tic/backups/norbridge/norbridge-<fecha>.dump
```

### Checklist del plan (secciones A–F)

- [x] **A. Infraestructura/seguridad**: pino logger, helmet, express-rate-limit, graceful shutdown, reconexión del bot + estado/QR por socket + `/health/bot`, Socket.IO con JWT + blacklist, `config/index.ts` + `config/settings.ts`, endpoints `/api/settings`, credenciales DB externalizadas + `TZ`, README raíz (hecho). Commits `67e8ba8` + `ccb0de9`.
- [x] **B. Modelo de datos**: modelo `Conversacion`, `User.chatId`, `Ticket.tecnicoAsignado` + `Ticket.solucion`. Commit `3ade710`, tag `seccion-B`.
- [x] **C. Bot (anti-detección/resiliencia)**: cola FIFO por usuario (`encolar` en `whatsapp.ts`), `sendSeen()`, manejo multimedia, `enviar.ts` unificado (chatIdCache + fallback DB + timeout + iniciarTyping + rate-limit), `historial.ts` (persistir `Conversacion`), `helpers.ts`, `schemas.ts` (Zod) + tests vitest (7 tests). Commit `2f17873`, tag `seccion-C`.
  - Nota: `session.ts` (caché LRU) NO se implementó — norbridge ya hace 1 `findByPk` por mensaje y cachear `context` arriesgaría servir `historialConversacion` stale a la IA. Se documenta como decisión.
- [x] **D. Chat takeover**: `chat.controller` + `chat.routes` (iniciar/enviar/finalizar/estado), `context.chatConAdmin` en el bot (`handler.ts` forwardea mensajes al dashboard vía `chat-mensaje-entrante`), endpoint `GET /api/tickets/:id/conversacion`. Commit `ce27da2`, tag `seccion-D`.
- [x] **E. Controllers/routes/tickets**: dividir `dashboard.controller.ts` monolito en `auth` (OTP + código maestro + listarAdmins), `usuarios`, `roles`, `sectores`, `tickets`. Middleware admin/superAdmin + permisos (adoptar/cerrar/reasignar/derivar/reabrir). Paginación/búsqueda/orden server-side (`findAndCountAll`). Blacklist al eliminar usuario. Commit `15da874`, tag `seccion-E`.
- [x] **F. Frontend**: login OTP por WhatsApp + código maestro (AuthContext + LoginPage 6 dígitos), layout multipágina (sidebar), DashboardHome (stats por sector/usuarios), TicketsList con filtros, TicketDetail con chat takeover + historial (formato norbridge `{fecha, autor, nota}`), páginas admin (Roles, Sectores, Usuarios, Configuración), componentes `ConfirmButton`/`StatCard`/`NavItem`, `useSocket`. Commit `b4e3dd6`, tag `seccion-F`.

### Decisiones confirmadas

| Decisión | Opción elegida |
|----------|----------------|
| Login | Portar OTP + código maestro (multi-admin con superAdmin) |
| Frontend | Multipágina completo (sidebar + páginas) |
| Chat takeover | Sí, completo |
| Dominio admin | Mantener roles de norbridge (NO migrar a `Sector.isAdmin`) |

### Deploy y datos (2026-08-21)

- **Código maestro**: `MASTER_CODE=202428` (6 dígitos, porque el login de código maestro solo acepta 6 dígitos numéricos). Se cambia desde Configuración.
- **Backfill de tickets viejos**: los tickets `en_proceso` y `cerrado` previos quedan con `tecnicoAsignado='Admin'` (eran tomados por el admin). Los `abierto` quedan `NULL` ("—"). Comando (post-redeploy):
  ```sql
  UPDATE tickets SET "tecnicoAsignado"='Admin' WHERE estado IN ('en_proceso','cerrado') AND "tecnicoAsignado" IS NULL;
  ```
- **Deploy**: `git push origin main --tags` + `docker compose up --build -d` (servidor) + rebuild Vercel (frontend). `sequelize.sync({ alter: true })` agrega `conversaciones` y las columnas `chatId`/`tecnicoAsignado`/`solucion` sin tocar datos.

---

## 2026-08-14 — Fix pendientes colgados + limpiador de contexto

### Problema

Un usuario (Marcela Medina) tenía un `pendienteConfirmacion` colgado desde **mayo 2026** (3 meses). El pendiente no tenía campo `timestamp` (dato legacy de una versión vieja del código), por lo que el verificador nunca lo detectaba como vencido (`ahora - undefined = NaN`, y `NaN > 10min` es `false`).

### Fixes aplicados

| Archivo | Cambio |
|---------|--------|
| `servidor/src/bot/handler.ts` | `verificarPendientesVencidos()`: maneja pendiente sin `timestamp` (lo considera vencido). Agrega `TIMEOUT_INACTIVIDAD = 1h` y limpia `historialConversacion` + `pendienteConfirmacion` + `procesando` cuando el usuario lleva más de 1h sin hablar. |
| `servidor/src/bot/handler.ts` | En `handleIncomingMessage`: quitar guard `timestamp &&` — un pendiente sin timestamp se trata como expirado. |
| `servidor/src/bot/groq.ts` | Agregar `AbortController` con timeout de 20s al fetch de Groq (antes podía colgarse y dejar `procesando: true` bloqueando al bot). |

### Limpieza de datos

`UPDATE` en la DB: se limpió el `pendienteConfirmacion` y `historialConversacion` de `5491131652363` (Marcela Medina), dejando `pendienteConfirmacion: null` y `historialConversacion: []`.

### Resultado

El verificador periódico (cada 30s) ahora:
1. Limpia pendientes vencidos (timestamp viejo o faltante).
2. Reinicia la conversación de usuarios inactivos > 1h.

---

## 2026-08-13 — Migración de modelo IA (deprecación Groq)

Groq anunció la deprecación de `llama-3.3-70b-versatile` (shutdown 16/08/26). Se migró al reemplazo recomendado.

| Detalle | Valor |
|---------|-------|
| Archivo | `servidor/src/bot/groq.ts` |
| Modelo anterior | `llama-3.3-70b-versatile` |
| Modelo nuevo | `openai/gpt-oss-120b` |
| Costo | $0 (tier gratuito de Groq, Free Plan) |
| Función | `consultarGroq` (NLP completo: extraer asunto/descripcion/ubicacion/accion, JSON mode) |

Sin cambios de endpoint ni API key. Se verificó `tsc` y se rebuildeó Docker (`docker compose cp` + `npm run build` + `restart`).

> Nota: también deprecado `llama-3.1-8b-instant` (usado por bot-dgcatra), migrado a `openai/gpt-oss-20b`.

### Fix: rate limit por reasoning tokens

**Problema:** los GPT-OSS son *reasoning models*. Generan cientos de tokens de razonamiento interno (~385 por respuesta), que consumen el límite del free tier (8K tokens/min) y causaban `Error en Groq: Cannot read properties of undefined (reading '0')` (respuesta de error sin `choices`). El bot no creaba tickets.

**Solución:** se agregó `reasoning_effort: "low"` + `include_reasoning: false` al request. El reasoning bajó de ~385 a ~16 tokens.

```json
{
  "model": "openai/gpt-oss-120b",
  "response_format": { "type": "json_object" },
  "reasoning_effort": "low",
  "include_reasoning": false
}
```

También se agregó logging para capturar la respuesta cruda de Groq cuando `data.choices` viene undefined.

### Fix 2: json_validate_failed (respuesta no JSON)

**Problema:** con `reasoning_effort: "low"` el modelo no seguía el formato JSON (respondía texto conversacional) → Groq rechazaba con `json_validate_failed` y el bot respondía "error interno".

**Solución:**
- `reasoning_effort: "low"` → `"medium"` (mejor adherencia al JSON)
- Prompt reforzado: "SIEMPRE respondé ÚNICAMENTE JSON válido, incluso en saludos/cortesía → accion NINGUNA"
- Se corrigió el **encoding roto** del prompt (mojibake `Ã©`, `Â¿`, `ðŸ`, `â¬` → acentos/emojis correctos)

### Fix 3: loop multi-turno (reasoning model no apto)

**Problema:** con GPT-OSS-120B (reasoning model) el bot se quedaba en loop pidiendo sector/ubicación una y otra vez, sin combinar la información del historial para crear el ticket. Con Llama 3.3 70B (no-reasoning) esto funcionaba perfecto.

**Solución:** migrar a `qwen/qwen3.6-27b` con `reasoning_effort: "none"` (deshabilita razonamiento, se comporta como no-reasoning tipo Llama). Es la otra opción oficial recomendada por Groq. Sigue el JSON mode y el flujo multi-turno correctamente.

```js
model: "qwen/qwen3.6-27b",
temperature: 0.2,
response_format: { type: "json_object" },
reasoning_effort: "none"
```

---

## 2026-08-12 — Tickets manuales desde dashboard

### Feature

Botón "+ Nuevo Ticket" en el dashboard para registrar tickets que ingresan por otros canales (email, teléfono, en persona) y llevar un reporte unificado de todo el trabajo de IT.

### Cambios

| Capa | Archivo | Cambio |
|------|---------|--------|
| Modelo | `servidor/src/models/Ticket.ts` | Nuevo campo `origen` (ENUM: 'whatsapp' \| 'manual', default 'whatsapp'). `userTelefono` ahora nullable (tickets manuales no tienen FK a usuario). |
| Controller | `servidor/src/controllers/dashboard.controller.ts` | Nuevo `createTicket`: recibe asunto/descripcion/ubicacion/prioridad, crea con origen='manual' sin userTelefono, emite `nuevo-ticket` por Socket.IO, agrega nota en historial "Ticket creado manualmente desde el panel". |
| Ruta | `servidor/src/routes/dashboard.routes.ts` | `POST /api/tickets` → `createTicket` |
| Context | `cliente/src/context/DataContext.tsx` | Nueva función `crearTicketManual(datos)` + interface `Ticket` incluye `origen` |
| Dashboard | `cliente/src/components/Dashboard/Dashboard.tsx` | Botón "+ Nuevo Ticket" en header, modal con formulario (asunto, descripción, ubicación, prioridad), badge ✍ en tickets manuales en la tabla |
| CSS | `cliente/src/components/Dashboard/Dashboard.module.css` | Estilos `.newTicketButton`, `.manualBadge`, `.form`, `.formRow`, `.formLabel`, `.formInput`, `.formTextarea`, `.formSelect` |

### Migración

`sequelize.sync({ alter: true })` aplica la nueva columna automáticamente al reiniciar el servidor.

### Visual en tabla

- Tickets de WhatsApp: se muestran normales con nombre de usuario
- Tickets manuales: badge ✍ al lado del estado, solicitante "ADMIN / Carga manual" (userTelefono = NULL)

### Fixes post-deploy

| Commit | Fix |
|--------|-----|
| `9ca7d2b` | Badge ✍ solo cuando `origen === 'manual'` (antes `null` se mostraba como manual) |
| `acaefa2` | `updateTicket` saltea notificaciones WhatsApp cuando `userTelefono` es null. Solicitante "ADMIN" en tabla y modal. |

### Nota de deploy

`sequelize.sync({ alter: true })` NO quitó la constraint `NOT NULL` de `userTelefono` en la DB existente. Se aplicó manualmente:

```sql
ALTER TABLE tickets ALTER COLUMN "userTelefono" DROP NOT NULL;
```

Si se recrea la DB desde cero, el modelo ya trae `allowNull: true`, no hace falta.

---

## 2026-08-04 — Fix typing simulation + rate limit + análisis de colas

### Diagnóstico

La simulación de escritura usaba `msg.getChat() + chat.sendStateTyping()`, el cual internamente llama a `pupPage.evaluate()` con `window.WWebJS.getChat(chatId)` SIN `{ getAsModel: false }`. WhatsApp Web devuelve error CDP `"r"` durante la serialización del modelo Chat, haciendo que el typing nunca se muestre.

Las respuestas del bot usaban `msg.reply()` sin rate limit, permitiendo mensajes consecutivos muy rápidos detectables por el anti-bot de WhatsApp.

### Fix aplicado

| Archivo | Cambio |
|---|---|
| `servidor/src/bot/whatsapp.ts` | Monkey-patch en `msg.reply()`: reemplazado `getChat() + sendStateTyping()` por inyección directa de `WAWebChatStateBridge.sendChatStateComposing()` vía `(client as any).pupPage.evaluate(async callback)`. Mismo patrón que `sendMessage`. |
| `servidor/src/bot/whatsapp.ts` | Delay de typing proporcional a `texto.length * 12` + random 0-2s (antes era fijo 1-3s). |
| `servidor/src/bot/whatsapp.ts` | Rate limit 2s por usuario (`lastSend` Map). |
| `servidor/src/bot/whatsapp.ts` | `console.warn` en catch para diagnosticar fallos de typing. |

### Colas de mensajes y anti-detección

| Mecanismo | Estado |
|---|---|
| Cola FIFO inbound | **No implementada** — usa flag `procesando` en context con timeout 2 min |
| Rate limit outbound | 1 msg cada 2s por usuario |
| Deduplicación | `Set<string>` con TTL 15s |
| Typing simulation | Inyección directa `WAWebChatStateBridge.sendChatStateComposing()` |

### Flujo del typing

```
msg.reply(content)
  → client.pupPage.evaluate(async callback)
    → window.require('WAWebChatStateBridge').sendChatStateComposing(chatId)
  → delay = 1500 + text.length * 12 + random(0-2000) ms
  → rateLimitar(telefono) — espera 2s desde último envío
  → replyOriginal(content)
```

---

## Historial

### 2026-08-04 — Rate limit inicial

- [x] **Rate limit 2s por usuario**: `lastSend` Map en `whatsapp.ts`
- [x] **Delay proporcional**: `texto.length * 12` en vez de fijo 1-3s
- [x] **Logs de error**: `console.warn` en catch del typing

### Setup original

- WhatsApp bot con `whatsapp-web.js` v1.34.6 + Puppeteer
- Groq AI (Llama 3.3 70B) para NLP
- Express 5 + Socket.IO + PostgreSQL
- React 19 dashboard en `cliente/`
- Docker Compose con Chrome headless

---

## Backlog — Análisis IA de tickets por periodo (investigado, SIN implementar)

### Idea

Que la IA (Groq ya configurado) genere, a pedido del usuario/admin, un **análisis de los tickets en un rango de fechas dado**: qué tipo de reparaciones fueron más pedidas, qué sectores, tendencias y recomendaciones. Sirve para armar reportes de gestión.

### Investigación — qué usan los sistemas profesionales

| Sistema | Enfoque de análisis |
|---------|---------------------|
| **Zendesk Explore + Copilot** | Dashboards de KPIs + IA con "next best actions" y recomendaciones |
| **Freshdesk Analytics** | Reportes de categorías, SLA, tendencias por periodo |
| **Jira Service Management** | Dashboards + Assets + KB |
| **Tendencia actual (todos)** | **Analytics conversacional**: preguntar en lenguaje natural sobre los datos |

**Patrón común que todos adoptaron:** los números los calcula SQL (fuente de verdad), la IA solo interpreta, redacta y recomienda. Nunca se deja que el LLM invente cifras — se le dan los agregados exactos y se le pide el análisis narrativo.

### Decisiones tomadas (confirmadas por el usuario)

| Decisión | Opción elegida |
|----------|----------------|
| Canal | **Botón en el dashboard web** (no WhatsApp) |
| Categorización de "tipo de reparación" | **IA clasifica al vuelo** los asuntos (sin agregar campo a la DB) |
| Acceso | **Solo admin** |

### Arquitectura propuesta

1. Botón "Análisis IA" en el dashboard (panel Estadísticas o sección propia)
2. Input de rango de fechas (desde/hasta, o presets: "último mes", "último trimestre")
3. `POST /api/stats/analisis` con `{ fechaDesde, fechaHasta }`:
   - SQL agrega los números del periodo: total, por estado, por sector, por ubicación, top usuarios, manuales vs whatsapp, tiempo promedio de resolución
   - El LLM clasifica los `asunto` del periodo en categorías (proyector, wifi, PC, impresora...)
   - Groq recibe el JSON de agregados + categorías y devuelve: resumen ejecutivo, top reparaciones, sectores con más demanda, recomendaciones accionables
4. El dashboard muestra el informe (markdown/lista) en pantalla

### El gap real

El `asunto` es texto libre ("no anda el proyector"). No existe campo `categoria`. La IA lo clasifica al vuelo en el análisis (decisión tomada), con margen de error aceptable.

### Datos disponibles hoy

- `Ticket`: asunto, descripcion, ubicacion, estado (abierto/en_proceso/cerrado), prioridad (baja/media/alta), historial, origen (whatsapp/manual), userTelefono (nullable), createdAt, updatedAt
- `User`: telefono, nombreCompleto, esAdmin, roleId, sectores (M:N)
- Endpoints stats existentes: `/api/stats/resumen`, `/api/stats/por-sector`, `/api/stats/por-mes`, `/api/stats/usuarios-top`
- Groq: `servidor/src/bot/groq.ts` (modelo `llama-3.3-70b-versatile`, JSON mode)

### Archivos que se tocarían

| Capa | Archivo |
|------|---------|
| Controller | `servidor/src/controllers/stats.controller.ts` (nuevo `getAnalisisIA`) |
| Ruta | `servidor/src/routes/stats.routes.ts` (`POST /stats/analisis`) |
| IA | `servidor/src/bot/groq.ts` (nueva función de análisis, reutilizar cliente Groq) |
| Frontend | `cliente/src/components/Dashboard/StatsPanel.tsx` (botón + modal de resultado) |
| CSS | `cliente/src/components/Dashboard/StatsPanel.module.css` |

### Riesgos / consideraciones

- **Alucinación de números**: mitigar dando siempre los agregados SQL como contexto exacto, la IA solo redacta.
- **Tokens**: no mandar todos los tickets, solo asuntos + agregados.
- **Clasificación al vuelo**: margen de error en categorías; aceptable para reportes internos.
- **Auth admin**: validar `esAdmin` del JWT en el endpoint (hoy el middleware solo valida token).
