import { io, Socket } from 'socket.io-client';

// Usamos la variable de entorno que definimos en el .env
const URL = import.meta.env.VITE_API_URL;

export const socket: Socket = io(URL, {
  autoConnect: false, // No conectar automáticamente, esperar a que el usuario esté autenticado
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});