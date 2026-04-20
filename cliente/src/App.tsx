import { useState, useEffect, useMemo } from 'react';
import { RouterProvider } from 'react-router-dom';
import { socket } from './socket';
import { createMyRouter } from './routes/AppRoutes';
import { DataProvider } from './context/DataContext';
export default function App() {
  const [isAuth, setIsAuth] = useState(false);

  // Configuramos los listeners del socket una sola vez
  useEffect(() => {
    socket.on('connect', () => {
      console.log('✅ Conexión establecida con el servidor del colegio');
    });

    socket.on('connect_error', (err) => {
      console.error('❌ Error de conexión:', err.message);
    });

    return () => {
      socket.off('connect');
      socket.off('connect_error');
    };
  }, []);

  // Creamos el router pasando el estado actual
  const router = useMemo(() => 
    createMyRouter({ isAuth, setIsAuth }), 
  [isAuth]);

  return (
    <DataProvider>
      <RouterProvider router={router} />
    </DataProvider>
  );
}