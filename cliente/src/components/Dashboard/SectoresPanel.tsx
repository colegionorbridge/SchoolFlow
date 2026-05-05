import React, { useState } from 'react';
import { useData } from '../../context/DataContext';
import styles from './Dashboard.module.css';

const SectoresPanel: React.FC = () => {
  const { sectores, crearSector, actualizarSector, eliminarSector, cargarSectores } = useData();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingSector, setEditingSector] = useState<any>(null);
  const [nombre, setNombre] = useState('');
  const [codigoAcceso, setCodigoAcceso] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setNombre('');
    setCodigoAcceso('');
    setEditingSector(null);
    setShowCreateForm(false);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      setError('El nombre es requerido');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (editingSector) {
        await actualizarSector(editingSector.id, {
          nombre: nombre.trim(),
          codigoAcceso: codigoAcceso.trim() || null
        });
      } else {
        await crearSector({
          nombre: nombre.trim(),
          codigoAcceso: codigoAcceso.trim() || null
        });
      }
      resetForm();
      await cargarSectores();
    } catch (err: any) {
      setError('Error al guardar sector');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (sector: any) => {
    setEditingSector(sector);
    setNombre(sector.nombre);
    setCodigoAcceso(sector.codigoAcceso || '');
    setShowCreateForm(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar este sector?')) return;
    
    try {
      await eliminarSector(id);
      await cargarSectores();
    } catch (err) {
      alert('Error al eliminar sector');
    }
  };

  return (
    <div className={styles.panelContainer}>
      <div className={styles.panelHeader}>
        <h2>Gestión de Sectores</h2>
        <button 
          className={styles.addActionButton}
          onClick={() => {
            resetForm();
            setShowCreateForm(!showCreateForm);
          }}
        >
          {showCreateForm ? 'Cancelar' : '+ Nuevo Sector'}
        </button>
      </div>

      {(showCreateForm || editingSector) && (
        <form onSubmit={handleSubmit} className={styles.createForm}>
          <h3>{editingSector ? 'Editar Sector' : 'Nuevo Sector'}</h3>
          
          <div className={styles.formGroup}>
            <label>Nombre:</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: INICIAL"
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Código de Acceso (opcional):</label>
            <input
              type="text"
              value={codigoAcceso}
              onChange={(e) => setCodigoAcceso(e.target.value)}
              placeholder="Dejar vacío si no requiere código"
              className={styles.input}
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.formActions}>
            <button type="button" onClick={resetForm} className={styles.cancelButton}>
              Cancelar
            </button>
            <button type="submit" disabled={loading} className={styles.saveButton}>
              {loading ? 'Guardando...' : (editingSector ? 'Actualizar' : 'Crear')}
            </button>
          </div>
        </form>
      )}

      <table className={styles.table}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Nombre</th>
            <th>Código</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {sectores.map(sector => (
            <tr key={sector.id}>
              <td>{sector.id}</td>
              <td>{sector.nombre}</td>
              <td>{sector.codigoAcceso || '-'}</td>
              <td>
                <button 
                  onClick={() => handleEdit(sector)}
                  className={styles.editButton}
                >
                  Editar
                </button>
                <button 
                  onClick={() => handleDelete(sector.id)}
                  className={styles.deleteButton}
                >
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
          {sectores.length === 0 && (
            <tr>
              <td colSpan={4} className={styles.emptyMessage}>
                No hay sectores registrados
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default SectoresPanel;
