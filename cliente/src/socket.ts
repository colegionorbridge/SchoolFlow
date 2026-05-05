import { io } from 'socket.io-client';

// Usamos la variable de entorno que definimos en el .env
const URL = import.meta.env.VITE_API_URL;

export const socket = io(URL, {
  autoConnect: true,
  transports: ['polling']
});