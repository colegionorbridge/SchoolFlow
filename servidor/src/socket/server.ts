import { Server as SocketServer } from 'socket.io';
import type { Server as HttpServer } from 'http';

// Exportamos la variable para usarla en los Services (ej: al crear un Ticket)
export let io: SocketServer;

const frontendUrl = process.env.FRONTEND_URL || 'https://school-flow-inky.vercel.app';

export const initSocket = (httpServer: HttpServer) => {
    io = new SocketServer(httpServer, {
        cors: {
            origin: [frontendUrl, 'http://localhost:5173'],
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