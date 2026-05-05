import React, { useState } from 'react';
import { useData } from '../../context/DataContext';
import styles from './Dashboard.module.css';

const RolesPanel: React.FC = () => {
  const { roles, crearRol, actualizarRol, eliminarRol, cargarRoles } = useData();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingRol, setEditingRol] = useState<any>(null);
  const [nombre, setNombre] = useState('');
  const [codigoAcceso, setCodigoAcceso] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setNombre('');
    setCodigoAcceso('');
    setEditingRol(null);
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
      if (editingRol) {
        await actualizarRol(editingRol.id, {
          nombre: nombre.trim(),
          codigoAcceso: codigoAcceso.trim() || null
        });
      } else {
        await crearRol({
          nombre: nombre.trim(),
          codigoAcceso: codigoAcceso.trim() || null
        });
      }
      resetForm();
      await cargarRoles();
    } catch (err: any) {
      setError('Error al guardar rol');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (rol: any) => {
    setEditingRol(rol);
    setNombre(rol.nombre);
    setCodigoAcceso(rol.codigoAcceso || '');
    setShowCreateForm(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar este rol?')) return;
    
    try {
      await eliminarRol(id);
      await cargarRoles();
    } catch (err) {
      alert('Error al eliminar rol');
    }
  };

  return (
    <div className={styles.panelContainer}>
      <div className={styles.panelHeader}>
        <h2>Gestión de Roles</h2>
        <button 
          className={styles.addActionButton}
          onClick={() => {
            resetForm();
            setShowCreateForm(!showCreateForm);
          }}
        >
          {showCreateForm ? 'Cancelar' : '+ Nuevo Rol'}
        </button>
      </div>

      {(showCreateForm || editingRol) && (
        <form onSubmit={handleSubmit} className={styles.createForm}>
          <h3>{editingRol ? 'Editar Rol' : 'Nuevo Rol'}</h3>
          
          <div className={styles.formGroup}>
            <label>Nombre:</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Docente"
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
              {loading ? 'Guardando...' : (editingRol ? 'Actualizar' : 'Crear')}
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
          {roles.map(rol => (
            <tr key={rol.id}>
              <td>{rol.id}</td>
              <td>{rol.nombre}</td>
              <td>{rol.codigoAcceso || '-'}</td>
              <td>
                <button 
                  onClick={() => handleEdit(rol)}
                  className={styles.editButton}
                >
                  Editar
                </button>
                <button 
                  onClick={() => handleDelete(rol.id)}
                  className={styles.deleteButton}
                >
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
          {roles.length === 0 && (
            <tr>
              <td colSpan={4} className={styles.emptyMessage}>
                No hay roles registrados
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default RolesPanel;
