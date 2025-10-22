import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor, waitForElementToBeRemoved, within } from '@testing-library/react';
import Home from './Home';
import { FakeSocket, renderHome } from '../../tests/test-utils';

describe('pages/Home', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    // @ts-ignore - vitest global
    if ((globalThis as any).vi?.isFakeTimers?.()) (globalThis as any).vi.useRealTimers();
  });

  it('registers on mount (when socket.connected) and shows status', async () => {
    localStorage.setItem('selfId', 'alice');
    const socket = new FakeSocket();
    renderHome(<Home socket={socket as any} />);

    await screen.findByText(/Registered as alice/i);
    expect(socket.emit).toHaveBeenCalledWith('register', 'alice', expect.any(Function));
  });

  it('connects to target and shows "Invite sent" on success', async () => {
    localStorage.setItem('selfId', 'alice');
    const socket = new FakeSocket();
    renderHome(<Home socket={socket as any} />);

    await screen.findByText(/Registered as alice/i);

    const target = screen.getByLabelText(/Connect to user ID/i);
    fireEvent.change(target, { target: { value: 'bob' } });

    const connectBtn = screen.getByRole('button', { name: /connect/i });
    expect(connectBtn).toBeEnabled();
    fireEvent.click(connectBtn);

    await screen.findByText(/Invite sent\. Waiting for acceptance/i);
    expect(socket.emit).toHaveBeenCalledWith('connect-request', { fromId: 'alice', toId: 'bob' }, expect.any(Function));
  });

  it('shows incoming invite modal and handles reject', async () => {
    localStorage.setItem('selfId', 'alice');
    const socket = new FakeSocket();
    renderHome(<Home socket={socket as any} />);

    await screen.findByText(/Registered as alice/i);

    socket.trigger('incoming-invite', { fromId: 'charlie' });

    const modal = await screen.findByRole('dialog', { name: /incoming chat/i });
    within(modal).getByText(/charlie/i);
    within(modal).getByText(/wants to chat with you/i);

    const removal = waitForElementToBeRemoved(() => screen.getByRole('dialog', { name: /incoming chat/i }));

    fireEvent.click(within(modal).getByRole('button', { name: /reject/i }));

    await waitFor(() => {
      expect(socket.emit).toHaveBeenCalledWith('reject', {
        fromId: 'alice',
        toId: 'charlie',
        inviteId: 'x'
      });
    });

    await removal;
  });

  it('navigates to /chat/:other and stores roomId on "connected"', async () => {
    localStorage.setItem('selfId', 'alice');
    const socket = new FakeSocket();
    renderHome(<Home socket={socket as any} />);

    await screen.findByText(/Registered as alice/i);
    socket.trigger('connected', { roomId: 'room-1', a: 'alice', b: 'bob' });

    await screen.findByText(/chat page/i);
    expect(sessionStorage.getItem('roomId')).toBe('room-1');
  });

  it('surfaces connect-error message', async () => {
    localStorage.setItem('selfId', 'alice');
    const socket = new FakeSocket();
    renderHome(<Home socket={socket as any} />);

    socket.trigger('connect-error', { reason: 'Nope' });
    await screen.findByText(/Connect error: Nope/i);
  });

  it('randomize id calls register with the new id', async () => {
    const socket = new FakeSocket();
    (socket.emit as any).mockImplementation((event: string, _id: string, cb?: any) => {
      if (event === 'register') cb?.(true);
    });

    renderHome(<Home socket={socket as any} />);

    const randomBtn = screen.getByRole('button', { name: /reload/i });
    fireEvent.click(randomBtn);

    await waitFor(() => {
      const call = (socket.emit as any).mock.calls.find((c: any[]) => c[0] === 'register');
      expect(call).toBeTruthy();
      const newId = call[1] as string;
      expect(typeof newId).toBe('string');
      expect(newId.length).toBeGreaterThan(3);
    });
  });
});
