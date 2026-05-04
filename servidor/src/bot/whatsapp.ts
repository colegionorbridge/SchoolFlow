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

client.on('message', async (msg) => {
    console.log(`📩 Mensaje de ${msg.from}: ${msg.body}`);
    await handleIncomingMessage(msg);
});

export { client };