import { useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import { useNavigate, useParams } from 'react-router';

type Props = { socket: Socket };

type ChatMsg = { senderId: string; text: string; ts: number };

export default function Chat({ socket }: Props) {
  const { userId: peerId = '' } = useParams();
  const navigate = useNavigate();

  const selfId = localStorage.getItem('selfId') || 'me';
  const [roomId, setRoomId] = useState<string | null>(sessionStorage.getItem('roomId'));
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [peerTyping, setPeerTyping] = useState(false);
  const typingTimeout = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ensure this page is opened directly
  useEffect(() => {
    if (!socket.connected) socket.connect();
    socket.emit('register', selfId, () => {});
  }, [socket, selfId]);

  // socket listeners
  useEffect(() => {
    const onConnected = ({ roomId: r, a, b }: { roomId: string; a: string; b: string }) => {
      const other = a === selfId ? b : a;
      if (other !== peerId) {
        navigate(`/chat/${other}`, { replace: true });
      }
      setRoomId(r);
      sessionStorage.setItem('roomId', r);
    };

    const onMessage = (m: { roomId: string; senderId: string; text: string; ts: number }) => {
      setMessages((prev) => [...prev, { senderId: m.senderId, text: m.text, ts: m.ts }]);
    };

    const onTyping = ({ userId, isTyping }: { userId: string; isTyping: boolean }) => {
      if (userId !== selfId) setPeerTyping(!!isTyping);
    };

    const onEnded = ({ reason }: { roomId: string; reason: 'left' | 'disconnect' | 'reject' }) => {
      alert(`Chat ended (${reason}).`);
      sessionStorage.removeItem('roomId');
      navigate('/', { replace: true });
    };

    socket.on('connected', onConnected);
    socket.on('message', onMessage);
    socket.on('typing', onTyping);
    socket.on('ended', onEnded);

    return () => {
      socket.off('connected', onConnected);
      socket.off('message', onMessage);
      socket.off('typing', onTyping);
      socket.off('ended', onEnded);
    };
  }, [socket, selfId, peerId, navigate]);

  // autoscroll
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = () => {
    if (!roomId || !input.trim()) return;
    socket.emit('message', { roomId, senderId: selfId, text: input.trim() });
    setInput('');
  };

  const sendTyping = (isTyping: boolean) => {
    if (!roomId) return;
    socket.emit('typing', { roomId, userId: selfId, isTyping });
  };

  const onInputChange = (v: string) => {
    setInput(v);
    sendTyping(true);
    if (typingTimeout.current) window.clearTimeout(typingTimeout.current);
    typingTimeout.current = window.setTimeout(() => sendTyping(false), 1000);
  };

  const leave = () => {
    if (!roomId) return navigate('/');
    socket.emit('leave', { roomId, userId: selfId }, () => {});
    sessionStorage.removeItem('roomId');
    navigate('/', { replace: true });
  };

  return (
    <div style={{ maxWidth: 720, margin: '2rem auto', padding: '1rem' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 600 }}>Chat with {peerId}</div>
          <div style={{ fontSize: 12, color: '#666' }}>
            You: <strong>{selfId}</strong> {roomId ? `· room ${roomId}` : '(waiting for room)'}
          </div>
        </div>
        <button onClick={leave}>Leave</button>
      </header>

      <main
        style={{ marginTop: 16, border: '1px solid #eee', borderRadius: 8, padding: 12, height: 420, overflow: 'auto' }}
      >
        {messages.map((m, i) => {
          const mine = m.senderId === selfId;
          return (
            <div key={i} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', margin: '6px 0' }}>
              <div
                style={{
                  maxWidth: '70%',
                  padding: '8px 10px',
                  borderRadius: 10,
                  background: mine ? '#daf0ff' : '#f3f3f3',
                  fontSize: 14,
                  whiteSpace: 'pre-wrap'
                }}
                title={new Date(m.ts).toLocaleTimeString()}
              >
                {!mine && <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 2 }}>{m.senderId}</div>}
                {m.text}
              </div>
            </div>
          );
        })}
        {peerTyping && <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>… {peerId} is typing</div>}
        <div ref={scrollRef} />
      </main>

      <footer style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send();
          }}
          placeholder="Type a message"
          style={{ flex: 1, padding: '10px 12px' }}
        />
        <button onClick={send} disabled={!roomId || !input.trim()}>
          Send
        </button>
      </footer>
    </div>
  );
}
