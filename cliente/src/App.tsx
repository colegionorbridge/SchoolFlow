import { useEffect } from 'react';
import { socket } from './socket';

export default function App() {
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

  return (
    <div>
      <h1>Panel de IT - Colegio Norbridge</h1>
    </div>
  );
}