import { useState } from 'react';
import { sendHello } from '../api/hello.api';
import type { HelloResponse } from '../types';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export function HelloCard() {
  const [result, setResult] = useState<HelloResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function checkConnection() {
    setLoading(true);
    setError('');

    try {
      setResult(await sendHello(apiUrl, 'Hello from client'));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Could not reach the helpdesk API.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <h1>Client and server connection check</h1>
      <p>Send a greeting to the Express API and display its reply.</p>
      <button disabled={loading} onClick={checkConnection} type="button">
        {loading ? 'Sending...' : 'Send hello'}
      </button>
      {result && (
        <section aria-live="polite">
          <p>Client sent: {result.received}</p>
          <p>Server replied: {result.message}</p>
        </section>
      )}
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
