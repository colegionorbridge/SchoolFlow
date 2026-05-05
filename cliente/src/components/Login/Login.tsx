import React, { useState } from 'react';
import styles from './Login.module.css';
import { useData } from '../../context/DataContext';

const API_URL = import.meta.env.VITE_API_URL;

interface LoginProps {
  onLogin: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const { cargarDatosIniciales } = useData();
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(false);

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      const data = await res.json();

      if (res.ok && data.token) {
        localStorage.setItem('token', data.token);
        await cargarDatosIniciales();
        onLogin();
      } else {
        setError(true);
      }
    } catch (err) {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <img 
          src="https://colegionorbridge.edu.ar/wp-content/uploads/2026/02/Asset-1Logo-norbridge.png" 
          alt="Colegio Norbridge" 
          className={styles.logo}
        />
        <h2 className={styles.title}>IT Dashboard</h2>
        <p className={styles.subtitle}>Colegio Norbridge</p>
        
        <form className={styles.form} onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="Clave de acceso"
            className={styles.input}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          <button type="submit" className={styles.button} disabled={loading}>
            {loading ? 'Ingresando...' : 'Entrar'}
          </button>
        </form>

        {error && <p className={styles.error}>Clave incorrecta. Intente de nuevo.</p>}
      </div>
    </div>
  );
};

export default Login;