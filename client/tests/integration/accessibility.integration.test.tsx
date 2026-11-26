import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createFakeSupabase,
  deferred,
  meHandler,
  mockApi,
  profiles,
  renderApp,
  type ApiCall,
  type FakeSupabase,
} from '../helpers/fakes';

/**
 * S4-06 regression checks: page titles, focus management, announcements and
 * reading order for the critical employee and agent journeys.
 */
let fake: FakeSupabase;
vi.mock('../../src/shared/supabase/client', () => ({
  getSupabase: () => fake,
  setSessionPersistence: vi.fn(),
}));

const employeeApi = (call: ApiCall) =>
  meHandler(profiles.dana)(call) ??
  (call.path === '/api/conversations'
    ? { status: 200, body: { conversations: [] } }
    : undefined) ??
  (call.path === '/api/tickets'
    ? { status: 200, body: { tickets: [] } }
    : undefined);

describe('accessibility regressions (S4-06)', () => {
  beforeEach(() => {
    fake = createFakeSupabase({ session: { access_token: 'dana-token' } });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('gives each screen a unique document title', async () => {
    mockApi(employeeApi);
    renderApp('/chat');
    await screen.findByRole('heading', { level: 1, name: 'Ask IT' });
    await waitFor(() => expect(document.title).toBe('Chat · Harbor Tickets'));

    fireEvent.click(screen.getByRole('link', { name: 'My tickets' }));
    await screen.findByRole('heading', { level: 1, name: 'My tickets' });
    await waitFor(() =>
      expect(document.title).toBe('My tickets · Harbor Tickets')
    );
  });

  it('moves focus to the new page heading after navigating between sections', async () => {
    mockApi(employeeApi);
    renderApp('/chat');
    await screen.findByRole('heading', { level: 1, name: 'Ask IT' });

    fireEvent.click(screen.getByRole('link', { name: 'My tickets' }));
    const heading = await screen.findByRole('heading', {
      level: 1,
      name: 'My tickets',
    });
    await waitFor(() => expect(heading).toHaveFocus());
  });

  it('collapses the sidebar and supports manual drag ordering', async () => {
    localStorage.removeItem('harbor-sidebar-collapsed');
    localStorage.removeItem('harbor-nav-order:employee');
    mockApi(employeeApi);
    renderApp('/chat');

    const navigation = await screen.findByRole('navigation', { name: 'Main' });
    const sidebar = navigation.closest('aside')!;
    const mainSidebarToggle = screen.getByRole('button', {
      name: 'Collapse sidebar',
    });
    expect(
      mainSidebarToggle.compareDocumentPosition(navigation) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(screen.queryByLabelText('Sort navigation')).toBeNull();
    fireEvent.click(
      screen.getByRole('button', { name: 'Show sidebar sort options' })
    );
    expect(screen.getByLabelText('Sort navigation')).toHaveValue('manual');
    fireEvent.click(
      screen.getByRole('button', { name: 'Hide sidebar sort options' })
    );
    expect(screen.queryByLabelText('Sort navigation')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(sidebar).toHaveClass('app-sidebar--collapsed');
    expect(localStorage.getItem('harbor-sidebar-collapsed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }));
    expect(sidebar).not.toHaveClass('app-sidebar--collapsed');

    const source = screen
      .getByRole('link', { name: 'Dashboard' })
      .closest('li')!;
    const target = screen
      .getByRole('link', { name: 'My tickets' })
      .closest('li')!;
    const dataTransfer = {
      effectAllowed: 'none',
      setData: vi.fn(),
      getData: vi.fn(() => '/dashboard'),
    };
    fireEvent.dragStart(source, { dataTransfer });
    fireEvent.drop(target, { dataTransfer });

    const links = within(sidebar)
      .getAllByRole('link')
      .map((link) => link.textContent);
    expect(links.slice(0, 3)).toEqual(['Chat', 'My tickets', 'Dashboard']);
    await waitFor(() =>
      expect(localStorage.getItem('harbor-nav-order:employee')).toContain(
        '/dashboard'
      )
    );
  });

  it('keeps focus in the composer while sending and announces the reply', async () => {
    const pending = deferred<{ status: number; body: unknown }>();
    mockApi(
      (call) =>
        employeeApi(call) ??
        (call.path === '/api/chat/messages' ? pending.promise : undefined)
    );
    renderApp('/chat');
    const input = await screen.findByLabelText('Describe your IT issue');
    input.focus();
    fireEvent.change(input, { target: { value: 'VPN drops every hour' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // The field is never disabled, so keyboard focus is not lost.
    await screen.findByRole('button', { name: 'Sending…' });
    expect(input).not.toBeDisabled();
    expect(input).toHaveFocus();

    const now = '2026-11-20T10:00:00.000Z';
    const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    pending.resolve({
      status: 201,
      body: {
        conversationId: id,
        conversation: { id, title: 'VPN', createdAt: now, updatedAt: now },
        userMessage: {
          id: 'u1',
          conversationId: id,
          senderType: 'user',
          content: 'VPN drops every hour',
          outcome: null,
          sourceRefs: [],
          createdAt: now,
        },
        message: {
          id: 'a1',
          conversationId: id,
          senderType: 'assistant',
          content: 'Reconnect using the approved VPN profile.',
          outcome: 'answered',
          sourceRefs: [
            {
              articleId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
              title: 'VPN troubleshooting',
              sourceName: 'IT Operations Guide',
              excerpt: 'Reconnect using the approved profile.',
              relevance: 0.9,
            },
          ],
          createdAt: now,
        },
        outcome: 'answered',
      },
    });

    await screen.findByText('Reconnect using the approved VPN profile.');
    expect(
      screen.getByText('Assistant replied with 1 source.')
    ).toHaveAttribute('role', 'status');
    // The log does not re-announce every message itself.
    expect(screen.getByRole('log', { name: 'Conversation' })).toHaveAttribute(
      'aria-live',
      'off'
    );
    // The source summary's accessible name matches its visible text.
    const summary = screen.getByText('VPN troubleshooting').closest('summary');
    expect(summary).not.toHaveAttribute('aria-label');
    expect(summary).toHaveTextContent(
      '[1] VPN troubleshooting · IT Operations Guide'
    );
  });

  it('moves focus to the secret warning and back to the field on edit', async () => {
    mockApi(employeeApi);
    renderApp('/chat');
    const input = await screen.findByLabelText('Describe your IT issue');
    fireEvent.change(input, { target: { value: 'my password is Hunter2!x9' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    const warning = await screen.findByRole('alert');
    expect(warning).toHaveFocus();
    fireEvent.click(
      within(warning).getByRole('button', { name: 'Edit message' })
    );
    expect(input).toHaveFocus();
  });

  it('moves focus to the composer after choosing a suggestion', async () => {
    mockApi(employeeApi);
    renderApp('/chat');
    const chip = await screen.findByRole('button', {
      name: 'What is included in laptop onboarding?',
    });
    fireEvent.click(chip);
    const input = screen.getByLabelText('Describe your IT issue');
    expect(input).toHaveValue('What is included in laptop onboarding?');
    expect(input).toHaveFocus();
  });

  it('puts the chat before past conversations in reading order', async () => {
    mockApi(employeeApi);
    renderApp('/chat');
    const main = await screen.findByRole('heading', {
      level: 1,
      name: 'Ask IT',
    });
    const sidebar = screen.getByRole('complementary', {
      name: 'Conversations',
    });
    expect(
      main.compareDocumentPosition(sidebar) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('announces how many tickets match the queue filters', async () => {
    fake = createFakeSupabase({ session: { access_token: 'lee-token' } });
    mockApi(
      (call) =>
        meHandler(profiles.ari)(call) ??
        (call.path === '/api/agents'
          ? { status: 200, body: { agents: [] } }
          : undefined) ??
        (call.path === '/api/tickets'
          ? { status: 200, body: { tickets: [] } }
          : undefined)
    );
    renderApp('/queue');
    expect(await screen.findByText('0 tickets shown.')).toHaveAttribute(
      'role',
      'status'
    );
    await waitFor(() => expect(document.title).toBe('Queue · Harbor Tickets'));
  });

  it('shows dashboard totals without date-range controls', async () => {
    fake = createFakeSupabase({ session: { access_token: 'lee-token' } });
    mockApi(
      (call) =>
        meHandler(profiles.lee)(call) ??
        (call.path.startsWith('/api/analytics/summary')
          ? {
              status: 200,
              body: {
                summary: {
                  totalTickets: 0,
                  assignedTickets: 0,
                  byStatus: { pending: 0, in_progress: 0, resolved: 0 },
                  openByPriority: { low: 0, medium: 0, high: 0, urgent: 0 },
                },
              },
            }
          : call.path === '/api/tickets'
            ? { status: 200, body: { tickets: [] } }
            : undefined)
    );
    renderApp('/dashboard');
    expect(
      await screen.findByRole('heading', { name: 'Agent dashboard' })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('From')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('To')).not.toBeInTheDocument();
    expect(screen.queryByText(/in range/)).not.toBeInTheDocument();
  });
});
