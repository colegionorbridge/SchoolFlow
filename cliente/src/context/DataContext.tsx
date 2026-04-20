import React, { createContext, useContext, useState, useEffect } from 'react';
import { socket } from '../socket';

interface Ticket {
  id: number;
  nombre: string;
  sector: string;
  problema: string;
  estado: 'abierto' | 'cerrado';
}

interface Usuario {
  id: number;
  nombre: string;
  rol: string;
  ultimo_acceso: string;
}

interface DataContextType {
  tickets: Ticket[];
  usuarios: Usuario[]; // <-- Nueva lista
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
      // Usamos Promise.all para que las dos peticiones corran en paralelo
      const [resTickets, resUsuarios] = await Promise.all([
        fetch(`${API_URL}/tickets`),
        fetch(`${API_URL}/usuarios`)
      ]);

      const dataTickets = await resTickets.json();
      const dataUsuarios = await resUsuarios.json();

      setTickets(dataTickets);
      setUsuarios(dataUsuarios);
    } catch (error) {
      console.error("Error al obtener datos iniciales de Neon:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Sockets para Tickets
    socket.on('nuevo-ticket', (nuevoTicket: Ticket) => {
      setTickets((prev) => [nuevoTicket, ...prev]);
    });

    // Sockets para Usuarios (por ejemplo, cuando alguien se registra en el bot)
    socket.on('nuevo-usuario', (nuevoUsuario: Usuario) => {
      setUsuarios((prev) => [...prev, nuevoUsuario]);
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