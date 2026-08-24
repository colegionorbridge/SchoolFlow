import { Routes, Route, Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardLayout from './layouts/DashboardLayout';
import DashboardHome from './pages/DashboardHome';
import TicketsList from './pages/TicketsList';
import TicketDetail from './pages/TicketDetail';
import RolesPage from './pages/admin/RolesPage';
import SectoresPage from './pages/admin/SectoresPage';
import UsuariosPage from './pages/admin/UsuariosPage';
import SettingsPage from './pages/admin/SettingsPage';

function Private({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

function AdminOnly({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!user.superAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Private><DashboardLayout /></Private>}>
        <Route index element={<DashboardHome />} />
        <Route path="tickets" element={<TicketsList />} />
        <Route path="tickets/:id" element={<TicketDetail />} />
        <Route path="admin/roles" element={<AdminOnly><RolesPage /></AdminOnly>} />
        <Route path="admin/sectores" element={<AdminOnly><SectoresPage /></AdminOnly>} />
        <Route path="admin/usuarios" element={<AdminOnly><UsuariosPage /></AdminOnly>} />
        <Route path="admin/settings" element={<AdminOnly><SettingsPage /></AdminOnly>} />
      </Route>
    </Routes>
  );
}
