import { Avatar, theme } from 'antd';
import './typing-indicator.css';

interface Props {
  peerLabel?: string;
  showAvatar?: boolean;
}

export default function TypingIndicator({ peerLabel = '?', showAvatar = true }: Props) {
  const { token } = theme.useToken();

  return (
    <div className="ti-root">
      {showAvatar && (
        <Avatar size="small" style={{ background: token.colorFillSecondary }}>
          {(peerLabel || '?')[0]?.toUpperCase()}
        </Avatar>
      )}
      <div className="ti-bubble" aria-live="polite">
        <span className="ti-dot" />
        <span className="ti-dot" />
        <span className="ti-dot" />
      </div>
    </div>
  );
}
