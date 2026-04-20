import { io } from 'socket.io-client';

// Usamos la variable de entorno que definimos en el .env
const URL = import.meta.env.VITE_API_URL;

export const socket = io(URL, {
  autoConnect: true,
  // IMPORTANTE: Forzamos 'websocket' porque el modo 'polling' suele fallar 
  // con los túneles de Cloudflare por temas de cookies y headers.
  transports: ['websocket'],
});