import { useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth, useProfile } from '../features/auth';

const roleLabels = { employee: 'Employee', agent: 'Agent', admin: 'Admin' };

/** First path segment, e.g. "/queue/abc" -> "queue". */
const sectionOf = (pathname: string) => pathname.split('/')[1] ?? '';

/**
 * When the user moves to another section, focus the new page's h1 so
 * keyboard and screen-reader users start at the new content instead of
 * staying on the nav link. Changes inside a section (a chat id, a ticket id)
 * are handled by the page itself; the first render keeps default focus.
 */
function useFocusPageHeadingOnNavigate() {
  const { pathname } = useLocation();
  const previous = useRef<string | null>(null);

  useEffect(() => {
    const section = sectionOf(pathname);
    if (previous.current !== null && previous.current !== section) {
      // Wait a frame so the new route has rendered its heading.
      const frame = requestAnimationFrame(() => {
        const main = document.getElementById('main');
        const heading = main?.querySelector<HTMLElement>('h1');
        const target = heading ?? main;
        if (!target) return;
        if (target !== main && !target.hasAttribute('tabindex')) {
          target.setAttribute('tabindex', '-1');
        }
        target.focus();
      });
      previous.current = section;
      return () => cancelAnimationFrame(frame);
    }
    previous.current = section;
    return undefined;
  }, [pathname]);
}

/** Role-aware navigation. Hiding links is UX only; the API enforces roles. */
export function AppShell() {
  const profile = useProfile();
  const { signOut } = useAuth();
  useFocusPageHeadingOnNavigate();

  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="topbar">
        <span className="brand brand--app">
          <img src="/assets/logo.png" alt="" className="brand__logo" />
          Harbor Tickets
        </span>
        <nav aria-label="Main">
          <ul className="nav">
            {profile.role === 'employee' || profile.role === 'agent' ? (
              <>
                <li>
                  <NavLink to="/chat">Chat</NavLink>
                </li>
                <li>
                  <NavLink to="/tickets">My tickets</NavLink>
                </li>
              </>
            ) : null}
            {profile.role === 'employee' ? (
              <li>
                <NavLink to="/archive">Archive</NavLink>
              </li>
            ) : null}
            <li>
              <NavLink to="/dashboard">Dashboard</NavLink>
            </li>
            {profile.role === 'admin' ? (
              <li>
                <NavLink to="/queue">Queue</NavLink>
              </li>
            ) : null}
            {profile.role === 'admin' ? (
              <li>
                <NavLink to="/admin/users">Users</NavLink>
              </li>
            ) : null}
            {profile.role === 'admin' ? (
              <li>
                <NavLink to="/admin/kb-articles">Knowledge Base</NavLink>
              </li>
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
        <NavLink
          to="/settings"
          className="topbar__settings"
          aria-label="Settings"
          title="Settings"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
            <path d="m19.4 15 .1.1a1.8 1.8 0 0 1-2.5 2.5l-.1-.1a1.8 1.8 0 0 0-3 .9v.2a1.8 1.8 0 0 1-3.6 0v-.2a1.8 1.8 0 0 0-3-.9l-.1.1a1.8 1.8 0 1 1-2.5-2.5l.1-.1a1.8 1.8 0 0 0-.9-3h-.2a1.8 1.8 0 0 1 0-3.6h.2a1.8 1.8 0 0 0 .9-3l-.1-.1a1.8 1.8 0 1 1 2.5-2.5l.1.1a1.8 1.8 0 0 0 3-.9v-.2a1.8 1.8 0 0 1 3.6 0v.2a1.8 1.8 0 0 0 3 .9l.1-.1a1.8 1.8 0 1 1 2.5 2.5l-.1.1a1.8 1.8 0 0 0 .9 3h.2a1.8 1.8 0 0 1 0 3.6h-.2a1.8 1.8 0 0 0-.9 3Z" />
          </svg>
        </NavLink>
      </header>
      <main id="main" className="app-main" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
