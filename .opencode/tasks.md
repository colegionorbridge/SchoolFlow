# Tareas - bot-norbridge

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
