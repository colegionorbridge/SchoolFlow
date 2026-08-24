import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { useSocket } from '../context/useSocket';

interface Ticket {
  id: number; asunto: string; descripcion: string; ubicacion: string;
  estado: string; prioridad: string; origen: string; createdAt: string;
  tecnicoAsignado: string | null;
  autor: { nombreCompleto: string | null; telefono: string } | null;
}

interface PaginatedResponse {
  data: Ticket[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const ESTADOS = ['abierto', 'en_proceso', 'cerrado'];
const PRIORIDADES = ['baja', 'media', 'alta'];
const PAGE_SIZE = 20;

export default function TicketsList() {
  const { user } = useAuth();
  const { tick } = useSocket();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroPrioridad, setFiltroPrioridad] = useState('');
  const [soloMios, setSoloMios] = useState(false);
  const [soloManuales, setSoloManuales] = useState(false);
  const [search, setSearch] = useState('');
  const [sinAsignar, setSinAsignar] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('DESC');

  function toggleSort(col: string) {
    if (sortBy === col) setSortDir(d => d === 'ASC' ? 'DESC' : 'ASC');
    else { setSortBy(col); setSortDir('DESC'); }
    setPage(1);
  }

  const fetchTickets = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(PAGE_SIZE));
    if (filtroEstado) params.set('estado', filtroEstado);
    if (filtroPrioridad) params.set('prioridad', filtroPrioridad);
    if (soloMios && user?.nombre) params.set('tecnicoAsignado', user.nombre);
    if (soloManuales) params.set('origen', 'manual');
    if (sinAsignar) params.set('sinAsignar', 'true');
    if (search.trim()) params.set('search', search.trim());
    params.set('sortBy', sortBy);
    params.set('sortDir', sortDir);
    api.get<PaginatedResponse>(`/api/tickets?${params}`)
      .then(res => {
        setTickets(res.data);
        setTotal(res.total);
        setTotalPages(res.totalPages);
        if (res.totalPages > 0 && page > res.totalPages) setPage(res.totalPages);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filtroEstado, filtroPrioridad, soloMios, soloManuales, sinAsignar, search, page, user?.nombre, sortBy, sortDir]);

  useEffect(() => { fetchTickets(); }, [fetchTickets, tick]);

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

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '.5rem' }}>
        <h2 style={{ margin: 0 }}>Tickets</h2>
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input type="text" placeholder="Buscar..." value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              style={{ padding: '.4rem .6rem .4rem 1.7rem', borderRadius: 6, border: '1px solid var(--border)', fontSize: '.85rem', width: 200 }} />
          </div>
          <select value={filtroEstado} onChange={e => { setFiltroEstado(e.target.value); setPage(1); }} style={{ padding: '.4rem .6rem', borderRadius: 6, border: '1px solid var(--border)' }}>
            <option value="">Todos los estados</option>
            {ESTADOS.map(e => <option key={e} value={e}>{e.replace('_', ' ')}</option>)}
          </select>
          <select value={filtroPrioridad} onChange={e => { setFiltroPrioridad(e.target.value); setPage(1); }} style={{ padding: '.4rem .6rem', borderRadius: 6, border: '1px solid var(--border)' }}>
            <option value="">Todas las prioridades</option>
            {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: '.3rem', fontSize: '.85rem', cursor: 'pointer', padding: '.4rem .6rem', border: '1px solid var(--border)', borderRadius: 6, background: soloMios ? 'var(--bg)' : 'transparent' }}>
            <input type="checkbox" checked={soloMios} onChange={e => { setSoloMios(e.target.checked); setPage(1); }} />
            Mis tickets
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '.3rem', fontSize: '.85rem', cursor: 'pointer', padding: '.4rem .6rem', border: '1px solid var(--border)', borderRadius: 6, background: soloManuales ? 'var(--bg)' : 'transparent' }}>
            <input type="checkbox" checked={soloManuales} onChange={e => { setSoloManuales(e.target.checked); setPage(1); }} />
            Manuales
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '.3rem', fontSize: '.85rem', cursor: 'pointer', padding: '.4rem .6rem', border: '1px solid var(--border)', borderRadius: 6, background: sinAsignar ? 'var(--bg)' : 'transparent' }}>
            <input type="checkbox" checked={sinAsignar} onChange={e => { setSinAsignar(e.target.checked); setPage(1); }} />
            Sin técnico
          </label>
        </div>
      </div>

      {loading ? (
        <div className="empty"><span className="spinner" /><br />Cargando tickets...</div>
      ) : tickets.length === 0 ? (
        <p className="empty">{search || filtroEstado || filtroPrioridad || soloMios || soloManuales || sinAsignar ? 'No se encontraron tickets con esos filtros.' : 'No hay tickets'}</p>
      ) : (
        <>
          <div className="table-wrap"><table>
            <thead>
              <tr>
                <SortHeader col="id" label="#" />
                <SortHeader col="asunto" label="Asunto" />
                <th>Solicitante</th>
                <th>Ubicación</th>
                <SortHeader col="estado" label="Estado" />
                <SortHeader col="prioridad" label="Prioridad" />
                <SortHeader col="tecnicoAsignado" label="Técnico" />
                <SortHeader col="createdAt" label="Fecha" />
              </tr>
            </thead>
            <tbody>
              {tickets.map(t => (
                <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/tickets/${t.id}`)}>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '.85rem' }}>#{t.id}</td>
                  <td style={{ fontWeight: 500 }}>{t.asunto}</td>
                  <td>{t.origen === 'manual' ? <span className="badge badge-baja">Manual</span> : (t.autor?.nombreCompleto || t.autor?.telefono || '—')}</td>
                  <td style={{ fontSize: '.85rem' }}>{t.ubicacion}</td>
                  <td><span className={`badge badge-${t.estado}`}>{t.estado.replace('_', ' ')}</span></td>
                  <td><span className={`badge badge-${t.prioridad}`}>{t.prioridad}</span></td>
                  <td style={{ fontSize: '.85rem' }}>{t.tecnicoAsignado || '—'}</td>
                  <td style={{ fontSize: '.85rem', color: 'var(--text-secondary)' }}>
                    {new Date(t.createdAt).toLocaleDateString('es-AR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', padding: '1rem 0' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}><ChevronLeft size={16} /></button>
              <span style={{ fontSize: '.85rem', color: 'var(--text-secondary)' }}>{page} de {totalPages} ({total} tickets)</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}><ChevronRight size={16} /></button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
