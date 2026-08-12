# Tareas - bot-norbridge

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
- Tickets manuales: badge ✍ al lado del estado, sin nombre de solicitante (userTelefono = NULL)

---

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
