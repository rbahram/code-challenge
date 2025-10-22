import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Socket } from 'socket.io-client';
import {
  Layout,
  Typography,
  Space,
  Card,
  Input,
  Button,
  Divider,
  Tooltip,
  Modal,
  Alert,
  Grid,
  theme,
  App as AntApp
} from 'antd';
import { CopyOutlined, ReloadOutlined, SmileOutlined, LoginOutlined, LinkOutlined } from '@ant-design/icons';
import ThemeToggle from '../../theme/ThemeToggle';

type Props = { socket: Socket };

interface ConnectError {
  reason?: string;
  message?: string;
}

const { Header, Content, Footer } = Layout;
const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

const rid = () => Math.random().toString(36).slice(2, 6) + Math.random().toString(36).slice(2, 6);

export default function Home({ socket }: Props) {
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const { token } = theme.useToken();
  const { message } = AntApp.useApp();

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
      message?.error?.(reason);
    };

    const onEnded = () => setPendingInviteFrom(null);

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
  }, [socket, ids, navigate, message]);

  // Actions
  const doRegister = (id: string) => {
    socket.emit('register', id, (ok: boolean) => {
      setRegistered(ok);
      setStatus(ok ? `Registered as ${id}` : 'Registration failed');
      if (ok) localStorage.setItem('selfId', id);
    });
  };

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
      if (!ok) setStatus(`Connect error: ${err || 'Request failed'}`);
      else setStatus('Invite sent. Waiting for acceptance…');
    });
  };

  const randomizeId = () => {
    const id = rid();
    setSelfId(id);
    localStorage.setItem('selfId', id);
    doRegister(id);
  };

  const copyId = async () => {
    try {
      await navigator.clipboard?.writeText(selfId);
      setStatus('Your ID copied to clipboard.');
    } catch {
      setStatus('Failed to copy.');
    }
  };

  const acceptInvite = () => {
    if (!pendingInviteFrom) return;
    socket.emit('accept', { fromId: selfId, toId: pendingInviteFrom, inviteId: 'x' });
    setStatus('Accepting invite…');
  };

  const rejectInvite = () => {
    if (!pendingInviteFrom) return;
    socket.emit('reject', { fromId: selfId, toId: pendingInviteFrom, inviteId: 'x' });
    setPendingInviteFrom(null);
    setStatus('Invite rejected.');
  };

  const containerMaxWidth = screens.md ? 560 : '100%';

  return (
    <Layout style={{ minHeight: '100dvh', background: token.colorBgLayout }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingInline: screens.md ? 32 : 16
        }}
      >
        <Space align="center">
          <SmileOutlined style={{ fontSize: 20, color: '#fff' }} />
          <Text style={{ color: '#fff', fontWeight: 600 }}>Wave Chat</Text>
        </Space>
        <ThemeToggle />
      </Header>

      <Content style={{ display: 'grid', placeItems: 'center', padding: screens.md ? '48px 16px' : '24px 12px' }}>
        <Card
          style={{ width: '100%', maxWidth: containerMaxWidth, background: token.colorBgContainer }}
          bordered
          styles={{
            body: {
              padding: screens.md ? 24 : 16
            }
          }}
        >
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <div>
              <Title level={3} style={{ margin: 0 }}>
                Start a chat
              </Title>
              <Text type="secondary">Enter your ID and the ID you want to connect to.</Text>
            </div>

            <div>
              <Text strong>Your ID</Text>
              <Space.Compact block style={{ marginTop: 8 }}>
                <Input
                  value={selfId}
                  onChange={(e) => setSelfId(e.target.value)}
                  placeholder="your-id"
                  size="large"
                  aria-label="Your ID"
                />
                <Tooltip title="Random ID">
                  <Button icon={<ReloadOutlined />} size="large" onClick={randomizeId} />
                </Tooltip>
                <Tooltip title="Copy">
                  <Button icon={<CopyOutlined />} size="large" onClick={copyId} />
                </Tooltip>
              </Space.Compact>

              <div style={{ marginTop: 8 }}>
                <Button
                  type="primary"
                  icon={<LoginOutlined />}
                  size="large"
                  onClick={() => doRegister(selfId)}
                  disabled={!selfId.trim()}
                >
                  {registered ? 'Re-register' : 'Register'}
                </Button>
              </div>
            </div>

            <Divider style={{ margin: '8px 0' }} />

            <div>
              <Text strong>Connect to user ID</Text>
              <Space.Compact block style={{ marginTop: 8 }}>
                <Input
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  placeholder="their-id"
                  size="large"
                  aria-label="Connect to user ID"
                />
                <Button
                  type="primary"
                  icon={<LinkOutlined />}
                  size="large"
                  onClick={handleConnectRequest}
                  disabled={!registered || !targetId.trim()}
                >
                  Connect
                </Button>
              </Space.Compact>
            </div>

            {status && <Alert type={status.startsWith('Connect error') ? 'error' : 'info'} message={status} showIcon />}
          </Space>
        </Card>
      </Content>

      <Footer style={{ textAlign: 'center', opacity: 0.7 }}></Footer>

      <Modal
        open={!!pendingInviteFrom}
        title="Incoming Chat"
        onOk={acceptInvite}
        onCancel={rejectInvite}
        okText="Accept"
        cancelText="Reject"
        okButtonProps={{ type: 'primary' }}
        destroyOnClose
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>
            <Text strong>{pendingInviteFrom}</Text> wants to chat with you.
          </Text>
          <Text type="secondary">You can accept to join a room or reject to dismiss the invite.</Text>
        </Space>
      </Modal>
    </Layout>
  );
}
