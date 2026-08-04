import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import { handleIncomingMessage } from './handler.js';

const client = new Client({
    authStrategy: new LocalAuth({
        // No le pases la ruta completa aquí si ya la manejas en Docker.
        // Deja que use la carpeta por defecto 'session'
        clientId: "bot-norbridge" 
    }),
  puppeteer: {
        headless: true,
        dumpio: true, // 👈 IMPORTANTE: Activá esto para ver errores ocultos de Chrome
        // Usa la variable de entorno CHROME_PATH, si no existe usa la ruta por defecto
        executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            // '--single-process', 👈 ELIMINADO: Causa tildes en versiones nuevas
        ],
    }
});
client.on('qr', (qr) => {
    conectado = true; // Evita que salte el timeout de advertencia
    console.log('📱 [WhatsApp] Nuevo código QR. Escanealo para iniciar sesión:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    conectado = true;
    console.log('✅ [WhatsApp] ¡Cliente conectado y listo!');
});
client.on('auth_failure', (msg) => {
    console.error('❌ [WhatsApp] Fallo de autenticación:', msg);
    console.log('🔄 [WhatsApp] Sesión inválida. Escaneá el nuevo QR.');
});

client.on('disconnected', (reason) => {
    console.log(`⚠️ [WhatsApp] Desconectado: ${reason}`);
});


// Timeout de seguridad: aumentado a 90 segundos para dar margen a Docker
let conectado = false;
setTimeout(() => {
    if (!conectado) {
        console.warn('⚠️ [WhatsApp] El bot está tardando más de lo esperado en iniciar...');
        console.warn('💡 Si ya escaneaste el QR antes, dale 1 minuto más. Si es la primera vez, espera al QR.');
        console.warn('💡 Si el problema persiste, verifica permisos con: sudo chown -R 1000:1000 .wwebjs_auth');
    }
}, 90000); // <-- Cambiado de 30000 a 90000 (90 segundos)

client.on('qr', () => { conectado = true; });
client.on('ready', () => { conectado = true; });

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
            console.warn('⚠️ [Typing] Error al simular escritura:', e?.message || e);
            const fallbackDelay = 1500 + Math.random() * 2000;
            await new Promise(r => setTimeout(r, fallbackDelay));
        }
        await rateLimitar(telefono);
        lastSend.set(telefono, Date.now());
        return replyOriginal(content);
    };

    console.log(`📩 Mensaje de ${msg.from}: ${msg.body}`);
    await handleIncomingMessage(msg);
});

function clientReady(): boolean {
    return conectado && !!client.info;
}

export { client, clientReady };