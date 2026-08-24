import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useSocket } from '../../context/useSocket';
import ConfirmButton from '../../components/ConfirmButton';

interface Rol { id: number; nombre: string; codigoAcceso: string | null; }

export default function RolesPage() {
  const [roles, setRoles] = useState<Rol[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<Partial<Rol> | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState('');
  const { tick } = useSocket();

  useEffect(() => { load(); }, [tick]);

  async function load() {
    try { setRoles(await api.get<Rol[]>('/api/roles')); }
    catch { }
    finally { setLoading(false); }
  }

  async function handleSave() {
    if (!edit) return;
    setError('');
    const body = { nombre: edit.nombre, codigoAcceso: edit.codigoAcceso || null };
    if (!body.nombre) { setError('El nombre es requerido'); return; }
    try {
      if (edit.id) await api.patch(`/api/roles/${edit.id}`, body);
      else await api.post('/api/roles', body);
      setEdit(null); setShowNew(false);
      await load();
    } catch (e: any) { setError(e.message); }
  }

  async function handleDelete(id: number) {
    try { await api.delete(`/api/roles/${id}`); await load(); }
    catch (e: any) { setError(e.message); }
  }

  if (loading) return <p className="empty">Cargando...</p>;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>Roles</h2>
        <button className="btn btn-primary btn-sm" onClick={() => { setEdit({ nombre: '', codigoAcceso: '' }); setShowNew(true); setError(''); }}>
          Nuevo rol
        </button>
      </div>

      {error && <p className="sectores-error">{error}</p>}

      <table>
        <thead><tr><th>Nombre</th><th>Código de acceso</th><th></th></tr></thead>
        <tbody>
          {roles.map(r => (
            <tr key={r.id}>
              <td>{r.nombre}</td>
              <td style={{ fontFamily: 'monospace', fontSize: '.85rem' }}>{r.codigoAcceso || '— (libre)'}</td>
              <td>
                <button className="btn btn-ghost btn-sm" onClick={() => { setEdit(r); setError(''); }}>Editar</button>
                <ConfirmButton label="Borrar" danger message="¿Eliminar?" onConfirm={() => handleDelete(r.id)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {(edit || showNew) && (
        <div className="modal-overlay" onClick={() => { setEdit(null); setShowNew(false); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{edit?.id ? 'Editar rol' : 'Nuevo rol'}</h3>
            {error && <p className="sectores-error">{error}</p>}
            <div className="form-group">
              <label>Nombre del rol</label>
              <input className="input" value={edit?.nombre || ''} onChange={e => setEdit({ ...edit, nombre: e.target.value })} placeholder="Ej: Docente" />
            </div>
            <div className="form-group">
              <label>Código de acceso <span className="optional">(opcional — si está vacío, cualquiera puede unirse)</span></label>
              <input className="input" value={edit?.codigoAcceso || ''} onChange={e => setEdit({ ...edit, codigoAcceso: e.target.value })} placeholder="DIR-2026" />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => { setEdit(null); setShowNew(false); }}>Cancelar</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
