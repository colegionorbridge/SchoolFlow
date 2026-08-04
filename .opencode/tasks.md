# Tareas - bot-norbridge

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
