import { Server as SocketServer } from 'socket.io';
import type { Server as HttpServer } from 'http';

// Exportamos la variable para usarla en los Services (ej: al crear un Ticket)
export let io: SocketServer;

const frontendUrl = process.env.FRONTEND_URL || 'https://school-flow-inky.vercel.app';
const apiUrl = 'https://api.alejndrogcandia.online';

export const initSocket = (httpServer: HttpServer) => {
    io = new SocketServer(httpServer, {
        cors: {
            origin: [frontendUrl, 'http://localhost:5173', apiUrl],
            methods: ["GET", "POST"]
        },
      transports: ['websocket', 'polling'],
        allowUpgrades: true
    });

    io.on('connection', (socket) => {
        console.log('📱 Cliente conectado al Panel de Control - ID:', socket.id);

        socket.on('disconnect', (reason) => {
            console.log('👤 Cliente desconectado - ID:', socket.id, '| Razón:', reason);
        });
    });

    return io;
};