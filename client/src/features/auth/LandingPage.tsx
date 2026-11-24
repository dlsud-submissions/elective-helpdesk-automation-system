import { Link, Navigate } from 'react-router-dom';
import { useDocumentTitle } from '../../shared/ui/useDocumentTitle';
import { useAuth } from './AuthProvider';
import { homePathFor } from './types';

export function LandingPage() {
  useDocumentTitle('Welcome');
  const { state } = useAuth();

  if (state.status === 'signedIn') {
    return <Navigate to={homePathFor(state.profile.role)} replace />;
  }

  return (
    <main className="landing-page">
      <header className="landing-nav" aria-label="Harbor Tickets">
        <div className="brand brand--landing">
          <img src="/assets/logo.png" alt="" className="brand__logo" />
          <span>Harbor Tickets</span>
        </div>
        <div className="landing-nav__actions">
          <Link className="button button--secondary" to="/login">
            Log in
          </Link>
          <Link className="button" to="/signup">
            Sign up
          </Link>
        </div>
      </header>

      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero__content">
          <p className="landing-kicker">AI-assisted IT support</p>
          <h1 id="landing-title">A calmer harbor for every support request.</h1>
          <p className="landing-copy">
            Get grounded answers, track your tickets, and reach the right IT
            agent without losing the thread.
          </p>
          <div className="landing-actions">
            <Link className="button landing-button" to="/signup">
              Create an account
            </Link>
            <Link
              className="button button--secondary landing-button"
              to="/login"
            >
              Sign in
            </Link>
          </div>
        </div>
        <div className="landing-hero__visual" aria-hidden="true">
          <img src="/assets/logo.png" alt="" />
        </div>
      </section>
    </main>
  );
}
