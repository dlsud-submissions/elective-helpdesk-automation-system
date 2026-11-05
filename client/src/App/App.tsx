import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import {
  AuthProvider,
  homePathFor,
  LoginPage,
  RequireAuth,
  RequireRole,
  useAuth,
} from '../features/auth';
import { ChatPage } from '../features/chat';
import { DashboardPage } from '../features/dashboard';
import { TicketQueuePage } from '../features/tickets';
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

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<HomeRedirect />} />
        {/* Optional segments keep one mounted page while the id changes, so
            chat state and the loaded queue survive navigation. */}
        <Route path="/chat/:conversationId?" element={<ChatPage />} />
        <Route
          path="/queue/:ticketId?"
          element={
            <RequireRole roles={['agent', 'admin']}>
              <TicketQueuePage />
            </RequireRole>
          }
        />
        <Route
          path="/dashboard"
          element={
            <RequireRole roles={['agent', 'admin']}>
              <DashboardPage />
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
