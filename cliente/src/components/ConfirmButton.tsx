import { useState, type ReactNode } from 'react';

interface Props {
  onConfirm: () => void;
  message: string;
  label: string;
  danger?: boolean;
  children?: ReactNode;
  loading?: boolean;
}

export default function ConfirmButton({ onConfirm, message, label, danger, children, loading }: Props) {
  const [asking, setAsking] = useState(false);

  if (!asking) {
    if (children) {
      return <span onClick={() => setAsking(true)} style={{ cursor: 'pointer' }}>{children}</span>;
    }
    return <button className="btn btn-ghost btn-sm" style={danger ? { color: 'var(--danger)' } : {}}
      onClick={() => setAsking(true)}>{label}</button>;
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '.4rem', fontSize: '.85rem' }}>
      <span style={{ color: 'var(--text-secondary)' }}>{message}</span>
      <button className="btn btn-danger btn-sm" disabled={loading} onClick={() => { onConfirm(); setAsking(false); }}>
        {loading ? <span className="spinner spinner-sm" /> : 'Sí'}
      </button>
      <button className="btn btn-ghost btn-sm" disabled={loading} onClick={() => setAsking(false)}>No</button>
    </span>
  );
}
