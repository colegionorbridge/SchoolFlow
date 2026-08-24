import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Ticket, Settings2, Users, ShieldCheck, Menu, GraduationCap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/useSocket';
import NavItem from '../components/NavItem';

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { notificacion, limpiarNotificacion, ticketsAbiertos } = useSocket();
  const [menuOpen, setMenuOpen] = useState(false);

  function handleLogout() { logout(); navigate('/login', { replace: true }); }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'flex-start' }}>
      <button className="hamburger" onClick={() => setMenuOpen(true)} style={{ position: 'fixed', top: 12, left: 12, zIndex: 1100 }}>
        <Menu size={24} />
      </button>

      <aside className={`sidebar${menuOpen ? ' open' : ''}`} style={{ width: 220, background: '#1A2C3F', color: '#fff', padding: '1.5rem 0', display: 'flex', flexDirection: 'column', flexShrink: 0, position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' }}>
        <div style={{ textAlign: 'center', padding: '0 1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,.08)', marginBottom: '.5rem' }}>
          <p style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: 3, color: '#fff', margin: 0 }}>NORBRIDGE</p>
          <p style={{ color: '#A2A6AB', fontSize: '.8rem', marginTop: '.2rem' }}>Panel de Control</p>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 0, flex: 1 }}>
          <NavItem to="/" icon={<LayoutDashboard size={18} />} label="Inicio" end />
          <NavItem to="/tickets" icon={<Ticket size={18} />} label="Tickets" badge={ticketsAbiertos} />
          {user?.superAdmin && (
            <>
              <div style={{ color: '#FFD700', fontSize: '.65rem', padding: '1.5rem 1rem .3rem', textTransform: 'uppercase', letterSpacing: 2 }}>
                Administración
              </div>
              <NavItem to="/admin/roles" icon={<GraduationCap size={18} />} label="Roles" />
              <NavItem to="/admin/sectores" icon={<Settings2 size={18} />} label="Sectores" />
              <NavItem to="/admin/usuarios" icon={<Users size={18} />} label="Usuarios" />
              <NavItem to="/admin/settings" icon={<ShieldCheck size={18} />} label="Configuración" />
            </>
          )}
        </nav>
        <div style={{ padding: '1rem', borderTop: '1px solid rgba(255,255,255,.08)' }}>
          <p style={{ color: '#fff', fontSize: '.9rem', fontWeight: 600, marginBottom: '.6rem', textAlign: 'center' }}>
            {user?.nombre || user?.telefono || 'Usuario'}
          </p>
          <button className="btn btn-ghost btn-sm" style={{ color: '#FFD700', width: '100%', justifyContent: 'center' }} onClick={handleLogout}>
            Salir
          </button>
        </div>
      </aside>

      {menuOpen && <div className="sidebar-overlay" onClick={() => setMenuOpen(false)} />}

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div className="main-content" style={{ padding: '1.5rem', flex: 1 }}>
          <Outlet />
        </div>
      </main>

      {notificacion && (
        <div onClick={limpiarNotificacion} style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          background: '#1A2C3F', color: '#B6FF18', padding: '.8rem 1.2rem',
          borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,.3)', cursor: 'pointer',
          maxWidth: 360,
        }}>
          {notificacion}
        </div>
      )}
    </div>
  );
}
