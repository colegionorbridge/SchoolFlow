import { Server as SocketServer } from 'socket.io';
import type { Server as HttpServer } from 'http';

// Exportamos la variable para usarla en los Services (ej: al crear un Ticket)
export let io: SocketServer;

export const initSocket = (httpServer: HttpServer) => {
    io = new SocketServer(httpServer, {
        cors: {
            origin: "*", // Luego lo restringís a la URL de tu panel
            methods: ["GET", "POST"]
        }
    });

    io.on('connection', (socket) => {
        console.log('📱 Cliente conectado al Panel de Control');

        socket.on('disconnect', () => {
            console.log('👤 Cliente desconectado');
        });
    });

    return io;
};