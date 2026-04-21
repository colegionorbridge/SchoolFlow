import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { socket } from '../socket';
import toast, { Toaster } from 'react-hot-toast'; 
// Interfaces
interface Ticket {
  id: number;
  asunto: string;
  descripcion: string;
  ubicacion: string;
  estado: 'abierto' | 'en_proceso' | 'cerrado';
  prioridad: 'baja' | 'media' | 'alta';
  userTelefono: string;
  createdAt: string;
  historial?: any[];
  autor?: {
    nombreCompleto: string | null;
    telefono: string;
    rol?: {
      nombre: string;
    }
  };
}

interface Usuario {
  telefono: string; 
  nombreCompleto: string | null;
  email: string | null;
  esAdmin: boolean;
  registroCompleto: boolean;
  context?: {
    procesando?: boolean;
    [key: string]: any;
  };
  rol?: {
    nombre: string;
  };
  sectores?: Array<{ nombre: string }>;
}

interface DataContextType {
  tickets: Ticket[];
  usuarios: Usuario[];
  loading: boolean;
  cargarDatosIniciales: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL;

  // 2. Audio de notificación (useMemo evita que se recree el objeto en cada render)
  const notificationSound = useMemo(() => new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'), []);

  const cargarDatosIniciales = async () => {
    setLoading(true);
    try {
      const [resTickets, resUsuarios] = await Promise.all([
        fetch(`${API_URL}/api/tickets`),
        fetch(`${API_URL}/api/usuarios`)
      ]);

      if (!resTickets.ok || !resUsuarios.ok) {
        throw new Error('Error en la respuesta del servidor');
      }

      const dataTickets = await resTickets.json();
      const dataUsuarios = await resUsuarios.json();

      setTickets(dataTickets);
      setUsuarios(dataUsuarios);
    } catch (error) {
      console.error("Error al obtener datos iniciales de la API:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatosIniciales();

    // --- EVENTOS DE TICKETS ---

    socket.on('nuevo-ticket', (nuevoTicket: Ticket) => {
      // 3. Lógica de Notificación
      
      // A. Sonido (manejamos la promesa de reproducción)
      notificationSound.play().catch(err => console.warn("Audio bloqueado por el navegador hasta interacción del usuario", err));

      // B. Alerta visual en pantalla
      toast.success(`Nuevo ticket #${nuevoTicket.id} ingresado: ${nuevoTicket.asunto}`, {
        duration: 6000,
        position: 'top-right',
        icon: '🔔',
        style: {
          borderRadius: '10px',
          background: '#1e293b',
          color: '#fff',
        },
      });

      setTickets((prev) => [nuevoTicket, ...prev]);
    });

    socket.on('ticket-actualizado', (ticketActualizado: Ticket) => {
      setTickets((prev) => 
        prev.map((t) => t.id === ticketActualizado.id ? ticketActualizado : t)
      );
    });

    // --- EVENTOS DE USUARIOS ---

    socket.on('usuario-actualizado', (userActualizado: Usuario) => {
      setUsuarios((prev) => {
        const existe = prev.some((u) => u.telefono === userActualizado.telefono);
        if (existe) {
          return prev.map((u) => u.telefono === userActualizado.telefono ? userActualizado : u);
        } else {
          return [userActualizado, ...prev];
        }
      });
    });

    socket.on('usuario-registrado-nuevo', (nuevoUsuario: Usuario) => {
      setUsuarios((prev) => {
        if (prev.some(u => u.telefono === nuevoUsuario.telefono)) {
          return prev.map((u) => u.telefono === nuevoUsuario.telefono ? nuevoUsuario : u);
        }
        return [nuevoUsuario, ...prev];
      });
    });

    return () => {
      socket.off('nuevo-ticket');
      socket.off('ticket-actualizado');
      socket.off('usuario-actualizado');
      socket.off('usuario-registrado-nuevo');
    };
  }, [notificationSound]); // Agregamos el audio como dependencia

  return (
    <DataContext.Provider value={{ tickets, usuarios, loading, cargarDatosIniciales }}>
      {/* 4. El componente Toaster debe estar aquí para renderizar las alertas */}
      <Toaster />
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error("useData debe usarse dentro de un DataProvider");
  return context;
};