import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import Chat from './Chat';
import { FakeSocket, renderChat } from '../../tests/test-utils';

vi.mock('use-debounce', () => ({
  useDebouncedCallback: (fn: any) => fn
}));

describe('pages/Chat', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('selfId', 'alice');
    sessionStorage.setItem('roomId', 'r1'); // allow sending
  });

  it('registers self on mount', async () => {
    const socket = new FakeSocket();
    renderChat(<Chat socket={socket as any} />, '/chat/bob');

    await waitFor(() => {
      expect(socket.emit).toHaveBeenCalledWith('register', 'alice', expect.any(Function));
    });

    expect(await screen.findByText('bob')).toBeInTheDocument();
  });

  it('sends a message with Enter and clears input', async () => {
    const socket = new FakeSocket();
    renderChat(<Chat socket={socket as any} />, '/chat/bob');

    const input = await screen.findByPlaceholderText(/Type a message/i);
    fireEvent.change(input, { target: { value: 'hello world' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', shiftKey: false });

    expect(socket.emit).toHaveBeenCalledWith('message', { roomId: 'r1', senderId: 'alice', text: 'hello world' });

    await waitFor(() => expect((input as HTMLTextAreaElement).value).toBe(''));
  });

  it('emits typing true/false on input change (debounce mocked immediate)', async () => {
    const socket = new FakeSocket();
    renderChat(<Chat socket={socket as any} />, '/chat/bob');

    const input = await screen.findByPlaceholderText(/Type a message/i);
    fireEvent.change(input, { target: { value: 'h' } });

    expect(socket.emit).toHaveBeenCalledWith('typing', { roomId: 'r1', userId: 'alice', isTyping: true });
    expect(socket.emit).toHaveBeenCalledWith('typing', { roomId: 'r1', userId: 'alice', isTyping: false });
  });

  it('renders incoming messages and typing indicator', async () => {
    const socket = new FakeSocket();
    renderChat(<Chat socket={socket as any} />, '/chat/bob');

    socket.trigger('message', { roomId: 'r1', senderId: 'bob', text: 'yo', ts: Date.now() });
    expect(await screen.findByText('yo')).toBeInTheDocument();

    socket.trigger('typing', { userId: 'bob', isTyping: true });
    expect(await screen.findByText(/typing\.\.\./i)).toBeInTheDocument();

    socket.trigger('typing', { userId: 'bob', isTyping: false });
    await waitFor(() => expect(screen.queryByText(/typing\.\.\./i)).toBeNull());
  });

  it('leave emits and navigates home, clearing roomId', async () => {
    const socket = new FakeSocket();
    renderChat(<Chat socket={socket as any} />, '/chat/bob');

    const leaveBtn = await screen.findByRole('button', { name: /leave/i });
    fireEvent.click(leaveBtn);

    await waitFor(() => {
      expect(socket.emit).toHaveBeenCalledWith('leave', { roomId: 'r1', userId: 'alice' }, expect.any(Function));
    });

    expect(await screen.findByText(/home/i)).toBeInTheDocument();
    expect(sessionStorage.getItem('roomId')).toBeNull();
  });

  it('handles "connected" by updating roomId and normalizing peer id', async () => {
    const socket = new FakeSocket();
    renderChat(<Chat socket={socket as any} />, '/chat/charlie');

    socket.trigger('connected', { roomId: 'room-2', a: 'bob', b: 'alice' });

    await waitFor(() => {
      expect(sessionStorage.getItem('roomId')).toBe('room-2');
    });
    expect(await screen.findByText('bob')).toBeInTheDocument();
  });

  it('handles "ended" by navigating home and clearing room', async () => {
    const socket = new FakeSocket();
    renderChat(<Chat socket={socket as any} />, '/chat/bob');

    socket.trigger('ended', { roomId: 'r1', reason: 'left' });

    expect(await screen.findByText(/home/i)).toBeInTheDocument();
    expect(sessionStorage.getItem('roomId')).toBeNull();
  });
});
