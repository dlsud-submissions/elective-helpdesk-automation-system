import { useEffect } from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import {
  AuthProvider,
  homePathFor,
  LoginPage,
  SignupPage,
  LandingPage,
  SettingsPage,
  AdminUsersPage,
  RequireAuth,
  RequireRole,
  useAuth,
  useProfile,
} from '../features/auth';
import { ArchivePage, ChatPage } from '../features/chat';
import { DashboardPage } from '../features/dashboard';
import { KbArticlesPage } from '../features/knowledge/ui/KbArticlesPage';
import { MyTicketsPage, TicketQueuePage } from '../features/tickets';
import { AppShell } from './AppShell';

function HomeRedirect() {
  const { state } = useAuth();
  return (
    <Navigate
      to={
        state.status === 'signedIn' ? homePathFor(state.profile.role) : '/login'
      }
      replace
    />
  );
}

function MyTicketsRoute() {
  const profile = useProfile();
  return <MyTicketsPage userId={profile.id} role={profile.role} />;
}

export function AppRoutes() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (
      !('IntersectionObserver' in window) ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    const elements = Array.from(
      document.querySelectorAll<HTMLElement>(
        '.app-main .panel, .app-main .chat-main, .app-main .chat-sidebar, .app-main .dashboard, .app-main .narrow'
      )
    );
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('reveal-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08 }
    );

    elements.forEach((element) => {
      element.classList.add('reveal-ready');
      observer.observe(element);
    });

    return () => observer.disconnect();
  }, [pathname]);

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/staff-login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/home" element={<HomeRedirect />} />
        {/* Optional segments keep one mounted page while the id changes, so
            chat state and the loaded queue survive navigation. */}
        <Route
          path="/chat/:conversationId?"
          element={
            <RequireRole roles={['employee', 'agent']}>
              <ChatPage />
            </RequireRole>
          }
        />
        <Route
          path="/archive"
          element={
            <RequireRole roles={['employee']}>
              <ArchivePage />
            </RequireRole>
          }
        />
        <Route path="/settings" element={<SettingsPage />} />
        <Route
          path="/admin/users"
          element={
            <RequireRole roles={['admin']}>
              <AdminUsersPage />
            </RequireRole>
          }
        />
        <Route
          path="/tickets/:ticketId?"
          element={
            <RequireRole roles={['employee', 'agent']}>
              <MyTicketsRoute />
            </RequireRole>
          }
        />
        <Route
          path="/queue/:ticketId?"
          element={
            <RequireRole roles={['admin']}>
              <TicketQueuePage />
            </RequireRole>
          }
        />
        <Route path="/dashboard/:ticketId?" element={<DashboardPage />} />
        <Route
          path="/admin/kb-articles"
          element={
            <RequireRole roles={['admin']}>
              <KbArticlesPage />
            </RequireRole>
          }
        />
        <Route path="*" element={<HomeRedirect />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
