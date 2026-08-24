import { useEffect, useRef, useState, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { api } from '../api/client';

const SOCKET_URL = import.meta.env.VITE_API_URL || '';

interface TicketEvent { id: number; asunto: string; estado: string; userTelefono: string; }
interface TicketFull { id: number; asunto: string; estado: string; descripcion: string; ubicacion: string; prioridad: string; tecnicoAsignado: string | null; solucion: string | null; historial: any[]; createdAt: string; autor: { nombreCompleto: string; telefono: string } | null; }

function playSound(src: string) {
  try {
    const audio = new Audio(src);
    audio.volume = 0.5;
    audio.play().catch(() => {});
  } catch {}
}

export function useSocket() {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [notificacion, setNotificacion] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [ticketActualizado, setTicketActualizado] = useState<TicketFull | null>(null);
  const [ticketsAbiertos, setTicketsAbiertos] = useState(0);

  useEffect(() => {
    if (!user?.token) return;
    api.get<{ abiertos: number }>('/api/stats/resumen')
      .then(res => setTicketsAbiertos(res.abiertos))
      .catch(() => {});
  }, [user?.token, tick]);

  useEffect(() => {
    if (!user?.token) return;

    const socket = io(SOCKET_URL, { auth: { token: user.token }, transports: ['websocket', 'polling'] });

    socket.on('ticket-creado', (ticket: TicketEvent) => {
      playSound('/sounds/ticket-creado.mp3');
      setTick(t => t + 1);
      setNotificacion(`Nuevo ticket #${ticket.id}: ${ticket.asunto?.substring(0, 40)}`);
    });

    socket.on('nuevo-ticket', (ticket: TicketEvent) => {
      playSound('/sounds/ticket-creado.mp3');
      setTick(t => t + 1);
      setNotificacion(`Nuevo ticket #${ticket.id}: ${ticket.asunto?.substring(0, 40)}`);
    });

    socket.on('ticket-asignado', (ticket: any) => {
      setTick(t => t + 1);
      if (user?.nombre && ticket.tecnicoAsignado === user.nombre) {
        playSound('/sounds/ticket-asignado.mp3');
        setNotificacion(`Se te asignó el ticket #${ticket.id}: ${ticket.asunto?.substring(0, 40)}`);
      }
    });

    socket.on('ticket-actualizado', (ticket: TicketFull) => {
      setTick(t => t + 1);
      setTicketActualizado(ticket);
    });

    socket.on('datos-actualizados', () => {
      setTick(t => t + 1);
    });

    socket.on('usuario-registrado-nuevo', () => {
      setTick(t => t + 1);
    });

    socketRef.current = socket;
    return () => { socket.disconnect(); };
  }, [user?.token]);

  const limpiarNotificacion = useCallback(() => setNotificacion(null), []);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (notificacion) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setNotificacion(null), 5000);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [notificacion]);

  return { notificacion, limpiarNotificacion, tick, ticketActualizado, socketRef, ticketsAbiertos };
}
