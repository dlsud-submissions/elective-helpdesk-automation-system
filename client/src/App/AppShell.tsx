import { NavLink, Outlet } from 'react-router-dom';
import { isStaff, useAuth, useProfile } from '../features/auth';

const roleLabels = { employee: 'Employee', agent: 'Agent', admin: 'Admin' };

/** Role-aware navigation. Hiding links is UX only; the API enforces roles. */
export function AppShell() {
  const profile = useProfile();
  const { signOut } = useAuth();
  const staff = isStaff(profile.role);

  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="topbar">
        <span className="brand">[AI-HAS] IT Helpdesk</span>
        <nav aria-label="Main">
          <ul className="nav">
            <li>
              <NavLink to="/chat">Chat</NavLink>
            </li>
            {staff ? (
              <>
                <li>
                  <NavLink to="/queue">Queue</NavLink>
                </li>
                <li>
                  <NavLink to="/dashboard">Dashboard</NavLink>
                </li>
              </>
            ) : null}
          </ul>
        </nav>
        <div className="topbar__user">
          <span>
            {profile.displayName}{' '}
            <span className="badge badge--role">
              {roleLabels[profile.role]}
            </span>
          </span>
          <button
            type="button"
            className="button button--secondary"
            onClick={() => void signOut()}
          >
            Sign out
          </button>
        </div>
      </header>
      <main id="main" className="app-main" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
