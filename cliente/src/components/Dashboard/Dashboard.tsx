import React, { useEffect, useState, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import TicketModal from '../TicketModal/TicketModal';
import EditUserModal from './EditUserModal';
import SectoresPanel from './SectoresPanel';
import RolesPanel from './RolesPanel';
import StatsPanel from './StatsPanel';
import styles from './Dashboard.module.css';

const ORDEN_ESTADO = { 'abierto': 1, 'en_proceso': 2, 'cerrado': 3 };
const ORDEN_PRIORIDAD = { 'alta': 1, 'media': 2, 'baja': 3 };

type SortConfig = {
  key: string;
  direction: 'asc' | 'desc';
} | null;

const Dashboard: React.FC = () => {
  const { tickets, usuarios, loading, cargarDatosIniciales, cargarRoles, cargarSectores, crearTicketManual } = useData();
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'id', direction: 'desc' });
  
  // ESTADO PARA EL MODAL DE TICKET
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  
  // ESTADO PARA EL MODAL DE EDICIÓN DE USUARIO
  const [editingUser, setEditingUser] = useState<any | null>(null);
  
  // ESTADO PARA MOSTRAR PANEL DE USUARIOS
  const [showUsersPanel, setShowUsersPanel] = useState(false);
  
  // ESTADO PARA MOSTRAR PANEL DE SECTORES
  const [showSectoresPanel, setShowSectoresPanel] = useState(false);

  // ESTADO PARA MOSTRAR PANEL DE ROLES
  const [showRolesPanel, setShowRolesPanel] = useState(false);

  // ESTADO PARA MOSTRAR PANEL DE ESTADÍSTICAS
  const [showStatsPanel, setShowStatsPanel] = useState(false);

  // ESTADO PARA MODAL DE NUEVO TICKET MANUAL
  const [showNewTicketModal, setShowNewTicketModal] = useState(false);
  const [newTicket, setNewTicket] = useState({ asunto: '', descripcion: '', ubicacion: '', prioridad: 'media' });
  const [savingTicket, setSavingTicket] = useState(false);

  useEffect(() => {
    cargarDatosIniciales();
    cargarRoles();
    cargarSectores();
  }, []);

  // Función para mostrar solo un panel a la vez
  const handleShowUsers = () => {
    setShowUsersPanel(true);
    setShowSectoresPanel(false);
    setShowRolesPanel(false);
    setShowStatsPanel(false);
  };

  const handleShowSectores = () => {
    setShowSectoresPanel(true);
    setShowUsersPanel(false);
    setShowRolesPanel(false);
    setShowStatsPanel(false);
  };

  const handleShowRoles = () => {
    setShowRolesPanel(true);
    setShowUsersPanel(false);
    setShowSectoresPanel(false);
    setShowStatsPanel(false);
  };

  const handleShowStats = () => {
    setShowStatsPanel(true);
    setShowUsersPanel(false);
    setShowSectoresPanel(false);
    setShowRolesPanel(false);
  };

  // Mostrar tickets cuando no hay ningún panel abierto
  const showTickets = !showUsersPanel && !showSectoresPanel && !showRolesPanel && !showStatsPanel;

  // Función para mostrar solo tickets
  const handleShowTickets = () => {
    setShowUsersPanel(false);
    setShowSectoresPanel(false);
    setShowRolesPanel(false);
    setShowStatsPanel(false);
  };

  // Función para crear ticket manual
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicket.asunto.trim() || !newTicket.descripcion.trim() || !newTicket.ubicacion.trim()) return;
    setSavingTicket(true);
    try {
      await crearTicketManual(newTicket);
      setShowNewTicketModal(false);
      setNewTicket({ asunto: '', descripcion: '', ubicacion: '', prioridad: 'media' });
    } catch {
      alert('No se pudo crear el ticket.');
    } finally {
      setSavingTicket(false);
    }
  };

  // Función para actualizar el ticket en el servidor
  const handleUpdateTicket = async (id: number, updates: any) => {
    const API_URL = import.meta.env.VITE_API_URL;
    const token = localStorage.getItem('token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    try {
      const res = await fetch(`${API_URL}/api/tickets/${id}`, {
        method: 'PATCH',
        headers,
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
        <div className={styles.headerActions}>
          <div className={styles.statusBadge}>
            <span className={styles.onlineDot}></span> Servidor: Online
          </div>
          <button 
            onClick={() => handleShowTickets()}
            className={`${styles.navButton} ${showTickets ? styles.activeNavButton : ''}`}
          >
            Tickets
          </button>
          <button 
            onClick={() => {
              handleShowUsers();
            }}
            className={`${styles.navButton} ${showUsersPanel ? styles.activeNavButton : ''}`}
          >
            Usuarios
          </button>
          <button 
            onClick={() => {
              handleShowSectores();
            }}
            className={`${styles.navButton} ${showSectoresPanel ? styles.activeNavButton : ''}`}
          >
            Sectores
          </button>
          <button 
            onClick={() => {
              handleShowRoles();
            }}
            className={`${styles.navButton} ${showRolesPanel ? styles.activeNavButton : ''}`}
          >
            Roles
          </button>
          <button 
            onClick={() => {
              handleShowStats();
            }}
            className={`${styles.navButton} ${showStatsPanel ? styles.activeNavButton : ''}`}
          >
            Estadísticas
          </button>
          <button 
            onClick={() => setShowNewTicketModal(true)}
            className={styles.newTicketButton}
          >
            + Nuevo Ticket
          </button>
          <button 
            onClick={() => {
              localStorage.removeItem('token');
              window.location.href = '/login';
            }}
            className={styles.logoutButton}
          >
            Cerrar Sesión
          </button>
        </div>
      </header>

      {/* PANEL DE USUARIOS */}
      {showUsersPanel && (
        <div className={styles.panelContainer}>
          <div className={styles.panelHeader}>
            <h2>Gestión de Usuarios</h2>
            <button onClick={() => setShowUsersPanel(false)} className={styles.closePanelButton}>
              ×
            </button>
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Teléfono</th>
                <th>Nombre</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Sector</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map(usuario => (
                <tr key={usuario.telefono}>
                  <td>{usuario.telefono}</td>
                  <td>{usuario.nombreCompleto || 'Sin nombre'}</td>
                  <td>{usuario.email || '-'}</td>
                  <td>{usuario.rol?.nombre || 'Sin rol'}</td>
                  <td>{usuario.sectores?.map(s => s.nombre).join(', ') || 'Sin sector'}</td>
                  <td>
                    <button 
                      onClick={() => {
                        setEditingUser(usuario);
                        setShowSectoresPanel(false);
                      }}
                      className={styles.editButton}
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* PANEL DE SECTORES */}
      {showSectoresPanel && <SectoresPanel />}

      {/* PANEL DE ROLES */}
      {showRolesPanel && <RolesPanel />}

      {/* PANEL DE ESTADÍSTICAS */}
      {showStatsPanel && <StatsPanel />}

      {/* SECCIÓN DE TICKETS - Solo se muestra cuando no hay paneles abiertos */}
      {showTickets && (
        <>
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
                      <strong>{ticket.origen === 'manual' ? 'ADMIN' : (ticket.autor?.nombreCompleto || 'Desconocido')}</strong><br />
                      <small>{ticket.origen === 'manual' ? 'Carga manual' : ticket.userTelefono}</small>
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
                      {ticket.origen === 'manual' && (
                        <span className={styles.manualBadge} title="Ticket creado manualmente">✍</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
      {selectedTicket && (
        <TicketModal 
          ticket={selectedTicket} 
          onClose={() => setSelectedTicket(null)} 
          onUpdate={handleUpdateTicket}
        />
      )}

      {/* MODAL DE EDICIÓN DE USUARIO */}
      {editingUser && (
        <EditUserModal 
          user={editingUser} 
          onClose={() => setEditingUser(null)} 
        />
      )}

      {/* MODAL NUEVO TICKET MANUAL */}
      {showNewTicketModal && (
        <div className={styles.modalOverlay} onClick={() => setShowNewTicketModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Nuevo Ticket Manual</h2>
              <button onClick={() => setShowNewTicketModal(false)} className={styles.closeButton}>×</button>
            </div>
            <form onSubmit={handleCreateTicket} className={styles.form}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Asunto *</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={newTicket.asunto}
                  onChange={(e) => setNewTicket({ ...newTicket, asunto: e.target.value })}
                  placeholder="Ej: Cambio de toner en administración"
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Descripción *</label>
                <textarea
                  className={styles.formTextarea}
                  rows={4}
                  value={newTicket.descripcion}
                  onChange={(e) => setNewTicket({ ...newTicket, descripcion: e.target.value })}
                  placeholder="Detallá el problema o la tarea realizada..."
                  required
                />
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Ubicación *</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={newTicket.ubicacion}
                    onChange={(e) => setNewTicket({ ...newTicket, ubicacion: e.target.value })}
                    placeholder="Ej: PRIMARIA - Aula 3A"
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Prioridad</label>
                  <select
                    className={styles.formSelect}
                    value={newTicket.prioridad}
                    onChange={(e) => setNewTicket({ ...newTicket, prioridad: e.target.value })}
                  >
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                  </select>
                </div>
              </div>
              <div className={styles.formActions}>
                <button type="button" onClick={() => setShowNewTicketModal(false)} className={styles.cancelButton}>
                  Cancelar
                </button>
                <button type="submit" disabled={savingTicket} className={styles.saveButton}>
                  {savingTicket ? 'Creando...' : 'Crear Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;