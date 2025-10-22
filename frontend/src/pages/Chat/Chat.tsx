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
  App as AntApp,
  theme
} from 'antd';
import { ArrowLeftOutlined, LogoutOutlined, SendOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { useDebouncedCallback } from 'use-debounce';

import './chat.css';

type Props = { socket: Socket };
type ChatMsg = { senderId: string; text: string; ts: number };

const { Header, Content } = Layout;
const { Text } = Typography;
const { TextArea } = Input;
const { useBreakpoint } = Grid;

const ModernTypingIndicator = ({ peerLabel }: { peerLabel: string }) => {
  const { token } = theme.useToken();
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 8,
        padding: '8px 0',
        animation: 'fadeIn 0.2s ease-in'
      }}
    >
      <Avatar size="small" style={{ marginBottom: 4, background: token.colorFillSecondary, color: token.colorText }}>
        {(peerLabel || '?')[0]?.toUpperCase()}
      </Avatar>
      <div
        style={{
          background: token.colorFillSecondary,
          borderRadius: 18,
          padding: '12px 16px',
          display: 'flex',
          gap: 6,
          alignItems: 'center',
          boxShadow: token.boxShadowTertiary
        }}
      >
        {[0, 200, 400].map((delay) => (
          <span
            key={delay}
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: token.colorTextQuaternary,
              animation: 'typingDot 1.4s infinite',
              animationDelay: `${delay}ms`
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default function Chat({ socket }: Props) {
  const { userId: peerId = '' } = useParams();
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
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

  const sendTyping = (isTyping: boolean) => {
    if (!roomId) return;
    socket.emit('typing', { roomId, userId: selfId, isTyping });
  };
  const debouncedStopTyping = useDebouncedCallback(() => sendTyping(false), 900);

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

  const onInputChange = (v: string) => {
    setInput(v);
    sendTyping(true);
    debouncedStopTyping();
  };

  useEffect(() => {
    return () => {
      if (roomId) socket.emit('typing', { roomId, userId: selfId, isTyping: false });
    };
  }, [roomId, selfId, socket]);

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
            paddingInline: screens.md ? 24 : 12,
            background: token.colorBgContainer,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            boxShadow: token.boxShadowTertiary
          }}
        >
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} aria-label="Back" type="text" />
            <Avatar size="default" style={{ background: token.colorPrimary, color: token.colorTextLightSolid }}>
              {(peerId || '?')[0]?.toUpperCase()}
            </Avatar>
            <div>
              {!peerTyping && (
                <Text style={{ color: token.colorText, fontWeight: 600, fontSize: 16, display: 'block' }}>
                  {peerId}
                </Text>
              )}
              {peerTyping && <Text style={{ color: token.colorPrimary, fontSize: 12 }}>typing...</Text>}
            </div>
          </Space>
          <Space>
            {screens.md && (
              <Text style={{ color: token.colorTextSecondary, fontSize: 13 }}>
                You: <strong>{selfId}</strong> {roomId ? `· room ${roomId}` : '· waiting…'}
              </Text>
            )}
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
          padding: screens.md ? '20px 12px' : '12px 8px',
          paddingBottom: screens.md ? '90px' : '90px'
        }}
      >
        <div
          ref={listRef}
          style={{
            width: '100%',
            maxWidth: containerMaxWidth,
            height: screens.md ? '70dvh' : '66dvh',
            borderRadius: token.borderRadiusLG,
            border: `1px solid ${token.colorBorderSecondary}`,
            padding: screens.md ? 20 : 12,
            overflow: 'auto',
            background: token.colorBgContainer,
            boxShadow: token.boxShadowTertiary
          }}
        >
          {messages.map((m, i) => {
            const mine = m.senderId === selfId;
            const timeLabel = new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return (
              <div key={`${m.ts}-${i}`}>
                {shouldShowDayBreak(i) && (
                  <div
                    className="modern-day-pill"
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      margin: '12px 0',
                      position: 'relative'
                    }}
                  >
                    <span
                      style={{
                        background: token.colorFillQuaternary,
                        color: token.colorTextSecondary,
                        fontSize: 12,
                        padding: '4px 10px',
                        borderRadius: 999,
                        border: `1px solid ${token.colorBorderSecondary}`
                      }}
                    >
                      {new Date(m.ts).toLocaleDateString()}
                    </span>
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    justifyContent: mine ? 'flex-end' : 'flex-start',
                    alignItems: 'flex-end',
                    gap: 8,
                    marginBottom: 12
                  }}
                >
                  {!mine && (
                    <Avatar
                      size="small"
                      style={{ marginBottom: 4, background: token.colorFillSecondary, color: token.colorText }}
                    >
                      {(m.senderId || '?')[0]?.toUpperCase()}
                    </Avatar>
                  )}

                  <Tooltip title={timeLabel} placement={mine ? 'left' : 'right'}>
                    <div
                      className="modern-msg-bubble"
                      style={{
                        maxWidth: bubbleMaxWidth,
                        padding: '10px 16px',
                        borderRadius: mine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                        background: mine ? token.colorPrimary : token.colorFillSecondary,
                        color: mine ? token.colorTextLightSolid : token.colorText,
                        boxShadow: mine ? token.boxShadowSecondary : token.boxShadowTertiary,
                        position: 'relative'
                      }}
                    >
                      {!mine && (
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            marginBottom: 2,
                            color: token.colorTextSecondary,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}
                        >
                          {m.senderId}
                        </div>
                      )}
                      {m.text}
                    </div>
                  </Tooltip>

                  {mine && (
                    <Avatar
                      size="small"
                      style={{ background: token.colorPrimary, color: token.colorTextLightSolid, marginBottom: 4 }}
                    >
                      {(selfId || '?')[0]?.toUpperCase()}
                    </Avatar>
                  )}
                </div>
              </div>
            );
          })}

          {peerTyping && <ModernTypingIndicator peerLabel={peerId} />}

          <div ref={scrollAnchorRef} />
        </div>
      </Content>

      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: token.colorBgContainer,
          borderTop: `1px solid ${token.colorBorderSecondary}`,
          padding: screens.md ? '16px' : '12px',
          display: 'grid',
          placeItems: 'center'
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: containerMaxWidth,
            display: 'flex',
            gap: 10,
            alignItems: 'flex-end'
          }}
        >
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
            style={{
              borderRadius: 20,
              padding: '10px 16px',
              fontSize: 15,
              border: `1px solid ${token.colorBorderSecondary}`,
              background: token.colorBgContainer,
              color: token.colorText
            }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={send}
            disabled={!roomId || !input.trim()}
            style={{
              height: 40,
              borderRadius: 20,
              boxShadow: token.boxShadowSecondary,
              fontWeight: 600
            }}
          >
            {screens.md && 'Send'}
          </Button>
        </div>
      </div>

      {showScrollBtn && (
        <FloatButton
          icon={<ArrowDownOutlined />}
          onClick={scrollToBottom}
          tooltip="Scroll to latest"
          style={{
            right: 24,
            bottom: 100
          }}
        />
      )}
    </Layout>
  );
}
