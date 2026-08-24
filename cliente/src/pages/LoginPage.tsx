import { useState, useEffect, useRef, type FormEvent, type ClipboardEvent, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { MessageCircle, ShieldCheck, ArrowLeft } from 'lucide-react';

interface AdminInfo { id: string; nombre: string; }

const OTP_EXPIRY = 5 * 60;

export default function LoginPage() {
  const [admins, setAdmins] = useState<AdminInfo[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [selectedNombre, setSelectedNombre] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [step, setStep] = useState<'select' | 'code' | 'master'>('select');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [sending, setSending] = useState(false);
  const [timer, setTimer] = useState(OTP_EXPIRY);
  const [codeSent, setCodeSent] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { fetchAdmins, login, verify, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchAdmins().then(list => { setAdmins(list); setLoaded(true); });
  }, [fetchAdmins]);

  useEffect(() => {
    if (!codeSent || step !== 'code') return;
    setTimer(OTP_EXPIRY);
    const iv = setInterval(() => setTimer(t => {
      if (t <= 1) { clearInterval(iv); return 0; }
      return t - 1;
    }), 1000);
    return () => clearInterval(iv);
  }, [codeSent, step]);

  async function handleSendCode() {
    if (!selectedId) return;
    setError(''); setMessage('');
    setSending(true);
    try {
      const msg = await login(selectedId);
      setMessage(msg);
      setCodeSent(true);
      setStep('code');
      setCode(['', '', '', '', '', '']);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (err: any) { setError(err.message); }
    finally { setSending(false); }
  }

  function handleCodeInput(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(0, 1);
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);
    if (digit && index < 5) inputRefs.current[index + 1]?.focus();
  }

  function handlePaste(e: ClipboardEvent) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setCode(pasted.split(''));
      inputRefs.current[5]?.focus();
    }
  }

  function handleKeyDown(index: number, e: KeyboardEvent) {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'Enter') {
      const codigo = code.join('');
      if (codigo.length === 6) handleVerify(codigo);
    }
  }

  async function handleVerify(codigo: string) {
    if (codigo.length < 4) { setError('Código inválido'); return; }
    setError('');
    try {
      if (step === 'master') await verify('master', codigo);
      else await verify(selectedId, codigo);
      navigate('/', { replace: true });
    } catch (err: any) { setError(err.message); }
  }

  async function handleCodeSubmit(e: FormEvent) {
    e.preventDefault();
    handleVerify(code.join(''));
  }

  function formatTimer(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  function resetToSelect() {
    setStep('select'); setError(''); setMessage('');
    setCodeSent(false); setTimer(OTP_EXPIRY);
    setCode(['', '', '', '', '', '']);
  }

  if (!loaded) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1A2C3F' }}>
      <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3, borderTopColor: '#B6FF18' }} />
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1A2C3F' }}>
      <div className="card" style={{ width: 400, padding: '2rem', position: 'relative', overflow: 'hidden' }}>
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <img src="https://colegionorbridge.edu.ar/wp-content/uploads/2026/02/Asset-1Logo-norbridge.png" alt="Norbridge" style={{ width: 90, height: 'auto' }} />
        </div>
        <h1 style={{ marginBottom: 2, fontSize: '1.4rem', textAlign: 'center', fontWeight: 800, letterSpacing: 4, color: '#1A2C3F' }}>NORBRIDGE</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', textAlign: 'center' }}>Sistema de Tickets IT</p>

        <div style={{ transition: 'all .3s ease', opacity: step === 'select' ? 1 : 0, maxHeight: step === 'select' ? 500 : 0, overflow: 'hidden' }}>
          {admins.length > 0 ? (
            <>
              <p style={{ marginBottom: '.5rem', fontWeight: 500, fontSize: '.9rem' }}>Seleccioná tu usuario:</p>
              <select
                value={selectedId}
                onChange={e => { setSelectedId(e.target.value); setSelectedNombre(admins.find(a => a.id === e.target.value)?.nombre || ''); }}
                disabled={sending}
                style={{ width: '100%', padding: '.6rem', borderRadius: 6, border: '1px solid var(--border)', marginBottom: '.75rem', fontSize: '.95rem' }}
              >
                <option value="">-- Elegir --</option>
                {admins.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
              <button className="btn btn-primary" onClick={handleSendCode} disabled={!selectedId || sending} style={{ width: '100%', justifyContent: 'center', padding: '.6rem' }}>
                {sending ? <><span className="spinner spinner-sm" style={{ marginRight: 6 }} />Enviando...</> : 'Enviar código'}
              </button>
              <div style={{ textAlign: 'center', marginTop: '.5rem' }}>
                <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: '.8rem' }} onClick={() => { setStep('master'); setCode(['', '', '', '', '', '']); }} disabled={sending}>
                  Usar código maestro
                </button>
              </div>
            </>
          ) : (
            <>
              <p style={{ marginBottom: '.75rem', color: 'var(--text-secondary)', textAlign: 'center', fontSize: '.9rem' }}>
                No hay administradores registrados.
              </p>
              <div style={{ textAlign: 'center' }}>
                <button className="btn btn-ghost btn-sm" style={{ fontSize: '.8rem' }} onClick={() => setStep('master')}>
                  Usar código maestro
                </button>
              </div>
            </>
          )}
          {error && <p style={{ color: 'var(--danger)', marginTop: '.75rem', textAlign: 'center', fontSize: '.85rem' }}>{error}</p>}
        </div>

        <div style={{ transition: 'all .3s ease', opacity: step === 'code' ? 1 : 0, maxHeight: step === 'code' ? 500 : 0, overflow: 'hidden' }}>
          <form onSubmit={handleCodeSubmit}>
            <p style={{ marginBottom: '.3rem', color: 'var(--text-secondary)', textAlign: 'center', fontSize: '.85rem' }}>
              <MessageCircle size={14} style={{ marginBottom: -2, marginRight: 4 }} /> Código enviado a <strong>{selectedNombre}</strong>
            </p>
            {message && <p style={{ color: '#16a34a', marginBottom: '.75rem', fontSize: '.85rem', textAlign: 'center' }}>{message}</p>}

            <div style={{ display: 'flex', gap: '.4rem', justifyContent: 'center', marginBottom: '.75rem' }}>
              {code.map((d, i) => (
                <input key={i} ref={el => { inputRefs.current[i] = el; }} type="text" inputMode="numeric" maxLength={1} value={d}
                  onChange={e => handleCodeInput(i, e.target.value)} onKeyDown={e => handleKeyDown(i, e)} onPaste={i === 0 ? handlePaste : undefined} autoFocus={i === 0}
                  style={{ width: 44, height: 52, textAlign: 'center', fontSize: '1.3rem', fontWeight: 700, borderRadius: 8, border: `1.5px solid ${d ? 'var(--primary)' : 'var(--border)'}`, outline: 'none', background: d ? '#f0f9ff' : 'var(--surface)' }} />
              ))}
            </div>

            <div style={{ textAlign: 'center', marginBottom: '.75rem' }}>
              {timer > 0 ? (
                <span style={{ fontSize: '.8rem', color: timer < 60 ? 'var(--danger)' : 'var(--text-secondary)' }}>⏱ Expira en {formatTimer(timer)}</span>
              ) : (
                <span style={{ fontSize: '.8rem', color: 'var(--danger)' }}>Código expirado</span>
              )}
            </div>

            {error && <p style={{ color: 'var(--danger)', marginBottom: '.75rem', textAlign: 'center', fontSize: '.85rem' }}>{error}</p>}

            <button className="btn btn-primary" style={{ width: '100%' }} disabled={loading || code.join('').length < 6}>
              {loading ? 'Verificando...' : 'Ingresar'}
            </button>
            <div style={{ display: 'flex', gap: '.5rem', marginTop: '.5rem' }}>
              <button type="button" className="btn btn-ghost" style={{ flex: 1, fontSize: '.85rem' }} onClick={resetToSelect}>Volver</button>
              <button type="button" className="btn btn-ghost btn-sm" style={{ flex: 1, fontSize: '.85rem' }} onClick={handleSendCode} disabled={sending}>
                {sending ? <span className="spinner spinner-sm" /> : 'Reenviar'}
              </button>
            </div>
          </form>
        </div>

        <div style={{ transition: 'all .3s ease', opacity: step === 'master' ? 1 : 0, maxHeight: step === 'master' ? 500 : 0, overflow: 'hidden' }}>
          <form onSubmit={e => { e.preventDefault(); handleVerify(code.join('')); }}>
            <p style={{ marginBottom: '.5rem', color: 'var(--text-secondary)', textAlign: 'center', fontSize: '.85rem' }}>
              <ShieldCheck size={14} style={{ marginBottom: -2, marginRight: 4 }} /> Ingresá el código maestro
            </p>
            <div style={{ display: 'flex', gap: '.4rem', justifyContent: 'center', marginBottom: '.75rem' }}>
              {code.map((d, i) => (
                <input key={i} ref={el => { inputRefs.current[i] = el; }} type="text" inputMode="numeric" maxLength={1} value={d}
                  onChange={e => handleCodeInput(i, e.target.value)} onKeyDown={e => handleKeyDown(i, e)} onPaste={i === 0 ? handlePaste : undefined} autoFocus={i === 0}
                  style={{ width: 44, height: 52, textAlign: 'center', fontSize: '1.3rem', fontWeight: 700, borderRadius: 8, border: `1.5px solid ${d ? 'var(--primary)' : 'var(--border)'}`, outline: 'none', background: d ? '#f0f9ff' : 'var(--surface)' }} />
              ))}
            </div>
            {error && <p style={{ color: 'var(--danger)', marginBottom: '.75rem', textAlign: 'center', fontSize: '.85rem' }}>{error}</p>}
            <button className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Verificando...' : 'Ingresar'}
            </button>
            <button type="button" className="btn btn-ghost" style={{ width: '100%', marginTop: '.5rem', fontSize: '.85rem' }} onClick={resetToSelect}>
              <ArrowLeft size={14} style={{ marginBottom: -2 }} /> Volver
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
