import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';
import { CustomSelect } from '../components/CustomSelect';

type Member = {
  id: string;
  role: string;
  user: { id: string; email: string; name: string };
};

type Org = {
  id: string;
  name: string;
  industry: string;
  members: Member[];
};

export function SettingsPage() {
  const { token, organizationId, user } = useAuth();
  const [org, setOrg] = useState<Org | null>(null);
  const [error, setError] = useState('');
  const [memberForm, setMemberForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'HR',
  });

  const load = async () => {
    if (!organizationId) return;
    setOrg(
      await api<Org>(`/organizations/${organizationId}`, {
        token,
        organizationId,
      }),
    );
  };

  useEffect(() => {
    void load().catch((e) => setError(e instanceof ApiError ? e.message : 'Ошибка'));
  }, [token, organizationId]);

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!org) return;
    await api(`/organizations/${organizationId}`, {
      token,
      organizationId,
      method: 'PATCH',
      body: { name: org.name, industry: org.industry },
    });
    await load();
  };

  const onAddMember = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api(`/organizations/${organizationId}/members`, {
        token,
        organizationId,
        method: 'POST',
        body: memberForm,
      });
      setMemberForm({ name: '', email: '', password: '', role: 'HR' });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ошибка');
    }
  };

  if (!org) {
    return <div className="card">{error || 'Загрузка…'}</div>;
  }

  const canManage =
    user?.globalRole === 'SUPER_ADMIN' ||
    ['OWNER', 'ADMIN'].includes(
      user?.organizations.find((o) => o.id === organizationId)?.role || '',
    );

  return (
    <div className="stack">
      <div>
        <h1 className="page-title">Настройки компании</h1>
        <p className="page-sub">Профиль организации и роли пользователей.</p>
      </div>

      <form className="card" onSubmit={onSave}>
        <div className="field">
          <label>Название</label>
          <input
            value={org.name}
            disabled={!canManage}
            onChange={(e) => setOrg({ ...org, name: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Отрасль</label>
          <input
            value={org.industry}
            disabled={!canManage}
            onChange={(e) => setOrg({ ...org, industry: e.target.value })}
          />
        </div>
        {canManage && <button className="btn btn-primary">Сохранить</button>}
      </form>

      <div className="card table-wrap">
        <h3 style={{ marginBottom: 10 }}>Пользователи</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Имя</th>
              <th>Email</th>
              <th>Роль</th>
            </tr>
          </thead>
          <tbody>
            {org.members.map((m) => (
              <tr key={m.id}>
                <td>{m.user.name}</td>
                <td>{m.user.email}</td>
                <td>
                  <span className="badge">{m.role}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canManage && (
        <form className="card grid-2" onSubmit={onAddMember}>
          <h3 style={{ gridColumn: '1 / -1' }}>Добавить пользователя</h3>
          <div className="field">
            <label>Имя</label>
            <input
              required
              value={memberForm.name}
              onChange={(e) => setMemberForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="field">
            <label>Email</label>
            <input
              required
              type="email"
              value={memberForm.email}
              onChange={(e) => setMemberForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div className="field">
            <label>Пароль</label>
            <input
              required
              type="password"
              minLength={8}
              value={memberForm.password}
              onChange={(e) => setMemberForm((f) => ({ ...f, password: e.target.value }))}
            />
          </div>
          <div className="field">
            <label>Роль</label>
            <CustomSelect
              className="grow"
              value={memberForm.role}
              placeholder="Роль"
              onChange={(role) => setMemberForm((f) => ({ ...f, role }))}
              options={[
                { value: 'ADMIN', label: 'ADMIN' },
                { value: 'HR', label: 'HR' },
                { value: 'VIEWER', label: 'VIEWER' },
                { value: 'OWNER', label: 'OWNER' },
              ]}
            />
          </div>
          {error && <div className="error">{error}</div>}
          <button className="btn btn-primary">Добавить</button>
        </form>
      )}
    </div>
  );
}
