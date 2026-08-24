import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';

interface Props {
  to: string;
  icon: ReactNode;
  label: string;
  end?: boolean;
  badge?: number;
}

export default function NavItem({ to, icon, label, end, badge }: Props) {
  return (
    <NavLink to={to} end={end} style={({ isActive }) => ({
      display: 'flex', alignItems: 'center', gap: '.6rem', padding: '.6rem 1rem',
      textDecoration: 'none', color: isActive ? 'var(--accent)' : 'var(--silver)',
      background: isActive ? 'rgba(182,255,24,.08)' : 'transparent',
      borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
    })}>
      {icon} {label}
      {badge !== undefined && badge > 0 && (
        <span style={{
          marginLeft: 'auto',
          background: 'var(--accent)',
          color: 'var(--primary)',
          fontSize: '.7rem',
          fontWeight: 700,
          minWidth: 18,
          height: 18,
          borderRadius: 9,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 5px',
        }}>{badge > 99 ? '99+' : badge}</span>
      )}
    </NavLink>
  );
}
