import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth';

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">SB</span>
          <span className="brand-name">Scambot</span>
        </div>
        <nav className="nav">
          <NavLink to="/" end>
            Incoming text
          </NavLink>
          <NavLink to="/files">Incoming files</NavLink>
          <NavLink to="/fs">Filesystem</NavLink>
          {user?.role === 'admin' && (
            <NavLink to="/users">Users</NavLink>
          )}
        </nav>
        <div className="user-chip">
          <span>
            {user?.username}
            {user?.role === 'admin' ? ' · admin' : ''}
          </span>
          <button type="button" className="btn btn-ghost" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
