import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/useSocket';
import {
  ClipboardCheck, CircleCheckBig, UserPlus, RotateCcw, User,
  MapPin, Calendar, Clock, UserCheck, ArrowLeft, MessageCircle, Send,
} from 'lucide-react';
import { api } from '../api/client';
import ConfirmButton from '../components/ConfirmButton';

interface Ticket {
  id: number; asunto: string; descripcion: string; ubicacion: string;
  estado: string; prioridad: string; origen: string;
  tecnicoAsignado: string | null; solucion: string | null;
  historial: any[]; createdAt: string;
  autor: { nombreCompleto: string | null; telefono: string; rol?: { nombre: string } | null } | null;
}

interface Tecnico { id: string; nombre: string; }
interface Msg { id: number; mensaje: string; direccion: string; createdAt: string; }

const ESTADO_LABEL: Record<string, string> = { abierto: 'Abierto', en_proceso: 'En proceso', cerrado: 'Cerrado' };

function formatFecha(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
    ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

interface ChatMsg { direccion: 'inbound' | 'outbound' | 'admin'; mensaje: string; createdAt: string; autor?: string; }

export default function TicketDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { ticketActualizado, socketRef } = useSocket();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [loading, setLoading] = useState(true);
  const [solucion, setSolucion] = useState('');
  const [error, setError] = useState('');
  const [techSel, setTechSel] = useState('');
  const [saving, setSaving] = useState(false);
  const ticketRef = useRef(ticket);
  useEffect(() => { ticketRef.current = ticket; }, [ticket]);
  const [conversacion, setConversacion] = useState<Msg[]>([]);
  const [tab, setTab] = useState<'historial' | 'chat'>('historial');

  const [chatActivo, setChatActivo] = useState(false);
  const [chatAdminNombre, setChatAdminNombre] = useState('');
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [chatEnviando, setChatEnviando] = useState(false);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMsgs, tab]);

  useEffect(() => {
    Promise.all([
      api.get<Ticket>(`/api/tickets/${id}`),
      api.get<Tecnico[]>('/api/auth/admins'),
    ]).then(([t, a]) => { setTicket(t); setTecnicos(a); })
      .catch(() => {})
      .finally(() => setLoading(false));

    api.get<Msg[]>(`/api/tickets/${id}/conversacion`)
      .then(setConversacion)
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    if (ticketActualizado && ticketActualizado.id === Number(id)) {
      setTicket(ticketActualizado as unknown as Ticket);
    }
  }, [ticketActualizado, id]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !id) return;

    function onMensaje(data: any) {
      if (data.userTelefono === ticket?.autor?.telefono) {
        setChatMsgs(prev => [...prev, { direccion: 'inbound', mensaje: data.mensaje, createdAt: data.timestamp }]);
      }
    }

    function onEstado(data: any) {
      if (data.ticketId === Number(id)) {
        setChatActivo(data.estado === 'activo');
        setChatAdminNombre(data.admin || '');
      }
    }

    socket.on('chat-mensaje-entrante', onMensaje);
    socket.on('chat-estado', onEstado);

    return () => {
      socket.off('chat-mensaje-entrante', onMensaje);
      socket.off('chat-estado', onEstado);
    };
  }, [socketRef, id, ticket?.autor?.telefono]);

  useEffect(() => {
    if (!id) return;
    api.get<{ activo: boolean; admin: string | null }>(`/api/tickets/${id}/chat`)
      .then(({ activo, admin }) => { setChatActivo(activo); setChatAdminNombre(admin || ''); })
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    if (conversacion.length > 0) {
      setChatMsgs(conversacion.map(m => ({
        direccion: m.direccion as 'inbound' | 'outbound',
        mensaje: m.mensaje,
        createdAt: m.createdAt,
      })));
    }
  }, [conversacion]);

  async function patch(payload: Record<string, any>) {
    setError('');
    setSaving(true);
    const prev = ticketRef.current;
    try { setTicket(await api.patch<Ticket>(`/api/tickets/${id}`, payload)); }
    catch (e: any) {
      setError(e.message);
      if (prev && payload.estado && payload.estado !== prev.estado) setTicket(prev);
    }
    finally { setSaving(false); }
  }

  async function adoptar() {
    patch({ estado: 'en_proceso', tecnicoAsignado: user?.nombre || user?.telefono || 'Admin' });
  }

  async function derivar() {
    if (!techSel) return;
    patch({ estado: 'en_proceso', tecnicoAsignado: techSel });
  }

  async function cerrar() {
    if (!solucion.trim()) return;
    setError('');
    try {
      setTicket(await api.patch<Ticket>(`/api/tickets/${id}`, { estado: 'cerrado', solucion: solucion.trim() }));
      setSolucion('');
    } catch (e: any) { setError(e.message); }
  }

  async function tomarControl() {
    try {
      await api.post(`/api/tickets/${id}/chat/iniciar`);
      setChatActivo(true);
      setChatAdminNombre(user?.nombre || 'Técnico');
    } catch (e: any) { setError(e.message); }
  }

  async function enviarChatMsg(txt?: string) {
    const mensaje = (txt || chatInput).trim();
    if (!mensaje || chatEnviando) return;
    if (!txt) setChatInput('');
    setChatEnviando(true);
    try {
      const res = await api.post<{ ok: boolean; mensaje: string; autor: string; timestamp: string }>(`/api/tickets/${id}/chat/enviar`, { mensaje });
      const displayText = `💬 *Técnico ${user?.nombre || 'Admin'}:* ${mensaje}`;
      setChatMsgs(prev => [...prev, { direccion: 'admin', mensaje: displayText, createdAt: res.timestamp, autor: res.autor }]);
    } catch (e: any) { setError(e.message); }
    finally { setChatEnviando(false); }
  }

  async function devolverControl() {
    try {
      await api.post(`/api/tickets/${id}/chat/finalizar`);
      setChatActivo(false);
      setChatAdminNombre('');
    } catch (e: any) { setError(e.message); }
  }

  if (loading) return <div className="empty"><span className="spinner" /><br />Cargando ticket...</div>;
  if (!ticket) return <p className="empty">Ticket no encontrado</p>;

  const puedeActuar = user?.esAdmin && (ticket.estado === 'abierto' || (!ticket.tecnicoAsignado && ticket.estado !== 'cerrado'));
  const puedeCerrar = user?.esAdmin && ticket.estado === 'en_proceso' && ticket.tecnicoAsignado === (user?.nombre || user?.telefono);
  const puedeReabrir = user?.superAdmin && ticket.estado === 'cerrado';
  const soyElTecnico = ticket.tecnicoAsignado && ticket.tecnicoAsignado === (user?.nombre || user?.telefono);
  const historial: any[] = Array.isArray(ticket.historial) ? [...ticket.historial].reverse() : [];

  return (
    <div style={{ maxWidth: 780, margin: '0 auto' }}>
      <button className="btn btn-ghost btn-sm" onClick={() => navigate('/tickets')} style={{ marginBottom: '1.5rem' }}>
        <ArrowLeft size={16} /> Volver a tickets
      </button>

      {error && <p style={{ color: 'var(--danger)', marginBottom: '1rem', fontSize: '.9rem' }}>{error}</p>}

      <div className="card" style={{ marginBottom: '1.5rem', padding: '2rem' }}>
        <div style={{ marginBottom: '1.2rem' }}>
          <div style={{ fontSize: '.8rem', color: 'var(--text-secondary)', marginBottom: '.2rem' }}>Ticket #{ticket.id}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>{ticket.asunto}</h2>
            {saving && <span style={{ fontSize: '.75rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>guardando...</span>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '.75rem', marginBottom: '1.2rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: '.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1 }}>Estado</span>
            <span className={`badge badge-${ticket.estado}`} style={{ alignSelf: 'flex-start' }}>{ESTADO_LABEL[ticket.estado]}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: '.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1 }}>Prioridad</span>
            <span className={`badge badge-${ticket.prioridad}`} style={{ alignSelf: 'flex-start', fontWeight: 700 }}>{ticket.prioridad.toUpperCase()}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: '.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1 }}>Origen</span>
            <span className="badge badge-baja" style={{ alignSelf: 'flex-start' }}>{ticket.origen === 'manual' ? 'Manual' : 'WhatsApp'}</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem', padding: '1rem', background: 'var(--bg)', borderRadius: 8, marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontSize: '.85rem' }}>
            <MapPin size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
            <div><div style={{ fontSize: '.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Ubicación</div><div style={{ fontWeight: 600 }}>{ticket.ubicacion}</div></div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontSize: '.85rem' }}>
            <Calendar size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
            <div><div style={{ fontSize: '.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Fecha</div><div style={{ fontWeight: 600 }}>{formatFecha(ticket.createdAt)}</div></div>
          </div>
        </div>

        <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: '.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: '.4rem' }}>Descripción del problema</div>
          <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, margin: 0, fontSize: '.95rem' }}>{ticket.descripcion}</p>
        </div>

        <div style={{ display: 'flex', gap: '2rem', fontSize: '.85rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
            <User size={14} />
            <span>Reportado por:</span>
            <span style={{ fontWeight: 600, color: 'var(--text)' }}>{ticket.autor?.nombreCompleto || (ticket.origen === 'manual' ? 'Carga manual' : ticket.autor?.telefono)}</span>
          </div>
          {ticket.autor?.rol && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
              <span>Rol:</span>
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>{ticket.autor.rol.nombre}</span>
            </div>
          )}
          {ticket.tecnicoAsignado && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
              <UserCheck size={14} />
              <span>Técnico asignado:</span>
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>{ticket.tecnicoAsignado}</span>
            </div>
          )}
        </div>
      </div>

      {user?.esAdmin && (
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem 2rem' }}>
          <div style={{ fontSize: '.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: '1rem' }}>Acciones de administrador</div>

          {user?.superAdmin && (
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '1.2rem' }}>
              <div>
                <label style={{ fontWeight: 600, fontSize: '.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '.2rem' }}>Estado</label>
                <select value={ticket.estado} onChange={e => patch({ estado: e.target.value })}>
                  <option value="abierto">Abierto</option>
                  <option value="en_proceso">En proceso</option>
                  <option value="cerrado">Cerrado</option>
                </select>
              </div>
              <div>
                <label style={{ fontWeight: 600, fontSize: '.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '.2rem' }}>Prioridad</label>
                <select value={ticket.prioridad} onChange={e => patch({ prioridad: e.target.value })}>
                  <option value="baja">Baja</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                </select>
              </div>
              {!puedeActuar && (
                <div>
                  <label style={{ fontWeight: 600, fontSize: '.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '.2rem' }}>Técnico</label>
                  <select value={ticket.tecnicoAsignado || ''} onChange={e => patch({ tecnicoAsignado: e.target.value || null })}>
                    <option value="">— Sin asignar —</option>
                    {tecnicos.map(t => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}
          {puedeActuar && (
            <div style={{ display: 'flex', gap: '.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={adoptar}><ClipboardCheck size={18} /> Adoptar caso</button>
              {user?.superAdmin && (
                <>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '.85rem' }}>o</span>
                  <select value={techSel} onChange={e => setTechSel(e.target.value)} style={{ width: 160 }}>
                    <option value="">Derivar a...</option>
                    {tecnicos.map(t => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
                  </select>
                  <button className="btn btn-primary" onClick={derivar} disabled={!techSel}><UserPlus size={18} /></button>
                </>
              )}
            </div>
          )}
          {puedeCerrar && (
            <div>
              <div className="form-group" style={{ marginBottom: '.75rem' }}>
                <label>Solución</label>
                <textarea value={solucion} onChange={e => setSolucion(e.target.value)} placeholder="Describí cómo se resolvió el problema..." rows={3} style={{ width: '100%', padding: '.6rem', borderRadius: 6, border: '1px solid var(--border)', resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: '.5rem' }}>
                <button className="btn btn-primary" onClick={cerrar} disabled={!solucion.trim()}><CircleCheckBig size={18} /> Cerrar ticket</button>
                <ConfirmButton label="Dejar caso" message="¿Desvincularte del ticket?" danger onConfirm={() => patch({ tecnicoAsignado: null, estado: 'abierto' })} />
              </div>
            </div>
          )}
          {puedeReabrir && (
            <div style={{ marginTop: '.5rem' }}>
              <button className="btn btn-primary" onClick={() => patch({ estado: 'abierto' })}><RotateCcw size={18} /> Reabrir ticket</button>
            </div>
          )}
          {soyElTecnico && ticket.estado === 'en_proceso' && !puedeCerrar && (
            <ConfirmButton label="Dejar caso" message="¿Desvincularte del ticket?" danger onConfirm={() => patch({ tecnicoAsignado: null, estado: 'abierto' })} />
          )}
        </div>
      )}

      {ticket.solucion && (
        <div className="card" style={{ marginBottom: '1.5rem', background: '#f0fdf4', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', color: 'var(--success)', marginBottom: '.5rem' }}>
            <CircleCheckBig size={18} /><h3 style={{ margin: 0, fontSize: '1rem' }}>Solución</h3>
          </div>
          <p style={{ whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.7, fontSize: '.95rem' }}>{ticket.solucion}</p>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          <button onClick={() => setTab('historial')} style={{ flex: 1, padding: '.8rem', border: 'none', background: tab === 'historial' ? 'var(--surface)' : 'var(--bg)', fontWeight: 600, fontSize: '.9rem', cursor: 'pointer', color: tab === 'historial' ? 'var(--text)' : 'var(--text-secondary)', borderBottom: tab === 'historial' ? '2px solid var(--primary)' : '2px solid transparent' }}>
            <Clock size={14} style={{ marginBottom: -2, marginRight: 6 }} /> Historial
          </button>
          <button onClick={() => setTab('chat')} style={{ flex: 1, padding: '.8rem', border: 'none', background: tab === 'chat' ? 'var(--surface)' : 'var(--bg)', fontWeight: 600, fontSize: '.9rem', cursor: 'pointer', color: tab === 'chat' ? 'var(--text)' : 'var(--text-secondary)', borderBottom: tab === 'chat' ? '2px solid var(--primary)' : '2px solid transparent' }}>
            <MessageCircle size={14} style={{ marginBottom: -2, marginRight: 6 }} /> Conversación
          </button>
        </div>

        {tab === 'historial' && (
          <div style={{ padding: '1.5rem' }}>
            {historial.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem' }}>Sin historial registrado.</p>
            ) : (
              <div style={{ position: 'relative', paddingLeft: '1rem' }}>
                <div style={{ position: 'absolute', left: 4, top: 4, bottom: 4, width: 2, background: 'var(--border)' }} />
                {historial.map((h, i) => (
                  <div key={i} style={{ position: 'relative', paddingLeft: '1.2rem', paddingBottom: i < historial.length - 1 ? '1rem' : 0 }}>
                    <div style={{ position: 'absolute', left: -11, top: 3, width: 20, height: 20, borderRadius: '50%', background: 'var(--surface)', border: '2px solid var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Clock size={12} style={{ color: 'var(--text-secondary)' }} />
                    </div>
                    <div style={{ marginBottom: 2 }}><span style={{ fontWeight: 600, fontSize: '.9rem', color: 'var(--text)' }}>{h.nota}</span></div>
                    <div style={{ fontSize: '.8rem', color: 'var(--text-secondary)' }}>
                      {h.autor && <span>{h.autor} · </span>}
                      {h.fecha && <span>{h.fecha}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'chat' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: 420 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.8rem 1rem', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                <MessageCircle size={16} style={{ color: chatActivo ? 'var(--success)' : 'var(--text-secondary)' }} />
                <span style={{ fontSize: '.85rem', fontWeight: 600 }}>{chatActivo ? 'Chat en vivo' : 'Conversación'}</span>
                {chatActivo && <span style={{ fontSize: '.75rem', color: 'var(--text-secondary)' }}>— {chatAdminNombre}</span>}
              </div>
              {user?.esAdmin && (
                chatActivo ? (
                  <ConfirmButton label="Devolver al bot" message="¿Devolver control al bot?" danger onConfirm={devolverControl} />
                ) : (
                  <button className="btn btn-primary btn-sm" onClick={tomarControl}>Tomar control</button>
                )
              )}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
              {chatMsgs.length === 0 && (
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem', fontSize: '.85rem' }}>No hay mensajes todavía.</p>
              )}
              {chatMsgs.map((m, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: m.direccion === 'inbound' ? 'flex-start' : 'flex-end' }}>
                  <div style={{
                    maxWidth: '75%', padding: '.5rem .8rem', borderRadius: 12,
                    borderBottomRightRadius: m.direccion !== 'inbound' ? 4 : undefined,
                    borderBottomLeftRadius: m.direccion === 'inbound' ? 4 : undefined,
                    background: m.direccion === 'inbound' ? '#e5e7eb' : '#dcfce7',
                    color: 'var(--text)', fontSize: '.88rem', lineHeight: 1.5,
                  }}>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{m.mensaje}</div>
                    <div style={{ fontSize: '.7rem', color: 'var(--text-secondary)', marginTop: '.2rem', textAlign: 'right' }}>{hora(m.createdAt)}</div>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {chatActivo && (
              <>
                <div style={{ display: 'flex', gap: '.3rem', padding: '.4rem 1rem', flexWrap: 'wrap' }}>
                  {['Ya lo estamos revisando', '¿Podés darnos más detalles?', 'Estamos trabajando en eso', '¿Probaste reiniciando?'].map(msg => (
                    <button key={msg} className="btn btn-ghost btn-sm" onClick={() => enviarChatMsg(msg)} style={{ fontSize: '.75rem', borderRadius: 12, padding: '.2rem .6rem' }}>{msg}</button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '.5rem', padding: '.8rem 1rem', borderTop: '1px solid var(--border)', background: 'var(--bg)' }}>
                  <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && enviarChatMsg()} placeholder="Escribí un mensaje..." style={{ flex: 1, padding: '.5rem .7rem', borderRadius: 8, border: '1px solid var(--border)', fontSize: '.9rem' }} />
                  <button className="btn btn-primary btn-sm" onClick={() => enviarChatMsg()} disabled={!chatInput.trim() || chatEnviando}>
                    {chatEnviando ? <span className="spinner spinner-sm" /> : <Send size={16} />}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
