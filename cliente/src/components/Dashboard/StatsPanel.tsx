import React, { useEffect, useState } from 'react';
import styles from './StatsPanel.module.css';

interface Resumen {
  totalTickets: number;
  abiertos: number;
  enProceso: number;
  cerrados: number;
  altaPrioridad: number;
  usuariosRegistrados: number;
}

interface SectorData {
  sector: string;
  total: number;
  abiertos: number;
  enProceso: number;
  cerrados: number;
}

interface DiaData {
  fecha: string;
  creados: number;
  cerrados: number;
}

interface UsuarioTop {
  telefono: string;
  nombreCompleto: string;
  totalTickets: number;
  ticketsActivos: number;
  ticketsCerrados: number;
}

const API_URL = import.meta.env.VITE_API_URL;

const StatsPanel: React.FC = () => {
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [porSector, setPorSector] = useState<SectorData[]>([]);
  const [porDia, setPorDia] = useState<DiaData[]>([]);
  const [usuariosTop, setUsuariosTop] = useState<UsuarioTop[]>([]);
  const [loading, setLoading] = useState(true);

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  };

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/stats/resumen`, { headers }).then(r => r.json()),
      fetch(`${API_URL}/api/stats/por-sector`, { headers }).then(r => r.json()),
      fetch(`${API_URL}/api/stats/por-dia`, { headers }).then(r => r.json()),
      fetch(`${API_URL}/api/stats/usuarios-top`, { headers }).then(r => r.json())
    ])
    .then(([r, s, d, u]) => {
      setResumen(r);
      setPorSector(s);
      setPorDia(d);
      setUsuariosTop(u);
    })
    .catch(console.error)
    .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className={styles.loading}>Cargando estadísticas...</div>;
  }

  const maxSectorTotal = Math.max(...porSector.map(s => s.total), 1);

  const maxChartValue = Math.max(...porDia.map(d => Math.max(d.creados, d.cerrados)), 1);

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Estadísticas</h2>

      <div className={styles.cardsGrid}>
        <Card label="Total Tickets" value={resumen?.totalTickets ?? 0} color="#2563eb" />
        <Card label="Abiertos" value={resumen?.abiertos ?? 0} color="#d97706" />
        <Card label="En Proceso" value={resumen?.enProceso ?? 0} color="#2563eb" />
        <Card label="Cerrados" value={resumen?.cerrados ?? 0} color="#059669" />
        <Card label="Alta Prioridad" value={resumen?.altaPrioridad ?? 0} color="#dc2626" />
        <Card label="Usuarios Registrados" value={resumen?.usuariosRegistrados ?? 0} color="#7c3aed" />
      </div>

      <div className={styles.columnsGrid}>
        <section className={styles.section}>
          <h3>Tickets por Sector</h3>
          <div className={styles.barList}>
            {porSector.map(s => (
              <div key={s.sector} className={styles.barRow}>
                <div className={styles.barLabel}>
                  <span>{s.sector}</span>
                  <span className={styles.barCount}>{s.total}</span>
                </div>
                <div className={styles.barTrack}>
                  <div
                    className={styles.barFill}
                    style={{ width: `${(s.total / maxSectorTotal) * 100}%` }}
                  />
                </div>
                <div className={styles.barSub}>
                  <span className={styles.subAbierto}>● {s.abiertos} abiertos</span>
                  <span className={styles.subProceso}>● {s.enProceso} en proc.</span>
                  <span className={styles.subCerrado}>● {s.cerrados} cerrados</span>
                </div>
              </div>
            ))}
            {porSector.length === 0 && <p className={styles.empty}>Sin datos</p>}
          </div>
        </section>

        <section className={styles.section}>
          <h3>Tendencia (últimos 30 días)</h3>
          <div className={styles.chart}>
            {porDia.map(d => {
              const hCreados = (d.creados / maxChartValue) * 100;
              const hCerrados = (d.cerrados / maxChartValue) * 100;
              const label = d.fecha.slice(5);
              return (
                <div key={d.fecha} className={styles.chartCol} title={`${d.fecha}: ${d.creados} creados, ${d.cerrados} cerrados`}>
                  <div className={styles.chartBars}>
                    <div className={styles.barCreados} style={{ height: `${hCreados}%` }} />
                    <div className={styles.barCerrados} style={{ height: `${hCerrados}%` }} />
                  </div>
                  {porDia.length <= 31 && (
                    <span className={styles.chartLabel}>
                      {parseInt(label.split('-')[1]) === 1 || d === porDia[0] || d === porDia[porDia.length - 1] ? label : ''}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <div className={styles.legend}>
            <span><span className={styles.dotCreados} /> Creados</span>
            <span><span className={styles.dotCerrados} /> Cerrados</span>
          </div>
        </section>
      </div>

      <section className={styles.section}>
        <h3>Usuarios con más tickets</h3>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>#</th>
              <th>Nombre</th>
              <th>Total</th>
              <th>Activos</th>
              <th>Cerrados</th>
            </tr>
          </thead>
          <tbody>
            {usuariosTop.map((u, i) => (
              <tr key={u.telefono}>
                <td>{i + 1}</td>
                <td>{u.nombreCompleto || 'Sin nombre'}</td>
                <td>{u.totalTickets}</td>
                <td>{u.ticketsActivos}</td>
                <td>{u.ticketsCerrados}</td>
              </tr>
            ))}
            {usuariosTop.length === 0 && (
              <tr><td colSpan={5} className={styles.empty}>Sin datos</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
};

function Card({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={styles.card}>
      <p className={styles.cardLabel}>{label}</p>
      <p className={styles.cardValue} style={{ color }}>{value}</p>
    </div>
  );
}

export default StatsPanel;
