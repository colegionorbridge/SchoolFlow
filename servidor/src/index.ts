import { createServer } from 'http';
import app from './app.js';
import { initSocket } from './socket/server.js';
import { sequelize } from './models/models.js';

/**
 * INICIALIZACIÓN DE SERVIDORES
 */
const httpServer = createServer(app);
const PORT = process.env.PORT || 4001;

// Inicializamos los Sockets pasándole el servidor HTTP
initSocket(httpServer);

/**
 * ARRANQUE DEL SISTEMA
 */
async function bootstrap() {
    try {
        // 1. Sincronizar Base de Datos (Neon)
        // 'alter: true' ajusta las tablas sin borrar los datos existentes
        await sequelize.sync({ alter: true });
        console.log('✅ Base de datos sincronizada correctamente.');

        // 2. Levantar el servidor HTTP y WebSockets
        // Usamos httpServer porque contiene tanto Express como Socket.io
        httpServer.listen(PORT, () => {
            console.log('--------------------------------------------------');
            console.log(`🚀 Servidor Norbridge listo en: http://localhost:${PORT}`);
            console.log(`📡 WebSockets habilitados y esperando conexiones`);
            console.log('--------------------------------------------------');
        });

    } catch (error) {
        console.error('❌ Error fatal al iniciar el servidor:', error);
        process.exit(1); // Cerramos el proceso si no hay base de datos
    }
}

bootstrap();