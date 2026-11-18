import { useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { isStaff, useAuth, useProfile } from '../features/auth';

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
  const staff = isStaff(profile.role);
  useFocusPageHeadingOnNavigate();

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
            <li>
              <NavLink to="/tickets">My tickets</NavLink>
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
