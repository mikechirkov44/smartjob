import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { ApiError } from '../api';

export function LoginPage() {
  const { login, user, loading } = useAuth();
  const [email, setEmail] = useState('admin@smartjob.local');
  const [password, setPassword] = useState('ChangeMe123!');
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
    <div className="login-page">
      <form className="card login-card" onSubmit={onSubmit}>
        <div className="brand" style={{ marginBottom: 18 }}>
          <div className="brand-mark">SJ</div>
          <div>
            <strong>SmartJob</strong>
            <div className="brand-sub">Вход в админку</div>
          </div>
        </div>
        <div className="field">
          <label>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </div>
        <div className="field">
          <label>Пароль</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
          />
        </div>
        {error && <div className="error">{error}</div>}
        <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>
          {busy ? 'Вход…' : 'Войти'}
        </button>
      </form>
      <style>{`
        .login-page{min-height:100vh;display:grid;place-items:center;padding:24px}
        .login-card{width:min(420px,100%)}
        .brand{display:flex;gap:10px;align-items:center;font-weight:800}
        .brand-mark{width:36px;height:36px;border-radius:11px;display:grid;place-items:center;font-weight:800;color:#fff;background:linear-gradient(135deg,var(--primary),var(--violet));box-shadow:0 6px 14px -4px rgba(99,102,241,.5)}
        .brand-sub{font-size:12px;color:var(--muted);font-weight:600}
      `}</style>
    </div>
  );
}
