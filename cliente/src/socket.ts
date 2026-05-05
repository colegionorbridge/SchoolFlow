import { io } from 'socket.io-client';

// Usamos la variable de entorno que definimos en el .env
const URL = import.meta.env.VITE_API_URL;

// Detectar si estamos en producción (usando túnel)
const isProduction = URL && !URL.includes('localhost');

export const socket = io(URL, {
  autoConnect: true,
  // En producción, solo usar polling (compatible con túneles)
  // En desarrollo, permitir ambos
  transports: isProduction ? ['polling'] : ['polling', 'websocket'],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 2000,
  timeout: 30000,
  forceNew: true,
});