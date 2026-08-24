import { useState, useEffect } from 'react';
import { Ticket, AlertTriangle, CheckCircle, Clock, Users, FileText } from 'lucide-react';
import { api } from '../api/client';
import StatCard from '../components/StatCard';
import { useSocket } from '../context/useSocket';

interface StatsResumen {
  totalTickets: number; abiertos: number; enProceso: number;
  cerrados: number; altaPrioridad: number; usuariosRegistrados: number;
}

interface StatsSector {
  sector: string; total: number; abiertos: number; enProceso: number; cerrados: number;
}

interface StatsUsuario {
  telefono: string; nombreCompleto: string; totalTickets: number;
  ticketsActivos: number; ticketsCerrados: number; tiempoPromedioMinutos: number | null;
}

export default function DashboardHome() {
  const [stats, setStats] = useState<StatsResumen | null>(null);
  const [porSector, setPorSector] = useState<StatsSector[]>([]);
  const [topUsuarios, setTopUsuarios] = useState<StatsUsuario[]>([]);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const { tick } = useSocket();

  useEffect(() => { loadStats(); }, [tick]);

  async function loadStats() {
    try {
      const [resumen, sectores, usuarios] = await Promise.all([
        api.get<StatsResumen>('/api/stats/resumen'),
        api.get<StatsSector[]>('/api/stats/por-sector'),
        api.get<StatsUsuario[]>('/api/stats/usuarios-top'),
      ]);
      setStats(resumen);
      setPorSector(sectores);
      setTopUsuarios(usuarios);
      setUpdatedAt(new Date());
    } catch {}
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>Panel principal</h2>
        {updatedAt && <span style={{ color: 'var(--text-secondary)', fontSize: '.75rem' }}>
          Actualizado {updatedAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
        </span>}
      </div>

      {stats && (
        <div className="card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '.6rem', marginBottom: '1.5rem' }}>
          <StatCard value={stats.totalTickets} label="Total tickets" icon={<FileText size={18} />} />
          <StatCard value={stats.abiertos} label="Abiertos" color="var(--danger)" icon={<AlertTriangle size={18} />} />
          <StatCard value={stats.enProceso} label="En proceso" color="var(--warning)" icon={<Clock size={18} />} />
          <StatCard value={stats.cerrados} label="Cerrados" color="var(--success)" icon={<CheckCircle size={18} />} />
          <StatCard value={stats.altaPrioridad} label="Alta prioridad" color="var(--danger)" icon={<Ticket size={18} />} />
          <StatCard value={stats.usuariosRegistrados} label="Usuarios registrados" icon={<Users size={18} />} />
        </div>
      )}

      {porSector.length > 0 && (
        <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
          <h3 style={{ margin: '0 0 .5rem', fontSize: '.9rem', fontWeight: 600 }}>Tickets por sector</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Sector</th><th>Total</th><th>Abiertos</th><th>En proceso</th><th>Cerrados</th></tr>
              </thead>
              <tbody>
                {porSector.map(s => (
                  <tr key={s.sector}>
                    <td style={{ fontWeight: 600 }}>{s.sector}</td>
                    <td>{s.total}</td>
                    <td><span className="badge badge-abierto">{s.abiertos}</span></td>
                    <td><span className="badge badge-en_proceso">{s.enProceso}</span></td>
                    <td><span className="badge badge-cerrado">{s.cerrados}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {topUsuarios.length > 0 && (
        <div className="card" style={{ padding: '1rem' }}>
          <h3 style={{ margin: '0 0 .5rem', fontSize: '.9rem', fontWeight: 600 }}>Usuarios con más tickets</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Usuario</th><th>Total</th><th>Activos</th><th>Cerrados</th></tr>
              </thead>
              <tbody>
                {topUsuarios.map(u => (
                  <tr key={u.telefono}>
                    <td style={{ fontWeight: 600 }}>{u.nombreCompleto || u.telefono}</td>
                    <td>{u.totalTickets}</td>
                    <td><span className="badge badge-en_proceso">{u.ticketsActivos}</span></td>
                    <td><span className="badge badge-cerrado">{u.ticketsCerrados}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!stats && (
        <div className="empty" style={{ marginTop: '2rem' }}>
          <span className="spinner" style={{ marginBottom: '.5rem' }} /><br />
          Cargando estadísticas...
        </div>
      )}
    </div>
  );
}
