import React, { useEffect, useState, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import TicketModal from '../TicketModal/TicketModal'; // Asegurate de que la ruta sea correcta
import styles from './Dashboard.module.css';

const ORDEN_ESTADO = { 'abierto': 1, 'en_proceso': 2, 'cerrado': 3 };
const ORDEN_PRIORIDAD = { 'alta': 1, 'media': 2, 'baja': 3 };

type SortConfig = {
  key: string;
  direction: 'asc' | 'desc';
} | null;

const Dashboard: React.FC = () => {
  const { tickets, usuarios, loading, cargarDatosIniciales } = useData();
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'id', direction: 'desc' });
  
  // ESTADO PARA EL MODAL
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);

  useEffect(() => {
    cargarDatosIniciales();
  }, []);

  // Función para actualizar el ticket en el servidor
  const handleUpdateTicket = async (id: number, updates: any) => {
    const API_URL = import.meta.env.VITE_API_URL;
    try {
      const res = await fetch(`${API_URL}/api/tickets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (!res.ok) throw new Error("Error al actualizar");
      
      // Nota: No cerramos el modal aquí necesariamente, 
      // lo manejamos dentro del componente TicketModal o al terminar el guardado.
    } catch (error) {
      console.error("Error:", error);
      alert("No se pudo actualizar el ticket.");
    }
  };

  const sortedTickets = useMemo(() => {
    let sortableTickets = [...tickets];
    if (sortConfig !== null) {
      sortableTickets.sort((a: any, b: any) => {
        let aValue: any;
        let bValue: any;

        switch (sortConfig.key) {
          case 'id':
            aValue = a.id;
            bValue = b.id;
            break;
          case 'solicitante':
            aValue = a.autor?.nombreCompleto?.toLowerCase() || '';
            bValue = b.autor?.nombreCompleto?.toLowerCase() || '';
            break;
          case 'estado':
            aValue = ORDEN_ESTADO[a.estado as keyof typeof ORDEN_ESTADO] || 99;
            bValue = ORDEN_ESTADO[b.estado as keyof typeof ORDEN_ESTADO] || 99;
            break;
          case 'prioridad':
            aValue = ORDEN_PRIORIDAD[a.prioridad as keyof typeof ORDEN_PRIORIDAD] || 99;
            bValue = ORDEN_PRIORIDAD[b.prioridad as keyof typeof ORDEN_PRIORIDAD] || 99;
            break;
          default:
            aValue = a[sortConfig.key as keyof any];
            bValue = b[sortConfig.key as keyof any];
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableTickets;
  }, [tickets, sortConfig]);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getPrioridadStyle = (p: string) => {
    switch (p) {
      case 'alta': return { backgroundColor: '#fee2e2', color: '#991b1b' };
      case 'media': return { backgroundColor: '#fef3c7', color: '#92400e' };
      default: return { backgroundColor: '#f3f4f6', color: '#374151' };
    }
  };

  const getSortIcon = (key: string) => {
    if (sortConfig?.key !== key) return ' ↕';
    return sortConfig.direction === 'asc' ? ' 🔼' : ' 🔽';
  };

  if (loading && tickets.length === 0) {
    return (
      <div className={styles.loadingContainer}>
        <p>Conectando con el servidor de Colegio Norbridge...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Panel de Gestión IT</h1>
          <p className={styles.subtitle}>Infraestructura y Soporte Norbridge</p>
        </div>
        <div className={styles.statusBadge}>
          <span className={styles.onlineDot}></span> Servidor: Online
        </div>
      </header>

      <section className={styles.statsGrid}>
        <div className={styles.statCard}>
          <h3>Tickets Abiertos</h3>
          <p className={styles.statNumber}>
            {tickets.filter(t => t.estado === 'abierto').length}
          </p>
        </div>
        <div className={styles.statCard}>
          <h3>Usuarios Registrados</h3>
          <p className={styles.statNumber}>{usuarios.length}</p>
        </div>
      </section>

      <section className={styles.tableSection}>
        <h2>Tickets Recientes</h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th onClick={() => requestSort('id')} className={styles.sortableHeader}>
                ID {getSortIcon('id')}
              </th>
              <th onClick={() => requestSort('solicitante')} className={styles.sortableHeader}>
                Solicitante {getSortIcon('solicitante')}
              </th>
              <th>Asunto / Descripción</th>
              <th>Ubicación</th>
              <th onClick={() => requestSort('prioridad')} className={styles.sortableHeader}>
                Prioridad {getSortIcon('prioridad')}
              </th>
              <th onClick={() => requestSort('estado')} className={styles.sortableHeader}>
                Estado {getSortIcon('estado')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedTickets.map((ticket) => (
              <tr 
                key={ticket.id} 
                className={`${styles.row} ${styles.rowClickable}`}
                onClick={() => setSelectedTicket(ticket)}
              >
                <td># {ticket.id}</td>
                <td>
                  <strong>{ticket.autor?.nombreCompleto || 'Desconocido'}</strong><br />
                  <small>{ticket.userTelefono}</small>
                </td>
                <td>
                  <strong>{ticket.asunto}</strong>
                  <span className={styles.description}>{ticket.descripcion}</span>
                </td>
                <td>{ticket.ubicacion}</td>
                <td>
                  <span 
                    className={styles.badge} 
                    style={getPrioridadStyle(ticket.prioridad)}
                  >
                    {ticket.prioridad}
                  </span>
                </td>
                <td>
                  <span className={styles.statusText} style={{
                    color: ticket.estado === 'abierto' ? '#d97706' : 
                           ticket.estado === 'en_proceso' ? '#2563eb' : '#059669'
                  }}>
                    ● {ticket.estado.replace('_', ' ').toUpperCase()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* RENDER DEL MODAL SI HAY TICKET SELECCIONADO */}
      {selectedTicket && (
        <TicketModal 
          ticket={selectedTicket} 
          onClose={() => setSelectedTicket(null)} 
          onUpdate={handleUpdateTicket}
        />
      )}
    </div>
  );
};

export default Dashboard;