import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import { handleIncomingMessage } from './handler.js';
import { setBotConnected, setBotDisconnected, emitQR } from '../socket/server.js';
import { logger } from '../config/logger.js';

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

const lastSend = new Map<string, number>();
const RATE_LIMIT_MS = 2000;

function rateLimitar(telefono: string): Promise<void> {
    const now = Date.now();
    const ultimo = lastSend.get(telefono) || 0;
    const espera = RATE_LIMIT_MS - (now - ultimo);
    if (espera > 0) {
        return new Promise(r => setTimeout(r, espera));
    }
    return Promise.resolve();
}

client.on('message', async (msg: any) => {
    const telefono = (String(msg.from).split('@')[0] ?? '').replace(/[^\d]/g, '');
    const replyOriginal = msg.reply.bind(msg) as Function;
    msg.reply = async (content: any) => {
        const chatId = String(msg.from);
        try {
            await (client as any).pupPage.evaluate(async (id: string) => {
                const WidFactory = window.require('WAWebWidFactory');
                const ChatState = window.require('WAWebChatStateBridge');
                await ChatState.sendChatStateComposing(WidFactory.createWid(id));
            }, chatId);
            const texto = typeof content === 'string' ? content : String(content || '');
            const typingDelay = 1500 + texto.length * 12 + Math.random() * 2000;
            await new Promise(r => setTimeout(r, typingDelay));
        } catch (e: any) {
            logger.warn({ err: e?.message }, 'Error al simular escritura');
            const fallbackDelay = 1500 + Math.random() * 2000;
            await new Promise(r => setTimeout(r, fallbackDelay));
        }
        await rateLimitar(telefono);
        lastSend.set(telefono, Date.now());
        return replyOriginal(content);
    };

    logger.info(`📩 Mensaje de ${msg.from}: ${msg.body}`);
    await handleIncomingMessage(msg);
});

function clientReady(): boolean {
    return conectado && !!client.info;
}

export { client, clientReady };
