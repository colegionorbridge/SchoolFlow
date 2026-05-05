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
  roleId?: number | null;
  context?: {
    procesando?: boolean;
    [key: string]: any;
  };
  rol?: {
    id: number;
    nombre: string;
  };
  sectores?: Array<{ id: number; nombre: string }>;
}

interface Rol {
  id: number;
  nombre: string;
  codigoAcceso: string | null;
}

interface Sector {
  id: number;
  nombre: string;
  codigoAcceso: string | null;
}

interface DataContextType {
  tickets: Ticket[];
  usuarios: Usuario[];
  roles: Rol[];
  sectores: Sector[];
  loading: boolean;
  cargarDatosIniciales: () => Promise<void>;
  actualizarUsuario: (telefono: string, datos: any) => Promise<void>;
  cargarRoles: () => Promise<void>;
  cargarSectores: () => Promise<void>;
  crearSector: (datos: any) => Promise<void>;
  actualizarSector: (id: number, datos: any) => Promise<void>;
  eliminarSector: (id: number) => Promise<void>;
  crearRol: (datos: any) => Promise<void>;
  actualizarRol: (id: number, datos: any) => Promise<void>;
  eliminarRol: (id: number) => Promise<void>;
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
    const token = localStorage.getItem('token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const [resTickets, resUsuarios] = await Promise.all([
        fetch(`${API_URL}/api/tickets`, { headers }),
        fetch(`${API_URL}/api/usuarios`, { headers })
      ]);

      if (!resTickets.ok || !resUsuarios.ok) {
        if (resTickets.status === 401 || resUsuarios.status === 401) {
          localStorage.removeItem('token');
          window.location.href = '/login';
          return;
        }
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
    // Solo cargar datos si hay token (usuario autenticado)
    const token = localStorage.getItem('token');
    if (token) {
      cargarDatosIniciales();
    }

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

  const [roles, setRoles] = useState<Rol[]>([]);
  const [sectores, setSectores] = useState<Sector[]>([]);

  const cargarRoles = async () => {
    const token = localStorage.getItem('token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    try {
      const res = await fetch(`${API_URL}/api/roles`, { headers });
      if (res.ok) {
        const data = await res.json();
        setRoles(data);
      }
    } catch (error) {
      console.error("Error al cargar roles:", error);
    }
  };

  const crearRol = async (datos: any) => {
    const token = localStorage.getItem('token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    try {
      const res = await fetch(`${API_URL}/api/roles`, {
        method: 'POST',
        headers,
        body: JSON.stringify(datos)
      });
      
      if (!res.ok) {
        throw new Error('Error al crear rol');
      }
      
      await cargarRoles();
    } catch (error) {
      console.error("Error al crear rol:", error);
      throw error;
    }
  };

  const actualizarRol = async (id: number, datos: any) => {
    const token = localStorage.getItem('token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    try {
      const res = await fetch(`${API_URL}/api/roles/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(datos)
      });
      
      if (!res.ok) {
        throw new Error('Error al actualizar rol');
      }
      
      await cargarRoles();
    } catch (error) {
      console.error("Error al actualizar rol:", error);
      throw error;
    }
  };

  const eliminarRol = async (id: number) => {
    const token = localStorage.getItem('token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    try {
      const res = await fetch(`${API_URL}/api/roles/${id}`, {
        method: 'DELETE',
        headers
      });
      
      if (!res.ok) {
        throw new Error('Error al eliminar rol');
      }
      
      await cargarRoles();
    } catch (error) {
      console.error("Error al eliminar rol:", error);
      throw error;
    }
  };

  const cargarSectores = async () => {
    const token = localStorage.getItem('token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    try {
      const res = await fetch(`${API_URL}/api/sectores`, { headers });
      if (res.ok) {
        const data = await res.json();
        setSectores(data);
      }
    } catch (error) {
      console.error("Error al cargar sectores:", error);
    }
  };

  const actualizarUsuario = async (telefono: string, datos: any) => {
    const token = localStorage.getItem('token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    try {
      const res = await fetch(`${API_URL}/api/usuarios/${telefono}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(datos)
      });
      
      if (!res.ok) {
        throw new Error('Error al actualizar usuario');
      }
    } catch (error) {
      console.error("Error al actualizar usuario:", error);
      throw error;
    }
  };

  const crearSector = async (datos: any) => {
    const token = localStorage.getItem('token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    try {
      const res = await fetch(`${API_URL}/api/sectores`, {
        method: 'POST',
        headers,
        body: JSON.stringify(datos)
      });
      
      if (!res.ok) {
        throw new Error('Error al crear sector');
      }
      
      await cargarSectores();
    } catch (error) {
      console.error("Error al crear sector:", error);
      throw error;
    }
  };

  const actualizarSector = async (id: number, datos: any) => {
    const token = localStorage.getItem('token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    try {
      const res = await fetch(`${API_URL}/api/sectores/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(datos)
      });
      
      if (!res.ok) {
        throw new Error('Error al actualizar sector');
      }
      
      await cargarSectores();
    } catch (error) {
      console.error("Error al actualizar sector:", error);
      throw error;
    }
  };

  const eliminarSector = async (id: number) => {
    const token = localStorage.getItem('token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    try {
      const res = await fetch(`${API_URL}/api/sectores/${id}`, {
        method: 'DELETE',
        headers
      });
      
      if (!res.ok) {
        throw new Error('Error al eliminar sector');
      }
      
      await cargarSectores();
    } catch (error) {
      console.error("Error al eliminar sector:", error);
      throw error;
    }
  };

  return (
    <DataContext.Provider value={{ 
      tickets, usuarios, roles, sectores, loading, 
      cargarDatosIniciales, actualizarUsuario, 
      cargarRoles, cargarSectores, 
      crearSector, actualizarSector, eliminarSector,
      crearRol, actualizarRol, eliminarRol
    }}>
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