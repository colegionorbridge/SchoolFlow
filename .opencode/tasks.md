# Tareas - bot-norbridge

## 2026-08-21 — Paridad con bot-dgcatra (plan) + Backup de BD

> **Estado:** planificado. Punto de retorno: commit checkpoint con tag `pre-paridad` en `main`.
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
