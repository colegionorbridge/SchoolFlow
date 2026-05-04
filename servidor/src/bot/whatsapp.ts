import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import { handleIncomingMessage } from './handler.js';

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './.wwebjs_auth'
    }),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', (qr) => {
    console.log('📱 [WhatsApp] Nuevo código QR. Escanealo para iniciar sesión:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ [WhatsApp] ¡Cliente conectado y listo!');
});

client.on('auth_failure', (msg) => {
    console.error('❌ [WhatsApp] Fallo de autenticación:', msg);
    console.log('🔄 [WhatsApp] Sesión inválida. Escaneá el nuevo QR.');
});

client.on('disconnected', (reason) => {
    console.log(`⚠️ [WhatsApp] Desconectado: ${reason}`);
});

// Timeout de seguridad: si en 30 segundos no hay QR ni ready, la sesión esta corrupta
let conectado = false;
setTimeout(() => {
    if (!conectado) {
        console.warn('⚠️ [WhatsApp] Timeout: no se pudo cargar la sesión en 30s. La sesión puede estar corrupta.');
        console.warn('⚠️ [WhatsApp] Ejecutá: sudo rm -rf .wwebjs_auth/* y reiniciá el contenedor.');
    }
}, 30000);

client.on('qr', () => { conectado = true; });
client.on('ready', () => { conectado = true; });

client.on('message', async (msg) => {
    console.log(`📩 Mensaje de ${msg.from}: ${msg.body}`);
    await handleIncomingMessage(msg);
});

export { client };