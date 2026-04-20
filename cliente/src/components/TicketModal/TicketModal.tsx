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
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onUpdate(ticket.id, { estado, prioridad });
    setSaving(false);
    onClose();
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>Detalle Ticket #{ticket.id}</h2>
          <button onClick={onClose} className={styles.closeBtn}>&times;</button>
        </div>

        <div className={styles.body}>
          <section className={styles.info}>
            <p><strong>Solicitante:</strong> {ticket.autor?.nombreCompleto} ({ticket.userTelefono})</p>
            <p><strong>Ubicación:</strong> {ticket.ubicacion}</p>
            <p><strong>Asunto:</strong> {ticket.asunto}</p>
            <p><strong>Descripción:</strong> {ticket.descripcion}</p>
          </section>

          <hr />

          <div className={styles.controls}>
            <div className={styles.controlGroup}>
              <label>Estado</label>
              <select value={estado} onChange={(e) => setEstado(e.target.value)}>
                <option value="abierto">Abierto</option>
                <option value="en_proceso">En Proceso</option>
                <option value="cerrado">Cerrado</option>
              </select>
            </div>

            <div className={styles.controlGroup}>
              <label>Prioridad</label>
              <select value={prioridad} onChange={(e) => setPrioridad(e.target.value)}>
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
              </select>
            </div>
          </div>

          <section className={styles.history}>
            <h3>Historial / Notas</h3>
            <div className={styles.timeline}>
              {ticket.historial && ticket.historial.length > 0 ? (
                ticket.historial.map((h: any, i: number) => (
                  <div key={i} className={styles.note}>
                    <small>{h.fecha} - <strong>{h.autor}</strong></small>
                    <p>{h.nota}</p>
                  </div>
                ))
              ) : (
                <p className={styles.empty}>No hay notas aún.</p>
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