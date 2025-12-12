const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { getClient, redisReady } = require('./redis');

let io;

const initRealtime = async (server, corsOrigins = []) => {
  io = new Server(server, {
    cors: {
      origin: corsOrigins,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      credentials: true,
    },
  });

  if (redisReady()) {
    const baseClient = getClient();
    const pubClient = baseClient.duplicate();
    const subClient = baseClient.duplicate();
    io.adapter(createAdapter(pubClient, subClient));
    console.log('[Realtime] using Redis adapter');
  } else {
    console.log('[Realtime] Redis not ready, using default in-memory adapter');
  }

  io.on('connection', (socket) => {
    console.log(`[Realtime] client connected ${socket.id}`);
    socket.on('disconnect', (reason) => {
      console.log(`[Realtime] client disconnected ${socket.id} - ${reason}`);
    });
  });

  return io;
};

const getIO = () => io;

const emitEvent = (event, payload) => {
  if (!io) return;
  io.emit(event, payload);
};

module.exports = {
  initRealtime,
  getIO,
  emitEvent,
};



