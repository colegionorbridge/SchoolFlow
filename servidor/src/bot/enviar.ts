import type { Client } from 'whatsapp-web.js';
import { User } from '../models/models.js';
import { guardarMensaje } from './historial.js';
import { logger } from '../config/logger.js';

let _client: Client | null = null;
let _ready = false;

const chatIdCache = new Map<string, string>();
const lastSend = new Map<string, number>();
const RATE_LIMIT_MS = 2000;

export function setClient(c: Client) {
  _client = c;
  c.on('ready', () => { _ready = true; });
}

export function registrarChatId(numeroLimpio: string, chatId: string) {
  chatIdCache.set(numeroLimpio, chatId);
}

async function resolverChatId(telefono: string): Promise<string> {
  if (chatIdCache.has(telefono)) return chatIdCache.get(telefono)!;
  const num = telefono.replace(/[^\d]/g, '');
  if (chatIdCache.has(num)) return chatIdCache.get(num)!;
  const user = await User.findByPk(num, { attributes: ['chatId'] });
  if (user?.chatId) {
    chatIdCache.set(num, user.chatId);
    return user.chatId;
  }
  return `${num}@c.us`;
}

async function esperarCliente(): Promise<Client> {
  if (_ready && _client) return _client;
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = setInterval(() => {
      if (_ready && _client) { clearInterval(check); resolve(_client); }
      else if (Date.now() - start > 15000) { clearInterval(check); reject(new Error('Timeout esperando cliente WhatsApp')); }
    }, 500);
  });
}

export async function simularEscritura(chatId: string, texto: string): Promise<void> {
  try {
    const client = await esperarCliente();
    await (client as any).pupPage.evaluate(async (id: string) => {
      const WidFactory = window.require('WAWebWidFactory');
      const ChatState = window.require('WAWebChatStateBridge');
      await ChatState.sendChatStateComposing(WidFactory.createWid(id));
    }, chatId);
    const delay = 1500 + texto.length * 12 + Math.random() * 2000;
    await new Promise(r => setTimeout(r, delay));
  } catch (e: any) {
    logger.warn({ err: e?.message }, 'Error al simular escritura');
    const delay = 1500 + Math.random() * 2000;
    await new Promise(r => setTimeout(r, delay));
  }
}

export async function iniciarTyping(telefono: string): Promise<void> {
  try {
    const chatId = await resolverChatId(telefono);
    const client = await esperarCliente();
    await (client as any).pupPage.evaluate(async (id: string) => {
      const WidFactory = window.require('WAWebWidFactory');
      const ChatState = window.require('WAWebChatStateBridge');
      await ChatState.sendChatStateComposing(WidFactory.createWid(id));
    }, chatId);
  } catch {}
}

export async function rateLimitar(telefono: string): Promise<void> {
  const now = Date.now();
  const ultimo = lastSend.get(telefono) || 0;
  const espera = RATE_LIMIT_MS - (now - ultimo);
  if (espera > 0) {
    await new Promise(r => setTimeout(r, espera));
  }
  lastSend.set(telefono, Date.now());
}

// --- Protección anti-loop: limita respuestas por número ---
const VENTANA_MS = 60_000;          // ventana de 60 segundos
const MAX_RESPUESTAS = 10;          // máx. respuestas por ventana
const COOLDOWN_MS = 5 * 60 * 1000;  // 5 min de silencio tras superar el umbral

const enviosRecientes = new Map<string, number[]>();
const bloqueadosHasta = new Map<string, number>();

export function puedeResponder(telefono: string): boolean {
  const ahora = Date.now();
  const hasta = bloqueadosHasta.get(telefono);

  if (hasta && ahora < hasta) return false;
  if (hasta && ahora >= hasta) bloqueadosHasta.delete(telefono);

  const lista = (enviosRecientes.get(telefono) || []).filter(t => ahora - t < VENTANA_MS);
  if (lista.length >= MAX_RESPUESTAS) {
    bloqueadosHasta.set(telefono, ahora + COOLDOWN_MS);
    enviosRecientes.delete(telefono);
    logger.warn(`⏱️ [RateLimit] Bloqueado ${telefono} por ${COOLDOWN_MS / 60000} min (${MAX_RESPUESTAS} respuestas en 60s).`);
    return false;
  }

  lista.push(ahora);
  enviosRecientes.set(telefono, lista);
  return true;
}

export async function enviarTexto(to: string, texto: string, ticketId?: number | null): Promise<boolean> {
  try {
    const chatId = await resolverChatId(to);
    await simularEscritura(chatId, texto);

    const client = await esperarCliente();
    await rateLimitar(to);
    await client.sendMessage(chatId, texto);

    guardarMensaje(to, texto, 'outbound', ticketId);
    return true;
  } catch (e) {
    logger.error({ err: e }, 'Error enviando texto');
    return false;
  }
}
