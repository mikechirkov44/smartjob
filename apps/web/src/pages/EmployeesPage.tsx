import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';
import { CustomSelect } from '../components/CustomSelect';

type Dept = { id: string; name: string };
type Emp = {
  id: string;
  fullName: string;
  email?: string;
  grade?: string;
  isActive: boolean;
  department?: Dept | null;
};

export function EmployeesPage() {
  const { token, organizationId } = useAuth();
  const [items, setItems] = useState<Emp[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [csv, setCsv] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    departmentId: '',
    grade: '',
  });

  const load = async () => {
    if (!organizationId) return;
    const [emps, departments] = await Promise.all([
      api<Emp[]>(`/organizations/${organizationId}/employees`, { token, organizationId }),
      api<Dept[]>(`/organizations/${organizationId}/departments`, { token, organizationId }),
    ]);
    setItems(emps);
    setDepts(departments);
  };

  useEffect(() => {
    void load().catch((e) => setError(e instanceof ApiError ? e.message : 'Ошибка'));
  }, [token, organizationId]);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    await api(`/organizations/${organizationId}/employees`, {
      token,
      organizationId,
      method: 'POST',
      body: {
        ...form,
        departmentId: form.departmentId || undefined,
        email: form.email || undefined,
      },
    });
    setForm({ fullName: '', email: '', departmentId: '', grade: '' });
    await load();
  };

  const onImport = async () => {
    const res = await api<{ created: number }>(
      `/organizations/${organizationId}/employees/import`,
      { token, organizationId, method: 'POST', body: { csv } },
    );
    setCsv('');
    alert(`Импортировано: ${res.created}`);
    await load();
  };

  return (
    <div className="stack">
      <div>
        <h1 className="page-title">Сотрудники</h1>
        <p className="page-sub">Для персональных ссылок и идентификации админом.</p>
      </div>

      <form className="card grid-2" onSubmit={onCreate}>
        <div className="field">
          <label>ФИО</label>
          <input
            required
            value={form.fullName}
            onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
          />
        </div>
        <div className="field">
          <label>Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
        </div>
        <div className="field">
          <label>Отдел</label>
          <CustomSelect
            className="grow"
            value={form.departmentId}
            placeholder="—"
            onChange={(departmentId) => setForm((f) => ({ ...f, departmentId }))}
            options={[
              { value: '', label: '—' },
              ...depts.map((d) => ({ value: d.id, label: d.name })),
            ]}
          />
        </div>
        <div className="field">
          <label>Грейд</label>
          <input
            value={form.grade}
            onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value }))}
          />
        </div>
        <button className="btn btn-primary">Добавить</button>
      </form>

      <div className="card">
        <h3 style={{ marginBottom: 8 }}>CSV-импорт</h3>
        <p className="muted" style={{ marginBottom: 8 }}>
          Формат: ФИО;email;отдел;грейд
        </p>
        <textarea rows={4} value={csv} onChange={(e) => setCsv(e.target.value)} style={{ width: '100%', borderRadius: 12, border: '1.5px solid var(--border)', padding: 12 }} />
        <div style={{ marginTop: 10 }}>
          <button className="btn btn-secondary" type="button" onClick={() => void onImport()} disabled={!csv.trim()}>
            Импортировать
          </button>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>ФИО</th>
              <th>Email</th>
              <th>Отдел</th>
              <th>Грейд</th>
            </tr>
          </thead>
          <tbody>
            {items.map((e) => (
              <tr key={e.id}>
                <td>{e.fullName}</td>
                <td>{e.email || '—'}</td>
                <td>{e.department?.name || '—'}</td>
                <td>{e.grade || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
