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
  const [pendingInviteFrom, setPendingInviteFrom] = useState<string | null>(null);

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
      setPendingInviteFrom(fromId);
      setStatus(`Incoming chat from ${fromId}`);
    };

    const onConnected = ({ roomId, a, b }: { roomId: string; a: string; b: string }) => {
      const other = a === ids.selfId ? b : a;
      sessionStorage.setItem('roomId', roomId);
      setPendingInviteFrom(null);
      navigate(`/chat/${other}`);
    };

    const onConnectError = (err: unknown) => {
      let reason = 'Unknown error';
      if (typeof err === 'string') reason = err;
      else if (typeof err === 'object' && err !== null) {
        const e = err as ConnectError;
        reason = e.reason ?? e.message ?? 'Unknown error';
      }
      setStatus(`Connect error: ${reason}`);
    };

    const onEnded = (_: { roomId: string; reason: 'left' | 'disconnect' | 'reject' }) => {
      setPendingInviteFrom(null);
    };

    socket.on('incoming-invite', onInvite);
    socket.on('connected', onConnected);
    socket.on('connect-error', onConnectError);
    socket.on('ended', onEnded);

    return () => {
      socket.off('connect', onConnect);
      socket.off('incoming-invite', onInvite);
      socket.off('connected', onConnected);
      socket.off('connect-error', onConnectError);
      socket.off('ended', onEnded);
    };
  }, [socket, ids, navigate]);

  const handleConnectRequest = () => {
    if (!registered) {
      setStatus('Please register first.');
      return;
    }
    if (!targetId.trim()) {
      setStatus('Enter a target ID.');
      return;
    }

    setStatus(`Connecting to ${targetId}…`);
    socket.emit('connect-request', { fromId: selfId, toId: targetId }, (ok: boolean, err?: string) => {
      if (!ok) {
        setStatus(`Connect error: ${err || 'Request failed'}`);
      } else {
        setStatus('Invite sent. Waiting for acceptance…');
      }
    });
  };

  const randomizeId = () => {
    const id = rid();
    setSelfId(id);
    localStorage.setItem('selfId', id);
    socket.emit('register', id, (ok: boolean) => {
      setRegistered(ok);
      setStatus(ok ? `Registered as ${id}` : 'Registration failed');
    });
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
            <button onClick={() => navigator.clipboard?.writeText(selfId)}>Copy</button>
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

        {pendingInviteFrom && (
          <div style={{ marginTop: 12, padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
            <div style={{ marginBottom: 8 }}>
              Incoming chat from <strong>{pendingInviteFrom}</strong>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  socket.emit('accept', { fromId: selfId, toId: pendingInviteFrom, inviteId: 'x' });
                  setStatus('Accepting invite…');
                }}
              >
                Accept
              </button>
              <button
                onClick={() => {
                  socket.emit('reject', { fromId: selfId, toId: pendingInviteFrom, inviteId: 'x' });
                  setPendingInviteFrom(null);
                  setStatus('Invite rejected.');
                }}
              >
                Reject
              </button>
            </div>
          </div>
        )}

        <div style={{ fontSize: 12, color: status.startsWith('Connect error') ? 'crimson' : '#666' }}>{status}</div>
      </div>
    </div>
  );
}
