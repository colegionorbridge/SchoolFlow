import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
// IMPORTANTE: Importamos el handler que creaste
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

// EVENTO ACTUALIZADO: Ahora usamos el handler para procesar TODO
client.on('message', async (msg) => {
    console.log(`📩 Mensaje de ${msg.from}: ${msg.body}`);
    
    // Aquí es donde sucede la magia: el handler busca en la DB
    await handleIncomingMessage(msg);
});

export { client };