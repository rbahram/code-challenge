import { useEffect, useMemo, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import { useNavigate, useParams } from 'react-router';
import {
  Layout,
  Typography,
  Space,
  Button,
  Grid,
  Input,
  Avatar,
  Tooltip,
  Affix,
  FloatButton,
  theme,
  App as AntApp
} from 'antd';
import { ArrowLeftOutlined, LogoutOutlined, SendOutlined, UserOutlined, ArrowDownOutlined } from '@ant-design/icons';
import './chat.css';

type Props = { socket: Socket };
type ChatMsg = { senderId: string; text: string; ts: number };

const { Header, Content } = Layout;
const { Text } = Typography;
const { TextArea } = Input;
const { useBreakpoint } = Grid;

export default function Chat({ socket }: Props) {
  const { userId: peerId = '' } = useParams();
  const navigate = useNavigate();
  const { message } = AntApp.useApp(); // available thanks to ThemeProvider
  const screens = useBreakpoint();
  const { token } = theme.useToken();

  const selfId = useMemo(() => localStorage.getItem('selfId') || 'me', []);
  const [roomId, setRoomId] = useState<string | null>(sessionStorage.getItem('roomId'));
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [peerTyping, setPeerTyping] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<number | null>(null);

  useEffect(() => {
    if (!socket.connected) socket.connect();
    socket.emit('register', selfId, () => {});
  }, [socket, selfId]);

  useEffect(() => {
    const onConnected = ({ roomId: r, a, b }: { roomId: string; a: string; b: string }) => {
      const other = a === selfId ? b : a;
      if (other !== peerId) navigate(`/chat/${other}`, { replace: true });
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
      sessionStorage.removeItem('roomId');
      message.info(`Chat ended (${reason}).`);
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
  }, [socket, selfId, peerId, navigate, message]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (nearBottom) scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
      setShowScrollBtn(!atBottom);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToBottom = () => scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });

  const send = () => {
    const text = input.trim();
    if (!roomId || !text) return;
    socket.emit('message', { roomId, senderId: selfId, text });
    setInput('');
    sendTyping(false);
  };

  const sendTyping = (isTyping: boolean) => {
    if (!roomId) return;
    socket.emit('typing', { roomId, userId: selfId, isTyping });
  };

  const onInputChange = (v: string) => {
    setInput(v);
    sendTyping(true);
    if (typingTimeout.current) window.clearTimeout(typingTimeout.current);
    typingTimeout.current = window.setTimeout(() => sendTyping(false), 950);
  };

  const leave = () => {
    if (!roomId) return navigate('/');
    socket.emit('leave', { roomId, userId: selfId }, () => {});
    sessionStorage.removeItem('roomId');
    navigate('/', { replace: true });
  };

  const shouldShowDayBreak = (i: number) => {
    if (i === 0) return true;
    const d1 = new Date(messages[i - 1].ts).toDateString();
    const d2 = new Date(messages[i].ts).toDateString();
    return d1 !== d2;
  };

  const containerMaxWidth = screens.md ? 820 : '100%';
  const bubbleMaxWidth = screens.md ? '68%' : '82%';

  return (
    <Layout style={{ minHeight: '100dvh', background: token.colorBgLayout }}>
      <Affix offsetTop={0}>
        <Header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingInline: screens.md ? 24 : 12
          }}
        >
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} aria-label="Back" />
            <Avatar size="small" icon={<UserOutlined />} />
            <Text style={{ color: '#fff', fontWeight: 600 }}>{peerId}</Text>
          </Space>
          <Space>
            <Text style={{ color: '#cbd5e1' }}>
              You: <strong>{selfId}</strong> {roomId ? `· room ${roomId}` : '· waiting…'}
            </Text>
            <Button danger type="primary" icon={<LogoutOutlined />} onClick={leave}>
              Leave
            </Button>
          </Space>
        </Header>
      </Affix>

      <Content
        style={{
          display: 'grid',
          placeItems: 'center',
          padding: screens.md ? '20px 12px' : '12px 8px'
        }}
      >
        <div
          ref={listRef}
          style={{
            width: '100%',
            maxWidth: containerMaxWidth,
            height: screens.md ? '70dvh' : '66dvh',
            borderRadius: 12,
            border: `1px solid ${token.colorBorder}`,
            padding: screens.md ? 16 : 10,
            overflow: 'auto',
            background: token.colorBgContainer
          }}
        >
          {messages.map((m, i) => {
            const mine = m.senderId === selfId;
            const timeLabel = new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return (
              <div key={`${m.ts}-${i}`}>
                {shouldShowDayBreak(i) && (
                  <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
                    <div
                      style={{
                        fontSize: 12,
                        opacity: 0.65,
                        padding: '2px 10px',
                        borderRadius: 999,
                        background: token.colorFillTertiary
                      }}
                    >
                      {new Date(m.ts).toLocaleDateString()}
                    </div>
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    justifyContent: mine ? 'flex-end' : 'flex-start',
                    gap: 8,
                    margin: '6px 0'
                  }}
                >
                  {!mine && <Avatar size="small">{(m.senderId || '?')[0]?.toUpperCase()}</Avatar>}

                  <Tooltip title={timeLabel}>
                    <div
                      style={{
                        maxWidth: bubbleMaxWidth,
                        padding: '10px 12px',
                        borderRadius: 14,
                        lineHeight: 1.35,
                        fontSize: 14,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        background: mine ? token.colorPrimaryBg : token.colorFillSecondary,
                        border: mine ? `1px solid ${token.colorPrimaryBorder}` : `1px solid ${token.colorBorder}`,
                        boxShadow: '0 1px 0 rgba(0,0,0,0.03)'
                      }}
                    >
                      {!mine && <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 2 }}>{m.senderId}</div>}
                      {m.text}
                    </div>
                  </Tooltip>

                  {mine && (
                    <Avatar size="small" style={{ background: token.colorPrimary }}>
                      {(selfId || '?')[0]?.toUpperCase()}
                    </Avatar>
                  )}
                </div>
              </div>
            );
          })}

          {peerTyping && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <Avatar size="small">{(peerId || '?')[0]?.toUpperCase()}</Avatar>
              <div className="typing-bubble" aria-live="polite">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            </div>
          )}

          <div ref={scrollAnchorRef} />
        </div>
      </Content>

      <div
        style={{
          position: 'sticky',
          bottom: 0,
          background: token.colorBgElevated,
          borderTop: `1px solid ${token.colorBorderSecondary}`,
          padding: screens.md ? '12px 16px' : '10px 10px',
          display: 'grid',
          placeItems: 'center'
        }}
      >
        <div style={{ width: '100%', maxWidth: containerMaxWidth, display: 'flex', gap: 8 }}>
          <TextArea
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Type a message"
            autoSize={{ minRows: 1, maxRows: 5 }}
          />
          <Button type="primary" icon={<SendOutlined />} onClick={send} disabled={!roomId || !input.trim()}>
            Send
          </Button>
        </div>
      </div>

      {showScrollBtn && (
        <FloatButton
          icon={<ArrowDownOutlined />}
          onClick={scrollToBottom}
          tooltip="Scroll to latest"
          style={{ right: 20, bottom: 90 }}
        />
      )}
    </Layout>
  );
}
