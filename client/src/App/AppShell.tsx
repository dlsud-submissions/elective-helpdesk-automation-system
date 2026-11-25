import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth, useProfile } from '../features/auth';

const roleLabels = { employee: 'Employee', agent: 'Agent', admin: 'Admin' };
type SortMode = 'manual' | 'alphabetical' | 'recent' | 'created';
type NavItem = {
  path: string;
  label: string;
  icon: string;
  manualOrder: number;
  createdOrder: number;
};

/** First path segment, e.g. "/queue/abc" -> "queue". */
const sectionOf = (pathname: string) => pathname.split('/')[1] ?? '';

/**
 * When the user moves to another section, focus the new page's h1 so
 * keyboard and screen-reader users start at the new content instead of
 * staying on the nav link.
 */
function useFocusPageHeadingOnNavigate() {
  const { pathname } = useLocation();
  const previous = useRef<string | null>(null);

  useEffect(() => {
    const section = sectionOf(pathname);
    if (previous.current !== null && previous.current !== section) {
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

function NavIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    home: 'm3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
    chat: 'M4 5h16v12H9l-5 4z M8 10h8 M8 13h5',
    ticket:
      'M4 5h16v4a3 3 0 0 0 0 6v4H4v-4a3 3 0 0 0 0-6z M12 8v1 M12 12v1 M12 16v1',
    archive: 'M3 5h18v4H3z M5 9v11h14V9 M10 13h4',
    queue: 'M4 6h16 M4 12h16 M4 18h16 M7 6v0 M7 12v0 M7 18v0',
    users:
      'M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1 M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7 M16 4.2a3.5 3.5 0 0 1 0 6.8 M17 15h1a4 4 0 0 1 3 3.9V20',
    book: 'M4 4h7a3 3 0 0 1 3 3v13a3 3 0 0 0-3-3H4z M20 4h-3a3 3 0 0 0-3 3v13a3 3 0 0 1 3-3h3z',
    settings:
      'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z M19.4 15a1.8 1.8 0 0 0 .9-1.6v-2.8a1.8 1.8 0 0 0-.9-1.6',
  };
  return (
    <svg
      className="nav__icon"
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name]} />
    </svg>
  );
}

/** Role-aware navigation. Hiding links is UX only; the API enforces roles. */
export function AppShell() {
  const profile = useProfile();
  const { signOut } = useAuth();
  const { pathname } = useLocation();
  const [sortMode, setSortMode] = useState<SortMode>('manual');
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc');
  const [recentPaths, setRecentPaths] = useState<string[]>([]);
  useFocusPageHeadingOnNavigate();

  useEffect(() => {
    const section = sectionOf(pathname);
    if (section) {
      setRecentPaths((paths) => [
        section,
        ...paths.filter((path) => path !== section),
      ]);
    }
  }, [pathname]);

  const items = useMemo(() => {
    const links: NavItem[] = [
      {
        path: '/dashboard',
        label: 'Dashboard',
        icon: 'home',
        manualOrder: 0,
        createdOrder: 0,
      },
      ...(profile.role === 'employee' || profile.role === 'agent'
        ? [
            {
              path: '/chat',
              label: 'Chat',
              icon: 'chat',
              manualOrder: 1,
              createdOrder: 1,
            },
            {
              path: '/tickets',
              label: 'My tickets',
              icon: 'ticket',
              manualOrder: 2,
              createdOrder: 2,
            },
          ]
        : []),
      ...(profile.role === 'employee'
        ? [
            {
              path: '/archive',
              label: 'Archive',
              icon: 'archive',
              manualOrder: 3,
              createdOrder: 3,
            },
          ]
        : []),
      ...(profile.role === 'admin'
        ? [
            {
              path: '/queue',
              label: 'Queue',
              icon: 'queue',
              manualOrder: 1,
              createdOrder: 1,
            },
            {
              path: '/admin/users',
              label: 'Users',
              icon: 'users',
              manualOrder: 2,
              createdOrder: 2,
            },
            {
              path: '/admin/kb-articles',
              label: 'Knowledge Base',
              icon: 'book',
              manualOrder: 3,
              createdOrder: 3,
            },
          ]
        : []),
      {
        path: '/settings',
        label: 'Settings',
        icon: 'settings',
        manualOrder: 4,
        createdOrder: 4,
      },
    ];

    return [...links].sort((a, b) => {
      let order = 0;
      if (sortMode === 'alphabetical') {
        order = a.label.localeCompare(b.label);
      } else if (sortMode === 'recent') {
        const aIndex = recentPaths.indexOf(sectionOf(a.path));
        const bIndex = recentPaths.indexOf(sectionOf(b.path));
        order =
          (aIndex < 0 ? Number.MAX_SAFE_INTEGER : aIndex) -
          (bIndex < 0 ? Number.MAX_SAFE_INTEGER : bIndex);
        if (order === 0) order = a.manualOrder - b.manualOrder;
      } else if (sortMode === 'created') {
        order = a.createdOrder - b.createdOrder;
      } else {
        order = a.manualOrder - b.manualOrder;
      }
      return direction === 'asc' ? order : -order;
    });
  }, [direction, profile.role, recentPaths, sortMode]);

  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="topbar">
        <Link to="/dashboard" className="brand brand--app">
          <img src="/assets/logo.png" alt="" className="brand__logo" />
          Harbor Tickets
        </Link>
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
      <div className="app-layout">
        <aside className="app-sidebar">
          <nav aria-label="Main">
            <div className="nav-sort">
              <label className="field field--inline">
                <span>Sort navigation</span>
                <select
                  aria-label="Sort navigation"
                  value={sortMode}
                  onChange={(event) =>
                    setSortMode(event.target.value as SortMode)
                  }
                >
                  <option value="manual">Manual</option>
                  <option value="alphabetical">Alphabetical</option>
                  <option value="recent">Recent</option>
                  <option value="created">Created</option>
                </select>
              </label>
              <button
                type="button"
                className="button button--secondary nav-sort__direction"
                aria-label={`Sort ${direction === 'asc' ? 'ascending' : 'descending'}`}
                onClick={() =>
                  setDirection((current) =>
                    current === 'asc' ? 'desc' : 'asc'
                  )
                }
              >
                {direction === 'asc' ? 'ASC ↑' : 'DESC ↓'}
              </button>
            </div>
            <ul className="nav">
              {items.map((item) => (
                <li key={item.path}>
                  <NavLink to={item.path}>
                    <NavIcon name={item.icon} />
                    <span>{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
        <main id="main" className="app-main" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
