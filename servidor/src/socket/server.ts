import { Server as SocketServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import type { Server as HttpServer } from 'http';
import { config } from '../config/index.js';
import { usuariosBaneados } from '../middleware/auth.js';
import { logger } from '../config/logger.js';

let io: SocketServer | null = null;
let botStatus: { connected: boolean; phone?: string } = { connected: false };

export function setBotConnected(phone?: string) {
  botStatus = { connected: true, phone };
  if (io) io.emit('bot-status', botStatus);
}

export function setBotDisconnected() {
  botStatus = { connected: false };
  if (io) io.emit('bot-status', botStatus);
}

export function emitQR(qr: string) {
  if (io) io.emit('bot-qr', qr);
}

export function getBotStatus() {
  return botStatus;
}

export function initSocket(httpServer: HttpServer) {
  io = new SocketServer(httpServer, {
    cors: {
      origin: [config.frontendUrl, 'http://localhost:5173'],
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
    allowUpgrades: true,
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('Token requerido'));
    try {
      const decoded = jwt.verify(token as string, config.jwt.secret) as { telefono?: string; esAdmin?: boolean; role?: string };
      if (decoded.telefono && usuariosBaneados.has(decoded.telefono)) return next(new Error('Usuario eliminado'));
      (socket as any).user = decoded;
      next();
    } catch {
      next(new Error('Token inválido'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`Socket conectado: ${(socket as any).user?.telefono || (socket as any).user?.role}`);
    socket.emit('bot-status', botStatus);
  });

  logger.info('Socket.IO inicializado con autenticación');
  return io;
}

export function getIO() {
  return io;
}
