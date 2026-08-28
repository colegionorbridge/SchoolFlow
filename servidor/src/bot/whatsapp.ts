import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import { handleIncomingMessage } from './handler.js';
import { setBotConnected, setBotDisconnected, emitQR } from '../socket/server.js';
import { logger } from '../config/logger.js';
import { setClient, registrarChatId, simularEscritura, rateLimitar } from './enviar.js';
import { guardarMensaje } from './historial.js';
import { User } from '../models/models.js';

const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "bot-norbridge"
    }),
    puppeteer: {
        headless: true,
        dumpio: true, // 👈 IMPORTANTE: Activá esto para ver errores ocultos de Chrome
        executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
        ],
    }
});

setClient(client);

let reintentos = 0;
const MAX_REINTENTOS = 5;
const ESPERA_REINTENTO = 30_000;
let reconectando = false;

async function intentarReconectar() {
    if (reconectando) return;
    reconectando = true;

    while (reintentos < MAX_REINTENTOS) {
        reintentos++;
        logger.warn(`Intento de reconexión ${reintentos}/${MAX_REINTENTOS}`);
        await new Promise(r => setTimeout(r, ESPERA_REINTENTO));

        try {
            await client.initialize();
            return;
        } catch (e: any) {
            logger.warn({ err: e?.message }, `Reintento ${reintentos} falló`);
        }
    }

    logger.error('Se agotaron los reintentos. Se necesita escanear QR manualmente.');
    reconectando = false;
}

client.on('qr', (qr) => {
    logger.info('Nuevo QR generado');
    qrcode.generate(qr, { small: true });
    emitQR(qr);
    reconectando = false;
});

client.on('ready', () => {
    reintentos = 0;
    reconectando = false;
    const phone = client.info?.wid?._serialized?.split('@')[0] || 'Conectado';
    logger.info(`WhatsApp conectado (${phone})`);
    setBotConnected(phone);
});

client.on('auth_failure', (msg) => {
    logger.error({ err: msg }, 'Error de autenticación');
    setBotDisconnected();
    reintentos = MAX_REINTENTOS;
});

client.on('disconnected', (reason) => {
    logger.warn(`WhatsApp desconectado: ${reason}`);
    setBotDisconnected();
    intentarReconectar();
});

// Timeout de seguridad: aumentado a 90 segundos para dar margen a Docker
let conectado = false;
client.on('qr', () => { conectado = true; });
client.on('ready', () => { conectado = true; });

setTimeout(() => {
    if (!conectado) {
        logger.warn('El bot está tardando más de lo esperado en iniciar...');
        logger.warn('Si ya escaneaste el QR antes, dale 1 minuto más. Si es la primera vez, espera al QR.');
        logger.warn('Si el problema persiste, verifica permisos con: sudo chown -R 1000:1000 .wwebjs_auth');
    }
}, 90000);

// Cola FIFO por usuario: garantiza orden de procesamiento sin pisarse entre mensajes.
const colas = new Map<string, Promise<void>>();

function encolar(telefono: string, fn: () => Promise<void>): Promise<void> {
    const anterior = colas.get(telefono) || Promise.resolve();
    const tarea = anterior.then(() => fn()).catch(e => {
        logger.error({ err: e?.message || e }, `Error en cola de ${telefono}`);
    }).finally(() => {
        if (colas.get(telefono) === tarea) colas.delete(telefono);
    });
    colas.set(telefono, tarea);
    return tarea;
}

async function marcarComoLeido(msg: any) {
    try {
        const chat = await msg.getChat();
        await chat.sendSeen();
    } catch {}
}

async function procesarMensaje(msg: any, telefono: string) {
    await marcarComoLeido(msg);

    if (msg.hasMedia) {
        await msg.reply(
            '📎 Recibí tu archivo, pero todavía no puedo procesar imágenes ni audios.\n\n' +
            'Describí el problema por texto así puedo crear el ticket.\n\n' +
            'Escribí *cancelar* para salir.'
        );
        return;
    }

    await handleIncomingMessage(msg);
}

client.on('message', async (msg: any) => {
    if (msg.from === 'status@broadcast') return;
    if (msg.fromMe) return;

    const body = (msg.body || '').trim();
    // Ignorar mensajes vacíos (ecos, reacciones, indicadores) para no disparar
    // respuestas de IA duplicadas. Los mensajes con media se procesan aparte.
    if (!body && !msg.hasMedia) return;

    // Resolver el teléfono REAL (para @lid, getContact devuelve el número real,
    // no el LID) para mantener consistencia con handler.ts y la FK de conversaciones.
    let telefono = (String(msg.from).split('@')[0] ?? '').replace(/[^\d]/g, '');
    try {
        const contacto = await msg.getContact();
        if (contacto?.number) {
            telefono = contacto.number.startsWith('549') ? contacto.number : '549' + contacto.number;
        }
    } catch {}

    registrarChatId(telefono, String(msg.from));
    User.update({ chatId: String(msg.from) }, { where: { telefono } })
        .catch(e => logger.error({ err: e?.message }, 'update chatId'));

    const replyOriginal = msg.reply.bind(msg) as Function;
    msg.reply = async (content: any) => {
        const chatId = String(msg.from);
        const texto = typeof content === 'string' ? content : String(content || '');
        await simularEscritura(chatId, texto);
        await rateLimitar(telefono);
        await replyOriginal(content);
        guardarMensaje(telefono, texto, 'outbound');
    };

    logger.info(`📩 Mensaje de ${msg.from}: ${msg.body}`);
    encolar(telefono, () => procesarMensaje(msg, telefono));
});

function clientReady(): boolean {
    return conectado && !!client.info;
}

export { client, clientReady };
