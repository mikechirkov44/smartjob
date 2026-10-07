import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { ApiError } from '../api';
import './login.css';

export function LoginPage() {
  const { login, user, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!loading && user) {
    return <Navigate to={user.globalRole === 'SUPER_ADMIN' ? '/super' : '/'} replace />;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ошибка входа');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-shell">
      <section className="login-hero" aria-hidden="false">
        <img
          className="login-hero-art"
          src="/illustrations/login-hero.svg"
          alt=""
        />
        <div className="login-hero-copy">
          <div className="login-brand">
            <div className="brand-mark">SJ</div>
            <strong>SmartJob</strong>
          </div>
          <h1>Вовлечённость, которую видно</h1>
          <p>Запускайте анонимные опросы, собирайте ответы по QR и смотрите драйверы в аналитике.</p>
        </div>
      </section>

      <section className="login-panel">
        <form className="login-form" onSubmit={onSubmit}>
          <h2>Вход в систему</h2>
          <p className="login-form-sub">Админ-панель опросов вовлечённости</p>
          <div className="field">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="username"
              required
              placeholder="you@company.com"
            />
          </div>
          <div className="field">
            <label htmlFor="login-password">Пароль</label>
            <input
              id="login-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
            />
          </div>
          {error && <div className="error">{error}</div>}
          <button className="btn btn-primary login-submit" disabled={busy}>
            {busy ? 'Вход…' : 'Войти'}
          </button>
        </form>
      </section>
    </div>
  );
}
