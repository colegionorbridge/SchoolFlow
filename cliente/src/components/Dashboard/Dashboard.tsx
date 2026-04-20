import React, { useEffect } from 'react';
import { useData } from '../../context/DataContext';
import styles from './Dashboard.module.css'; // Importación del module

const Dashboard: React.FC = () => {
  const { tickets, usuarios, loading, cargarDatosIniciales } = useData();

  useEffect(() => {
    cargarDatosIniciales();
  }, []);

  if (loading && tickets.length === 0) {
    return (
      <div className={styles.loadingContainer}>
        <p>Conectando con el servidor de Colegio Norbridge...</p>
      </div>
    );
  }

  // Helper para el color de prioridad (mantenemos lógica en TS)
  const getPrioridadStyle = (p: string) => {
    switch (p) {
      case 'alta': return { backgroundColor: '#fee2e2', color: '#991b1b' };
      case 'media': return { backgroundColor: '#fef3c7', color: '#92400e' };
      default: return { backgroundColor: '#f3f4f6', color: '#374151' };
    }
  };

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
              <th>ID</th>
              <th>Solicitante</th>
              <th>Asunto / Descripción</th>
              <th>Ubicación</th>
              <th>Prioridad</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => (
              <tr key={ticket.id} className={styles.row}>
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
                    color: ticket.estado === 'abierto' ? '#d97706' : '#059669'
                  }}>
                    ● {ticket.estado.toUpperCase()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
};

export default Dashboard;