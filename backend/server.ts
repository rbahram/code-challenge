import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server as IOServer } from 'socket.io';

import CONFIG from './config';
import { Rooms, SocketToUserId, UserIdToSocket, UserToRoom } from './models';
import { isBusy, makeId } from './utils';

const app = express();
const router = express.Router();

const httpServer = http.createServer(app);
const io = new IOServer(httpServer, {
  path: '/socket.io', 
  cors: {
    origin: [
      'http://localhost:5173', 
      'https://*.ngrok-free.app' // allow any ngrok tunnel (for dev)
    ],
    methods: ['GET', 'POST']
  }
});

app.use(router);
app.use(cors(
  {
    origin: CONFIG.CORS_ORIGIN,
    methods: ['GET', 'POST']
  }
));

// Add health route to check if server is running fine.
app.get("/health", (_req, res) => {
  res.json({
    ok: true
  })
});

// End the room if user reject, disconnect or has left the chat.
function endRoom(roomId: string, reason: "left" | "disconnect" | "reject") {
  const meta = Rooms.get(roomId);
  if (!meta) return;
  const { a, b } = meta;

  io.to(roomId).emit("ended", { roomId, reason });
  [a, b].forEach((u) => UserToRoom.delete(u));
  Rooms.delete(roomId);
}


io.on('connection', (socket) => {
  // Register req
  socket.on('register', (userId: string, ack?: (ok: boolean, err?: string) => void) => {
    if (!userId || typeof userId !== 'string') {
      ack?.(false, 'Invalid userId');
      return;
    }

    // If this userId is already connected, kick the old socket.
    const existingSocketId = UserIdToSocket.get(userId);
    if (existingSocketId && existingSocketId !== socket.id) {
      io.sockets.sockets.get(existingSocketId)?.disconnect(true);
    }

    UserIdToSocket.set(userId, socket.id);
    SocketToUserId.set(socket.id, userId);

    socket.emit('registered', { userId });
    ack?.(true);
  });

  // Connect req
  socket.on('connect-request', (payload: { fromId: string; toId: string }, ack?: (ok: boolean, err?: string) => void) => {
    const { fromId, toId } = payload || {};
    if (!fromId || !toId || fromId === toId) {
      ack?.(false, 'Invalid connect payload');
      return;
    }

    // if the user already in a chat and try to connect return error
    if (isBusy(fromId)) {
      socket.emit('connect-error', { code: 'BUSY', reason: 'You are already in a chat.' });
      ack?.(false, 'You are busy');

      return;
    }

    const toSocketId = UserIdToSocket.get(toId);
    if (!toSocketId) {
      socket.emit('connect-error', { code: 'OFFLINE', toId });
      ack?.(false, 'Target offline');
      return;
    }

    // Check if the target is busy as well
    if (isBusy(toId)) {
      socket.emit('connect-error', { code: 'BUSY', toId });
      ack?.(false, 'Target busy');
    }

    const inviteId = makeId();
    io.to(toSocketId).emit('incoming-invite', { fromId, toId, inviteId });
    ack?.(true);
  });

  // Accept invite
  socket.on(
    'accept',
    (payload: { fromId: string; toId: string; inviteId: string }, ack?: (ok: boolean, err?: string) => void) => {
      const { fromId, toId } = payload || {};
      if (!fromId || !toId) {
        ack?.(false, 'Invalid accept payload');
        return;
      }
      if (isBusy(fromId) || isBusy(toId)) {
        ack?.(false, 'One party is busy');
        return;
      }

      const aSock = UserIdToSocket.get(fromId);
      const bSock = UserIdToSocket.get(toId);
      if (!aSock || !bSock) {
        ack?.(false, 'One party went offline');
        return;
      }

      const roomId = makeId();
      Rooms.set(roomId, { a: fromId, b: toId });
      UserToRoom.set(fromId, roomId);
      UserToRoom.set(toId, roomId);

      io.sockets.sockets.get(aSock)?.join(roomId);
      io.sockets.sockets.get(bSock)?.join(roomId);

      io.to(roomId).emit('connected', { roomId, a: fromId, b: toId });
      ack?.(true);
    }
  );

  // Reject invite
  socket.on('reject', (payload: { fromId: string; toId: string; inviteId: string }, ack?: (ok: boolean) => void) => {
    const { toId } = payload || {};
    const toSock = toId ? UserIdToSocket.get(toId) : undefined;
    if (toSock) io.to(toSock).emit('connect-error', { code: 'INVALID', reason: 'Invite rejected.' });
    ack?.(true);
  });

  // Chat Events
  socket.on('message', (payload: { roomId: string; senderId: string; text: string; ts?: number }) => {
    const { roomId, senderId, text } = payload || {};
    if (!roomId || !senderId || !text?.trim()) return;
    const ts = Date.now();
    io.to(roomId).emit('message', { roomId, senderId, text, ts });
  });

  // On typing
  socket.on('typing', (payload: { roomId: string; userId: string; isTyping: boolean }) => {
    const { roomId, userId, isTyping } = payload || {};
    if (!roomId || !userId) return;
    io.to(roomId).emit('typing', { roomId, userId, isTyping: !!isTyping });
  });

  // On Leave
  socket.on('leave', (payload: { roomId: string; userId: string }, ack?: (ok: boolean) => void) => {
    const { roomId } = payload || {};
    if (roomId) endRoom(roomId, 'left');
    ack?.(true);
  });

  // Cleanup On Disconnect 
  socket.on('disconnect', () => {
    const userId = SocketToUserId.get(socket.id);
    if (!userId) return;

    SocketToUserId.delete(socket.id);
    UserIdToSocket.delete(userId);

    const roomId = UserToRoom.get(userId);
    if (roomId) endRoom(roomId, 'disconnect');
  });
});

httpServer.listen(CONFIG.PORT, () => {
  console.log(`Server listening on *:${CONFIG.PORT} 🚀`);
});
