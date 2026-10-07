import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';

type Dept = { id: string; name: string; _count: { employees: number } };

export function DepartmentsPage() {
  const { token, organizationId } = useAuth();
  const [items, setItems] = useState<Dept[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    if (!organizationId) return;
    setItems(
      await api<Dept[]>(`/organizations/${organizationId}/departments`, {
        token,
        organizationId,
      }),
    );
  };

  useEffect(() => {
    void load();
  }, [token, organizationId]);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api(`/organizations/${organizationId}/departments`, {
        token,
        organizationId,
        method: 'POST',
        body: { name },
      });
      setName('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ошибка');
    }
  };

  const onDelete = async (id: string) => {
    await api(`/organizations/${organizationId}/departments/${id}`, {
      token,
      organizationId,
      method: 'DELETE',
    });
    await load();
  };

  return (
    <div className="stack">
      <div>
        <h1 className="page-title">Отделы</h1>
        <p className="page-sub">Структура компании для сегментации ответов.</p>
      </div>
      <form className="card row" onSubmit={onCreate}>
        <input
          placeholder="Название отдела"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          style={{ flex: 1, minWidth: 200, padding: 11, borderRadius: 12, border: '1.5px solid var(--border)' }}
        />
        <button className="btn btn-primary">Добавить</button>
      </form>
      {error && <div className="error">{error}</div>}
      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Отдел</th>
              <th>Сотрудники</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((d) => (
              <tr key={d.id}>
                <td>{d.name}</td>
                <td>{d._count.employees}</td>
                <td>
                  <button className="btn btn-danger btn-sm" onClick={() => void onDelete(d.id)}>
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
