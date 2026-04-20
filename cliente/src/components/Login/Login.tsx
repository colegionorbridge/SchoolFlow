import React, { useState } from 'react';
import styles from './Login.module.css';

interface LoginProps {
  onLogin: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  // Forzamos una clave sencilla por ahora
  const CLAVE_MAESTRA = "norbridge2026"; 

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === CLAVE_MAESTRA) {
      setError(false);
      onLogin(); // Avisamos al componente padre que entramos
    } else {
      setError(true);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h2 className={styles.title}>IT Dashboard</h2>
        <p className={styles.subtitle}>Colegio Norbridge</p>
        
        <form className={styles.form} onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="Clave de acceso"
            className={styles.input}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" className={styles.button}>
            Entrar
          </button>
        </form>

        {error && <p className={styles.error}>Clave incorrecta. Intente de nuevo.</p>}
      </div>
    </div>
  );
};

export default Login;