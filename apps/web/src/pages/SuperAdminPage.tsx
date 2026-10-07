import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';

type Org = {
  id: string;
  name: string;
  slug: string;
  industry: string;
  isActive: boolean;
  _count: { employees: number; surveys: number; members: number };
};

export function SuperAdminPage() {
  const { token, setOrganizationId } = useAuth();
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [selected, setSelected] = useState<Org | null>(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    slug: '',
    industry: 'IT / Разработка ПО',
    ownerName: '',
    ownerEmail: '',
    ownerPassword: '',
  });

  const load = async () => {
    const data = await api<Org[]>('/organizations', { token });
    setOrgs(data);
  };

  useEffect(() => {
    void load().catch((e) =>
      setError(e instanceof ApiError ? e.message : 'Ошибка загрузки'),
    );
  }, [token]);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const org = await api<Org>('/organizations', {
        token,
        method: 'POST',
        body: form,
      });
      setForm({
        name: '',
        slug: '',
        industry: 'IT / Разработка ПО',
        ownerName: '',
        ownerEmail: '',
        ownerPassword: '',
      });
      const list = await api<Org[]>('/organizations', { token });
      setOrgs(list);
      setSelected(list.find((o) => o.id === org.id) || org);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось создать');
    }
  };

  const openCompany = () => {
    if (!selected) return;
    setOrganizationId(selected.id);
    setSelected(null);
    navigate('/');
  };

  return (
    <div className="stack">
      <div>
        <h1 className="page-title">Компании</h1>
        <p className="page-sub">Супер-админ создаёт организации и владельцев.</p>
      </div>

      <div className="grid-2">
        <form className="card" onSubmit={onCreate}>
          <h3 style={{ marginBottom: 12 }}>Новая компания</h3>
          <div className="field">
            <label>Название</label>
            <input
              required
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  name: e.target.value,
                  slug:
                    f.slug ||
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9а-яё]+/gi, '-')
                      .replace(/^-|-$/g, ''),
                }))
              }
            />
          </div>
          <div className="field">
            <label>Slug</label>
            <input
              required
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            />
          </div>
          <div className="field">
            <label>Отрасль</label>
            <input
              value={form.industry}
              onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
            />
          </div>
          <div className="field">
            <label>Владелец (имя)</label>
            <input
              required
              value={form.ownerName}
              onChange={(e) => setForm((f) => ({ ...f, ownerName: e.target.value }))}
            />
          </div>
          <div className="field">
            <label>Владелец (email)</label>
            <input
              required
              type="email"
              value={form.ownerEmail}
              onChange={(e) => setForm((f) => ({ ...f, ownerEmail: e.target.value }))}
            />
          </div>
          <div className="field">
            <label>Пароль владельца</label>
            <input
              required
              type="password"
              minLength={8}
              value={form.ownerPassword}
              onChange={(e) => setForm((f) => ({ ...f, ownerPassword: e.target.value }))}
            />
          </div>
          {error && <div className="error">{error}</div>}
          <button className="btn btn-primary">Создать</button>
        </form>

        <div className="card table-wrap">
          <h3 style={{ marginBottom: 12 }}>Список</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Компания</th>
                <th>Участники</th>
                <th>Опросы</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((o) => (
                <tr key={o.id}>
                  <td>
                    <strong>{o.name}</strong>
                    <div className="muted">{o.slug}</div>
                  </td>
                  <td>{o._count.members}</td>
                  <td>{o._count.surveys}</td>
                  <td>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setSelected(o)}
                    >
                      Открыть
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h2>{selected.name}</h2>
            <p className="muted" style={{ marginBottom: 16 }}>
              {selected.industry} · slug: {selected.slug}
            </p>
            <div className="grid-2" style={{ marginBottom: 8 }}>
              <div className="card" style={{ padding: 14 }}>
                <div className="muted">Участники</div>
                <strong style={{ fontSize: 24 }}>{selected._count.members}</strong>
              </div>
              <div className="card" style={{ padding: 14 }}>
                <div className="muted">Опросы</div>
                <strong style={{ fontSize: 24 }}>{selected._count.surveys}</strong>
              </div>
              <div className="card" style={{ padding: 14 }}>
                <div className="muted">Сотрудники</div>
                <strong style={{ fontSize: 24 }}>{selected._count.employees}</strong>
              </div>
              <div className="card" style={{ padding: 14 }}>
                <div className="muted">Статус</div>
                <strong style={{ fontSize: 18 }}>
                  {selected.isActive ? 'Активна' : 'Отключена'}
                </strong>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setSelected(null)}>
                Закрыть
              </button>
              <button className="btn btn-primary" onClick={openCompany}>
                Перейти в админку
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
