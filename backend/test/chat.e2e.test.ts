import { io as ioc, Socket } from 'socket.io-client';
import http from 'http';
import { AddressInfo } from 'net';
import express from 'express';
import { Server as IOServer } from 'socket.io';
import cors from 'cors';

function buildServer() {
  const app = express();
  app.use(cors({ origin: '*' }));
  const httpServer = http.createServer(app);
  const io = new IOServer(httpServer, { cors: { origin: '*' } });

  const users = new Map<string, string>();
  const rooms = new Map<string, string>();

  io.on('connection', (s) => {
    s.on('register', (id: string, ack?: any) => {
      users.set(id, s.id);
      ack?.(true);
    });

    s.on('connect-request', ({ fromId, toId }, ack?: any) => {
      io.to(users.get(toId)!).emit('incoming-invite', { fromId, toId, inviteId: 'x' });
      ack?.(true);
    });

    s.on('accept', ({ fromId, toId }, ack?: any) => {
      const room = 'r1';
      rooms.set(fromId, room);
      rooms.set(toId, room);
      io.sockets.sockets.get(users.get(fromId)!)?.join(room);
      io.sockets.sockets.get(users.get(toId)!)?.join(room);
      io.to(room).emit('connected', { roomId: room, a: fromId, b: toId });
      ack?.(true);
    });

    s.on('message', (m) => io.to(m.roomId).emit('message', { ...m, ts: Date.now() }));
  });

  return { httpServer, io };
}

const urlFor = (server: http.Server) => {
  const addr = server.address() as AddressInfo;
  return `http://localhost:${addr.port}`;
};

describe('chat flow', () => {
  let server: http.Server;
  let io: IOServer;

  beforeAll((done) => {
    const built = buildServer();
    server = built.httpServer;
    io = built.io;
    server.listen(0, done);
  });

  afterAll((done) => {
    io.close(); 
    server.close(done);
  });

  test('message goes through after connect/accept', (done) => {
    const base = urlFor(server);
    const a: Socket = ioc(base);
    const b: Socket = ioc(base);

    a.emit('register', 'alice');
    b.emit('register', 'bob');

    b.on('incoming-invite', ({ fromId }) => {
      expect(fromId).toBe('alice');
      b.emit('accept', { fromId: 'bob', toId: 'alice', inviteId: 'x' });
    });

    a.on('connected', ({ roomId }) => {
      a.emit('message', { roomId, senderId: 'alice', text: 'hi' });
    });

    b.on('message', (m) => {
      expect(m.text).toBe('hi');
      a.disconnect(); 
      b.disconnect();
      done();
    });

    a.emit('connect-request', { fromId: 'alice', toId: 'bob' });
  });


test('only room members receive messages', (done) => {
  const base = urlFor(server);
  const a: Socket = ioc(base); 
  const b: Socket = ioc(base); 
  const c: Socket = ioc(base); 

  a.emit('register', 'alice');
  b.emit('register', 'bob');
  c.emit('register', 'charlie');

  let bobGotMessage = false;
  let charlieGotMessage = false;

  b.on('incoming-invite', ({ fromId }) => {
    expect(fromId).toBe('alice');
    b.emit('accept', { fromId: 'bob', toId: 'alice', inviteId: 'x' });
  });

  a.on('connected', ({ roomId }) => {
    a.emit('message', { roomId, senderId: 'alice', text: 'secret' });
  });

  b.on('message', (m) => {
    expect(m.text).toBe('secret');
    bobGotMessage = true;
  });

  c.on('message', () => {
    charlieGotMessage = true;
  });

  // Give the events a moment to flow, then assert and clean up.
  setTimeout(() => {
    expect(bobGotMessage).toBe(true);
    expect(charlieGotMessage).toBe(false);

    a.disconnect();
    b.disconnect();
    c.disconnect();
    done();
  }, 300);

  a.emit('connect-request', { fromId: 'alice', toId: 'bob' });
});
});
