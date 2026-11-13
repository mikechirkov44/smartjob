import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth';
import { CustomSelect } from './CustomSelect';
import './layout.css';

export function Layout() {
  const { user, organizationId, setOrganizationId, logout } = useAuth();
  const isSuper = user?.globalRole === 'SUPER_ADMIN';

  return (
    <div className="layout">
      <header className="topbar">
        <div className="container topbar-inner">
          <div className="brand">
            <div className="brand-mark">SJ</div>
            <div>
              <strong>SmartJob</strong>
              <div className="brand-sub">Админ-панель</div>
            </div>
          </div>
          <nav className="nav">
            {isSuper && (
              <NavLink to="/super">Компании</NavLink>
            )}
            {organizationId && (
              <>
                <NavLink to="/">Обзор</NavLink>
                <NavLink to="/surveys">Опросы</NavLink>
                <NavLink to="/training">Обучение</NavLink>
                <NavLink to="/employees">Сотрудники</NavLink>
                <NavLink to="/departments">Отделы</NavLink>
                <NavLink to="/analytics">Аналитика</NavLink>
                <NavLink to="/settings">Настройки</NavLink>
              </>
            )}
          </nav>
          <div className="topbar-right">
            {user && user.organizations.length > 0 && (
              <CustomSelect
                className="sm"
                value={organizationId || ''}
                placeholder="Компания"
                ariaLabel="Выбор компании"
                onChange={setOrganizationId}
                options={user.organizations.map((o) => ({
                  value: o.id,
                  label: o.name,
                }))}
              />
            )}
            <button className="btn btn-secondary btn-sm" onClick={logout}>
              Выйти
            </button>
          </div>
        </div>
      </header>
      <main className="container main">
        <Outlet />
      </main>
    </div>
  );
}
