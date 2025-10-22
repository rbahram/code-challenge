import { BrowserRouter, Routes as RouterRoutes, Route } from 'react-router-dom';
import { io } from 'socket.io-client';

// Routes
import Chat from './Chat';
import Home from './Home';

const socket = io('/', { path: '/socket.io', transports: ['websocket', 'polling', 'flashsocket'] });

export default function Routes() {
  return (
    <BrowserRouter>
      <RouterRoutes>
        <Route path="/" element={<Home socket={socket} />} />
        <Route path="/chat/:userId" element={<Chat socket={socket} />} />
      </RouterRoutes>
    </BrowserRouter>
  );
}
