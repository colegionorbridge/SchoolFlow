import { createServer } from 'http';
import app from './app.js';
import { initSocket } from './socket/server.js';
import { sequelize } from './models/models.js';
import { client } from './bot/whatsapp.js'; // <-- 1. Importar el cliente

const httpServer = createServer(app);
const PORT = process.env.PORT || 4001;

initSocket(httpServer);

async function bootstrap() {
    try {
        await sequelize.sync({ alter: true });
        console.log('✅ Base de datos sincronizada correctamente.');

        // 2. Inicializar WhatsApp
        client.initialize(); 

        httpServer.listen(PORT, () => {
            console.log('--------------------------------------------------');
            console.log(`🚀 Servidor Norbridge listo en: http://localhost:${PORT}`);
            console.log('--------------------------------------------------');
        });

    } catch (error) {
        console.error('❌ Error fatal al iniciar el servidor:', error);
        process.exit(1);
    }
}

bootstrap();