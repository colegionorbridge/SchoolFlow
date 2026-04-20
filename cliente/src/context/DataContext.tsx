import React, { createContext, useContext, useState, useEffect } from 'react';
import { socket } from '../socket';

// Interface ajustada a tu modelo de Sequelize y la consulta del backend
interface Ticket {
  id: number;
  asunto: string;
  descripcion: string;
  ubicacion: string;
  estado: 'abierto' | 'en_proceso' | 'cerrado';
  prioridad: 'baja' | 'media' | 'alta';
  userTelefono: string;
  createdAt: string;
  autor?: {
    nombreCompleto: string | null;
    telefono: string;
    rol?: {
      nombre: string;
    }
  };
}

interface Usuario {
  telefono: string; // Tu PK es el teléfono
  nombreCompleto: string | null;
  email: string | null;
  esAdmin: boolean;
  registroCompleto: boolean;
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
      // Llamada paralela a tus endpoints de Cloudflare
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
    // Escuchar actualizaciones en tiempo real via Socket.io
    socket.on('nuevo-ticket', (nuevoTicket: Ticket) => {
      setTickets((prev) => [nuevoTicket, ...prev]);
    });

    socket.on('nuevo-usuario', (nuevoUsuario: Usuario) => {
      setUsuarios((prev) => [nuevoUsuario, ...prev]);
    });

    return () => {
      socket.off('nuevo-ticket');
      socket.off('nuevo-usuario');
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