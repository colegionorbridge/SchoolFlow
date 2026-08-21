import 'dotenv/config';
import { createServer } from 'http';
import app from './app.js';
import { initSocket } from './socket/server.js';
import { sequelize } from './models/models.js';
import { client } from './bot/whatsapp.js';
import { iniciarVerificadorPendientes } from './bot/handler.js';
import { config } from './config/index.js';
import { initSettings } from './config/settings.js';
import { logger } from './config/logger.js';

initSettings();

const httpServer = createServer(app);

initSocket(httpServer);

async function bootstrap() {
    try {
        await sequelize.sync({ alter: true });
        logger.info('Base de datos sincronizada correctamente.');

        client.initialize();

        httpServer.listen(config.port, () => {
            logger.info('--------------------------------------------------');
            logger.info(`Servidor Norbridge listo en: http://localhost:${config.port}`);
            logger.info('--------------------------------------------------');
        });

        iniciarVerificadorPendientes();

    } catch (error) {
        logger.error({ err: error }, 'Error fatal al iniciar el servidor');
        process.exit(1);
    }
}

bootstrap();

// --- Graceful shutdown ---
async function shutdown(signal: string) {
    console.log(`\n🛑 [${signal}] Iniciando cierre ordenado...`);
    httpServer.close(() => console.log('  ✓ HTTP server cerrado'));
    try { await sequelize.close(); console.log('  ✓ DB cerrada'); } catch {}
    try {
        if (client) { await client.destroy(); console.log('  ✓ WhatsApp cerrado'); }
    } catch {}
    console.log('👋 Chau');
    process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
