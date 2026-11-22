import type { HelloResponse } from '../types';

export async function sendHello(
  apiUrl: string,
  message: string
): Promise<HelloResponse> {
  const response = await fetch(`${apiUrl}/api/hello`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    throw new Error(`The helpdesk API returned HTTP ${response.status}.`);
  }

  return (await response.json()) as HelloResponse;
}
