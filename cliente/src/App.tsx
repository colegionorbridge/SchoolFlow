import { useState, useEffect, useMemo } from 'react';
import { RouterProvider } from 'react-router-dom';
import { socket } from './socket';
import { createMyRouter } from './routes/AppRoutes';
import { DataProvider } from './context/DataContext';

const API_URL = import.meta.env.VITE_API_URL;

export default function App() {
  const [isAuth, setIsAuth] = useState(false);
  const [loading, setLoading] = useState(true);

  // Verificar token al cargar la app
  useEffect(() => {
    const verifyToken = async () => {
      const token = localStorage.getItem('token');
      
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`${API_URL}/api/auth/verify`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
          setIsAuth(true);
        } else {
          localStorage.removeItem('token');
        }
      } catch (error) {
        localStorage.removeItem('token');
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, []);

  // Configuramos los listeners del socket una sola vez
  useEffect(() => {
    socket.on('connect', () => {
      console.log('✅ Conectado al servidor - ID:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ Desconectado - Razón:', reason);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
    };
  }, []);

  // Creamos el router pasando el estado actual
  const router = useMemo(() => 
    createMyRouter({ isAuth, setIsAuth }), 
  [isAuth]);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: '#1a365d'
      }}>
        <p style={{ color: 'white' }}>Cargando...</p>
      </div>
    );
  }

  return (
    <DataProvider>
      <RouterProvider router={router} />
    </DataProvider>
  );
}