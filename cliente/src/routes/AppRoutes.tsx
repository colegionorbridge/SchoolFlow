import { createBrowserRouter, Navigate } from 'react-router-dom';
import Login from '../components/Login/Login';
import Dashboard from '../components/Dashboard/Dashboard';

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
      element: isAuth ? <Dashboard /> : (
        <Navigate to="/login" replace />
      ),
    },
    {
      path: "*",
      element: <Navigate to={isAuth ? "/dashboard" : "/login"} replace />,
    },
  ]);