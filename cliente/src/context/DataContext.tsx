import React, { createContext, useContext, useState, useEffect } from 'react';
import { socket } from '../socket';

// Interfaces ajustadas a tu modelo
interface Ticket {
  id: number;
  asunto: string;
  descripcion: string;
  ubicacion: string;
  estado: 'abierto' | 'en_proceso' | 'cerrado';
  prioridad: 'baja' | 'media' | 'alta';
  userTelefono: string;
  createdAt: string;
  historial?: any[]; // Por si querés mostrar las notas
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
    // 1. Carga inicial al montar el componente
    cargarDatosIniciales();

    // --- EVENTOS DE TICKETS ---

    // Nuevo Ticket: Se agrega arriba de todo
    socket.on('nuevo-ticket', (nuevoTicket: Ticket) => {
      setTickets((prev) => [nuevoTicket, ...prev]);
    });

    // Ticket Actualizado: Mapeamos para reemplazar el viejo por el nuevo
    socket.on('ticket-actualizado', (ticketActualizado: Ticket) => {
      setTickets((prev) => 
        prev.map((t) => t.id === ticketActualizado.id ? ticketActualizado : t)
      );
    });

    // --- EVENTOS DE USUARIOS ---

    // Usuario Actualizado (Maneja estado "procesando", cambios de nombre, etc.)
    socket.on('usuario-actualizado', (userActualizado: Usuario) => {
      setUsuarios((prev) => {
        const existe = prev.some((u) => u.telefono === userActualizado.telefono);
        if (existe) {
          // Si ya existe en la lista, lo actualizamos
          return prev.map((u) => u.telefono === userActualizado.telefono ? userActualizado : u);
        } else {
          // Si es un usuario que no estaba (ej: admin nuevo), lo agregamos
          return [userActualizado, ...prev];
        }
      });
    });

    // Nuevo Registro: Evento específico para cuando alguien termina el proceso
    socket.on('usuario-registrado-nuevo', (nuevoUsuario: Usuario) => {
      setUsuarios((prev) => {
        // Evitamos duplicados
        if (prev.some(u => u.telefono === nuevoUsuario.telefono)) {
          return prev.map((u) => u.telefono === nuevoUsuario.telefono ? nuevoUsuario : u);
        }
        return [nuevoUsuario, ...prev];
      });
    });

    // Limpieza de eventos al desmontar
    return () => {
      socket.off('nuevo-ticket');
      socket.off('ticket-actualizado');
      socket.off('usuario-actualizado');
      socket.off('usuario-registrado-nuevo');
    };
  }, []);

  return (
    <DataContext.Provider value={{ tickets, usuarios, loading, cargarDatosIniciales }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error("useData debe usarse dentro de un DataProvider");
  return context;
};