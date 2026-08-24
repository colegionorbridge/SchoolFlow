import type { ReactNode } from 'react';

interface Props {
  value: number;
  label: string;
  color?: string;
  icon?: ReactNode;
}

export default function StatCard({ value, label, color, icon }: Props) {
  return (
    <div className="card" style={{ padding: '.9rem 1rem', display: 'flex', alignItems: 'center', gap: '.7rem' }}>
      {icon && (
        <div style={{ color: color || 'var(--text-secondary)', opacity: .7, flexShrink: 0 }}>
          {icon}
        </div>
      )}
      <div>
        <div style={{ fontSize: '1.4rem', fontWeight: 700, color: color || 'var(--text)', lineHeight: 1.2 }}>{value}</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '.75rem' }}>{label}</div>
      </div>
    </div>
  );
}
