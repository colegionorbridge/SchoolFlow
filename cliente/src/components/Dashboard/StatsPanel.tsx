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

interface MesData {
  label: string;
  creados: number;
}

interface UsuarioTop {
  telefono: string;
  nombreCompleto: string;
  totalTickets: number;
  ticketsActivos: number;
  ticketsCerrados: number;
}

const API_URL = import.meta.env.VITE_API_URL;

const mesesNom = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const StatsPanel: React.FC = () => {
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [porSector, setPorSector] = useState<SectorData[]>([]);
  const [porMes, setPorMes] = useState<MesData[]>([]);
  const [usuariosTop, setUsuariosTop] = useState<UsuarioTop[]>([]);
  const [sinCompletar, setSinCompletar] = useState(0);
  const [loading, setLoading] = useState(true);

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  };

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/stats/resumen`, { headers }).then(r => r.json()),
      fetch(`${API_URL}/api/stats/por-sector`, { headers }).then(r => r.json()),
      fetch(`${API_URL}/api/stats/por-mes`, { headers }).then(r => r.json()),
      fetch(`${API_URL}/api/stats/usuarios-top`, { headers }).then(r => r.json()),
      fetch(`${API_URL}/api/usuarios`, { headers }).then(r => r.json())
    ])
    .then(([r, s, m, u, usrs]) => {
      setResumen(r);
      setPorSector(s);
      setPorMes((m as { mes: string; creados: number }[]).map(d => {
        const [anio, mesNum] = d.mes.split('-');
        return { label: `${mesesNom[parseInt(mesNum) - 1]} ${anio}`, creados: d.creados };
      }));
      setUsuariosTop(u);
      setSinCompletar((usrs as { registroCompleto?: boolean }[]).filter(x => !x.registroCompleto).length);
    })
    .catch(console.error)
    .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className={styles.loading}>Cargando estadísticas...</div>;
  }

  const maxSectorTotal = Math.max(...porSector.map(s => s.total), 1);
  const maxMesCreados = Math.max(...porMes.map(m => m.creados), 1);

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Estadísticas</h2>

      <div className={styles.cardsGrid}>
        <Card label="Total Tickets" value={resumen?.totalTickets ?? 0} color="#2563eb" />
        <Card label="Abiertos" value={resumen?.abiertos ?? 0} color="#d97706" />
        <Card label="En Proceso" value={resumen?.enProceso ?? 0} color="#2563eb" />
        <Card label="Cerrados" value={resumen?.cerrados ?? 0} color="#059669" />
        <Card label="Usuarios Registrados" value={resumen?.usuariosRegistrados ?? 0} color="#7c3aed" />
        <Card label="Sin Completar" value={sinCompletar} color="#dc2626" />
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
          <h3>Tickets por Mes</h3>
          <div className={styles.barList}>
            {porMes.map(m => (
              <div key={m.label} className={styles.barRow}>
                <div className={styles.barLabel}>
                  <span>{m.label}</span>
                  <span className={styles.barCount}>{m.creados}</span>
                </div>
                <div className={styles.barTrack}>
                  <div
                    className={styles.barFillMes}
                    style={{ width: `${(m.creados / maxMesCreados) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {porMes.length === 0 && <p className={styles.empty}>Sin datos</p>}
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
