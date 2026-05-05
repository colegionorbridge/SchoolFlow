import React, { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import styles from './Dashboard.module.css';

interface EditUserModalProps {
  user: any;
  onClose: () => void;
}

const EditUserModal: React.FC<EditUserModalProps> = ({ user, onClose }) => {
  const { actualizarUsuario, roles, cargarRoles } = useData();
  const [nombreCompleto, setNombreCompleto] = useState(user.nombreCompleto || '');
  const [email, setEmail] = useState(user.email || '');
  const [roleId, setRoleId] = useState(user.rol?.id || '');
  const [selectedSectores, setSelectedSectores] = useState<number[]>(
    user.sectores?.map((s: any) => s.id) || []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    cargarRoles();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await actualizarUsuario(user.telefono, {
        nombreCompleto,
        email: email || null,
        roleId: roleId ? parseInt(roleId) : null,
        sectores: selectedSectores
      });
      onClose();
    } catch (err: any) {
      setError('Error al actualizar usuario');
    } finally {
      setLoading(false);
    }
  };

  const handleSectorChange = (sectorId: number) => {
    setSelectedSectores(prev => 
      prev.includes(sectorId) 
        ? prev.filter(id => id !== sectorId)
        : [...prev, sectorId]
    );
  };

  const availableSectores = [
    { id: 1, nombre: 'INICIAL (Jardín)' },
    { id: 2, nombre: 'PRIMARIA' },
    { id: 3, nombre: 'SECUNDARIA' },
    { id: 4, nombre: 'SECTOR COMUN' }
  ];

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Editar Usuario</h2>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className={styles.modalForm}>
          <div className={styles.formGroup}>
            <label>Teléfono:</label>
            <input type="text" value={user.telefono} disabled className={styles.input} />
          </div>

          <div className={styles.formGroup}>
            <label>Nombre Completo:</label>
            <input 
              type="text" 
              value={nombreCompleto} 
              onChange={(e) => setNombreCompleto(e.target.value)}
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Email Institucional:</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Rol:</label>
            <select 
              value={roleId} 
              onChange={(e) => setRoleId(e.target.value)}
              className={styles.input}
            >
              <option value="">Sin rol</option>
              {roles.map((rol: any) => (
                <option key={rol.id} value={rol.id}>{rol.nombre}</option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label>Sectores:</label>
            <div className={styles.checkboxGroup}>
              {availableSectores.map(sector => (
                <label key={sector.id} className={styles.checkboxLabel}>
                  <input 
                    type="checkbox"
                    checked={selectedSectores.includes(sector.id)}
                    onChange={() => handleSectorChange(sector.id)}
                  />
                  {sector.nombre}
                </label>
              ))}
            </div>
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.modalActions}>
            <button type="button" onClick={onClose} className={styles.cancelButton}>
              Cancelar
            </button>
            <button type="submit" disabled={loading} className={styles.saveButton}>
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditUserModal;
