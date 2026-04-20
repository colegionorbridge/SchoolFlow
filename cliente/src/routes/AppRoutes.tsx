import { createBrowserRouter, Navigate } from 'react-router-dom';
import Login from '../components/Login/Login';

interface CreateRouterProps {
  isAuth: boolean;
  setIsAuth: (val: boolean) => void;
}

export const createMyRouter = ({ isAuth, setIsAuth }: CreateRouterProps) =>
  createBrowserRouter([
    {
      path: "/login",
      element: isAuth ? (
        <Navigate to="/dashboard" replace />
      ) : (
        <Login onLogin={() => setIsAuth(true)} />
      ),
    },
    {
      path: "/dashboard",
      element: isAuth ? (
        <div style={{ padding: '20px' }}>
          <h1>Panel de Gestión - Norbridge </h1>
          <p>Servidor: 🟢 Online</p>
          {/* Aquí irá tu futuro componente Dashboard */}
        </div>
      ) : (
        <Navigate to="/login" replace />
      ),
    },
    {
      path: "*",
      element: <Navigate to={isAuth ? "/dashboard" : "/login"} replace />,
    },
  ]);