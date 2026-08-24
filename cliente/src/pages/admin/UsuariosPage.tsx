import { useState, useEffect, useCallback } from 'react';
import { Search, Trash2, ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';
import { api } from '../../api/client';
import { useSocket } from '../../context/useSocket';
import ConfirmButton from '../../components/ConfirmButton';

interface User {
  telefono: string; nombreCompleto: string | null; email: string | null;
  roleId: number | null;
  rol: { id: number; nombre: string } | null;
  sectores: { id: number; nombre: string }[];
  registroCompleto: boolean; esAdmin: boolean; activo: boolean;
}

interface PaginatedResponse {
  data: User[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface Rol { id: number; nombre: string; }
interface Sector { id: number; nombre: string; }

const PAGE_SIZE = 20;

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<User[]>([]);
  const [roles, setRoles] = useState<Rol[]>([]);
  const [sectores, setSectores] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<User | null>(null);
  const [search, setSearch] = useState('');
  const [soloAdmin, setSoloAdmin] = useState(false);
  const [soloIncompleto, setSoloIncompleto] = useState(false);
  const [soloInactivo, setSoloInactivo] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState('nombreCompleto');
  const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('ASC');
  const { tick } = useSocket();

  function toggleSort(col: string) {
    if (sortBy === col) setSortDir(d => d === 'ASC' ? 'DESC' : 'ASC');
    else { setSortBy(col); setSortDir('ASC'); }
    setPage(1);
  }

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(PAGE_SIZE));
    if (search.trim()) params.set('search', search.trim());
    if (soloAdmin) params.set('esAdmin', 'true');
    if (soloIncompleto) params.set('registroIncompleto', 'true');
    if (soloInactivo) params.set('inactivo', 'true');
    params.set('sortBy', sortBy);
    params.set('sortDir', sortDir);

    Promise.all([
      api.get<PaginatedResponse>(`/api/usuarios?${params}`),
      api.get<Rol[]>('/api/roles'),
      api.get<Sector[]>('/api/sectores'),
    ])
      .then(([users, rs, ss]) => {
        setUsuarios(users.data);
        setTotal(users.total);
        setTotalPages(users.totalPages);
        if (users.totalPages > 0 && page > users.totalPages) setPage(users.totalPages);
        setRoles(rs);
        setSectores(ss);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [search, soloAdmin, soloIncompleto, soloInactivo, page, sortBy, sortDir]);

  useEffect(() => { load(); }, [load, tick]);

  function SortHeader({ col, label }: { col: string; label: string }) {
    const active = sortBy === col;
    return (
      <th onClick={() => toggleSort(col)} style={{ cursor: 'pointer', userSelect: 'none' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '.2rem' }}>
          {label}
          {active && (sortDir === 'ASC' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
        </span>
      </th>
    );
  }

  async function handleDelete(telefono: string) {
    setError('');
    try { await api.delete(`/api/usuarios/${telefono}`); await load(); }
    catch (e: any) { setError(e.message); }
  }

  async function handleSave() {
    if (!edit) return;
    setError('');
    try {
      await api.patch(`/api/usuarios/${edit.telefono}`, {
        nombreCompleto: edit.nombreCompleto,
        email: edit.email,
        roleId: edit.roleId,
        sectores: edit.sectores.map(s => s.id),
        esAdmin: edit.esAdmin,
        activo: edit.activo,
      });
      setEdit(null); await load();
    } catch (e: any) { setError(e.message); }
  }

  function toggleSector(id: number) {
    if (!edit) return;
    const yaTiene = edit.sectores.some(s => s.id === id);
    if (yaTiene) setEdit({ ...edit, sectores: edit.sectores.filter(s => s.id !== id) });
    else {
      const sector = sectores.find(s => s.id === id);
      if (sector) setEdit({ ...edit, sectores: [...edit.sectores, sector] });
    }
  }

  if (loading) return <p className="empty">Cargando...</p>;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '.5rem' }}>
        <h2>Usuarios</h2>
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input placeholder="Buscar..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              style={{ padding: '.4rem .6rem .4rem 1.7rem', borderRadius: 6, border: '1px solid var(--border)', fontSize: '.85rem', width: 200 }} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '.3rem', fontSize: '.85rem', cursor: 'pointer', padding: '.4rem .6rem', border: '1px solid var(--border)', borderRadius: 6, background: soloAdmin ? 'var(--bg)' : 'transparent' }}>
            <input type="checkbox" checked={soloAdmin} onChange={e => { setSoloAdmin(e.target.checked); setPage(1); }} /> Admin
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '.3rem', fontSize: '.85rem', cursor: 'pointer', padding: '.4rem .6rem', border: '1px solid var(--border)', borderRadius: 6, background: soloIncompleto ? 'var(--bg)' : 'transparent' }}>
            <input type="checkbox" checked={soloIncompleto} onChange={e => { setSoloIncompleto(e.target.checked); setPage(1); }} /> Registro pendiente
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '.3rem', fontSize: '.85rem', cursor: 'pointer', padding: '.4rem .6rem', border: '1px solid var(--border)', borderRadius: 6, background: soloInactivo ? 'var(--bg)' : 'transparent' }}>
            <input type="checkbox" checked={soloInactivo} onChange={e => { setSoloInactivo(e.target.checked); setPage(1); }} /> Inactivos
          </label>
        </div>
      </div>

      {error && <p style={{ color: 'var(--danger)', marginBottom: '1rem', fontSize: '.9rem' }}>{error}</p>}

      {usuarios.length === 0 ? (
        <p className="empty">{search || soloAdmin || soloIncompleto || soloInactivo ? 'No se encontraron usuarios con esos filtros.' : 'No hay usuarios'}</p>
      ) : (
        <>
          <div className="table-wrap"><table>
            <thead><tr>
              <SortHeader col="telefono" label="ID WhatsApp" />
              <SortHeader col="nombreCompleto" label="Nombre" />
              <th>Email</th>
              <SortHeader col="rol" label="Rol" />
              <th>Sectores</th>
              <SortHeader col="registroCompleto" label="Registro" />
              <SortHeader col="esAdmin" label="Admin" />
              <th></th><th></th>
            </tr></thead>
            <tbody>
              {usuarios.map(u => (
                <tr key={u.telefono}>
                  <td style={{ fontFamily: 'monospace', fontSize: '.85rem' }}>{u.telefono}</td>
                  <td>{u.nombreCompleto || '-'}</td>
                  <td style={{ fontSize: '.85rem' }}>{u.email || '-'}</td>
                  <td>{u.rol?.nombre || '-'}</td>
                  <td style={{ fontSize: '.85rem' }}>{u.sectores.map(s => s.nombre).join(', ') || '-'}</td>
                  <td>
                    <span className={`badge ${u.registroCompleto ? 'badge-cerrado' : 'badge-en_proceso'}`}>
                      {u.registroCompleto ? 'Completo' : 'Pendiente'}
                    </span>
                  </td>
                  <td>{u.esAdmin ? 'true' : 'false'}</td>
                  <td><button className="btn btn-ghost btn-sm" onClick={() => { setEdit(u); setError(''); }}>Editar</button></td>
                  <td>
                    <ConfirmButton label="" message={`¿Eliminar a ${u.nombreCompleto || u.telefono}?`} danger onConfirm={() => handleDelete(u.telefono)}>
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }}><Trash2 size={14} /></button>
                    </ConfirmButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', padding: '1rem 0' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}><ChevronLeft size={16} /></button>
              <span style={{ fontSize: '.85rem', color: 'var(--text-secondary)' }}>{page} de {totalPages} ({total} usuarios)</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}><ChevronRight size={16} /></button>
            </div>
          )}
        </>
      )}

      {edit && (
        <div className="modal-overlay" onClick={() => setEdit(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Editar {edit.telefono}</h3>
            {error && <p style={{ color: 'var(--danger)', marginBottom: '.5rem' }}>{error}</p>}

            <div className="form-group">
              <label>Nombre</label>
              <input className="input" value={edit.nombreCompleto || ''} onChange={e => setEdit({ ...edit, nombreCompleto: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input className="input" value={edit.email || ''} onChange={e => setEdit({ ...edit, email: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Rol</label>
              <select value={edit.roleId || ''} onChange={e => setEdit({ ...edit, roleId: Number(e.target.value) || null })}>
                <option value="">Sin rol</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Sectores</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem' }}>
                {sectores.map(s => (
                  <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '.3rem', fontSize: '.85rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={edit.sectores.some(x => x.id === s.id)} onChange={() => toggleSector(s.id)} />
                    {s.nombre}
                  </label>
                ))}
              </div>
            </div>
            <div style={{ marginTop: '.5rem', marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '.4rem', marginBottom: '.3rem', cursor: 'pointer', fontWeight: 400 }}>
                <input type="checkbox" checked={edit.esAdmin} onChange={e => setEdit({ ...edit, esAdmin: e.target.checked })} />
                Es administrador
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '.4rem', cursor: 'pointer', fontWeight: 400 }}>
                <input type="checkbox" checked={edit.activo} onChange={e => setEdit({ ...edit, activo: e.target.checked })} />
                Activo
              </label>
            </div>
            <div style={{ display: 'flex', gap: '.5rem' }}>
              <button className="btn btn-primary btn-sm" onClick={handleSave}>Guardar</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setEdit(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
