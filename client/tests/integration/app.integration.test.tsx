import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';

describe('App integration check', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          message: 'Hello from server',
          received: 'Hello from client',
        }),
      })
    );
  });

  it('shows the client message and the server response', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Send hello' }));

    expect(
      await screen.findByText('Client sent: Hello from client')
    ).toBeTruthy();
    expect(screen.getByText('Server replied: Hello from server')).toBeTruthy();
  });
});
