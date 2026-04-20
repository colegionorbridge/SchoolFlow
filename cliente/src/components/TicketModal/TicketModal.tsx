import React, { useState } from 'react';
import styles from './TicketModal.module.css';

interface TicketModalProps {
  ticket: any;
  onClose: () => void;
  onUpdate: (id: number, updates: any) => Promise<void>;
}

const TicketModal: React.FC<TicketModalProps> = ({ ticket, onClose, onUpdate }) => {
  const [estado, setEstado] = useState(ticket.estado);
  const [prioridad, setPrioridad] = useState(ticket.prioridad);
  const [nuevaNota, setNuevaNota] = useState(''); // Estado para la nota nueva
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Enviamos el estado, la prioridad y la nota si existe
      await onUpdate(ticket.id, { 
        estado, 
        prioridad, 
        nuevaNota: nuevaNota.trim() !== '' ? nuevaNota : null 
      });
      onClose();
    } catch (error) {
      console.error("Error al guardar:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Detalle Ticket #{ticket.id}</h2>
          <button onClick={onClose} className={styles.closeBtn}>&times;</button>
        </div>

        <div className={styles.body}>
          <section className={styles.infoGrid}>
            <div>
              <label>Solicitante</label>
              <p>{ticket.autor?.nombreCompleto || 'Desconocido'}</p>
              <small>{ticket.userTelefono}</small>
            </div>
            <div>
              <label>Ubicación</label>
              <p>{ticket.ubicacion}</p>
            </div>
          </section>

          <section className={styles.descriptionBox}>
            <label>Asunto</label>
            <h3>{ticket.asunto}</h3>
            <label>Descripción</label>
            <p>{ticket.descripcion}</p>
          </section>

          <div className={styles.actionGrid}>
            <div className={styles.selectWrapper}>
              <label>Estado</label>
              <select value={estado} onChange={(e) => setEstado(e.target.value)}>
                <option value="abierto">🟠 Abierto</option>
                <option value="en_proceso">🔵 En Proceso</option>
                <option value="cerrado">🟢 Cerrado</option>
              </select>
            </div>

            <div className={styles.selectWrapper}>
              <label>Prioridad</label>
              <select value={prioridad} onChange={(e) => setPrioridad(e.target.value)}>
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
              </select>
            </div>
          </div>

          <section className={styles.noteInputSection}>
            <label>Agregar Nota / Seguimiento</label>
            <textarea 
              placeholder="Escribe qué se hizo o alguna observación..."
              value={nuevaNota}
              onChange={(e) => setNuevaNota(e.target.value)}
              className={styles.textarea}
            />
          </section>

          <section className={styles.historySection}>
            <label>Historial de Notas</label>
            <div className={styles.timeline}>
              {ticket.historial && ticket.historial.length > 0 ? (
                ticket.historial.slice().reverse().map((h: any, i: number) => (
                  <div key={i} className={styles.noteCard}>
                    <div className={styles.noteMeta}>
                      <strong>{h.autor}</strong>
                      <span>{h.fecha}</span>
                    </div>
                    <p>{h.nota}</p>
                  </div>
                ))
              ) : (
                <p className={styles.emptyHistory}>Sin notas registradas.</p>
              )}
            </div>
          </section>
        </div>

        <div className={styles.footer}>
          <button onClick={onClose} className={styles.cancelBtn}>Cancelar</button>
          <button onClick={handleSave} className={styles.saveBtn} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TicketModal;