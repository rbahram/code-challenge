import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import { Socket } from 'socket.io-client';

type Props = { socket: Socket };
interface ConnectError {
  reason?: string;
  message?: string;
}

const rid = () => Math.random().toString(36).slice(2, 6) + Math.random().toString(36).slice(2, 6);

export default function Home({ socket }: Props) {
  const navigate = useNavigate();
  const [selfId, setSelfId] = useState<string>(() => localStorage.getItem('selfId') || rid());
  const [targetId, setTargetId] = useState('');
  const [registered, setRegistered] = useState(false);
  const [status, setStatus] = useState<string>('Not connected');

  // keep a stable ref to current ids we’ll use in callbacks
  const ids = useMemo(() => ({ selfId, targetId }), [selfId, targetId]);

  useEffect(() => {
    if (!socket.connected) socket.connect();

    const onConnect = () => {
      socket.emit('register', ids.selfId, (ok: boolean) => {
        setRegistered(ok);
        setStatus(ok ? `Registered as ${ids.selfId}` : 'Registration failed');
        if (ok) localStorage.setItem('selfId', ids.selfId);
      });
    };

    if (socket.connected) onConnect();
    socket.on('connect', onConnect);

    const onInvite = ({ fromId }: { fromId: string }) => {
      const accept = window.confirm(`Incoming chat from "${fromId}". Accept?`);
      if (accept) {
        socket.emit('accept', { fromId: ids.selfId, toId: fromId, inviteId: 'x' });
      } else {
        socket.emit('reject', { fromId: ids.selfId, toId: fromId, inviteId: 'x' });
      }
    };

    // Navigate to chat when ready
    const onConnected = ({ roomId, a, b }: { roomId: string; a: string; b: string }) => {
      const other = a === ids.selfId ? b : a;
      sessionStorage.setItem('roomId', roomId);
      navigate(`/chat/${other}`);
    };

    socket.on('incoming-invite', onInvite);
    socket.on('connected', onConnected);

    const onConnectError = (err: unknown) => {
      let reason = 'Unknown error';

      if (typeof err === 'string') {
        reason = err;
      } else if (typeof err === 'object' && err !== null) {
        const e = err as ConnectError;
        reason = e.reason || e.message || 'Unknown error';
      }

      console.error('Socket connect error:', err);
      setStatus(`Connect error: ${reason}`);
    };

    socket.on('connect-error', onConnectError);

    return () => {
      socket.off('connect', onConnect);
      socket.off('incoming-invite', onInvite);
      socket.off('connected', onConnected);
      socket.off('connect-error', onConnectError);
    };
  }, [socket, ids, navigate]);

  const handleConnectRequest = () => {
    if (!registered) return alert('Registering… try again in a second.');
    if (!targetId.trim()) return alert('Enter a target ID');

    setStatus(`Connecting to ${targetId}…`);
    socket.emit('connect-request', { fromId: selfId, toId: targetId }, (ok: boolean, err?: string) => {
      if (!ok) {
        setStatus(err || 'Request failed');
        alert(err || 'Request failed');
      } else {
        setStatus('Invite sent. Waiting for acceptance…');
      }
    });
  };

  const randomizeId = () => {
    const id = rid();
    setSelfId(id);
    localStorage.setItem('selfId', id);
    // re-register with new id
    socket.emit('register', id, () => setRegistered(true));
  };

  return (
    <div style={{ maxWidth: 520, margin: '4rem auto', padding: '1.25rem' }}>
      <h1 style={{ marginBottom: 8 }}>Wave Chat</h1>
      <p style={{ color: '#666', marginTop: 0 }}>Enter your ID and the ID of the person you want to chat with.</p>

      <div style={{ display: 'grid', gap: 12 }}>
        <label>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Your ID</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={selfId}
              onChange={(e) => setSelfId(e.target.value)}
              placeholder="your-id"
              style={{ flex: 1, padding: '8px 10px' }}
            />
            <button onClick={randomizeId}>Random</button>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(selfId);
              }}
            >
              Copy
            </button>
          </div>
        </label>

        <button
          onClick={() => {
            socket.emit('register', selfId, (ok: boolean) => {
              setRegistered(ok);
              setStatus(ok ? `Registered as ${selfId}` : 'Registration failed');
              if (ok) localStorage.setItem('selfId', selfId);
            });
          }}
          disabled={!selfId.trim()}
        >
          {registered ? 'Re-register' : 'Register'}
        </button>

        <label>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Connect to user ID</div>
          <input
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            placeholder="their-id"
            style={{ width: '100%', padding: '8px 10px' }}
          />
        </label>

        <button onClick={handleConnectRequest} disabled={!registered || !targetId.trim()}>
          Connect
        </button>

        <div style={{ fontSize: 12, color: '#666' }}>{status}</div>
      </div>
    </div>
  );
}
