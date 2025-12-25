const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { getClient, redisReady } = require('./redis');
const websocketServer = require('./websocket-server');

let io;

const initRealtime = async (server, corsOrigins = []) => {
  // Initialize Socket.IO (for web clients)
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
    console.log(`[Realtime] Socket.IO client connected ${socket.id}`);
    socket.on('disconnect', (reason) => {
      console.log(`[Realtime] Socket.IO client disconnected ${socket.id} - ${reason}`);
    });
  });

  // Initialize WebSocket server (for mobile clients)
  websocketServer.initialize(server);
  websocketServer.startHeartbeat();

  return io;
};

const getIO = () => io;

const emitEvent = (event, payload) => {
  // Emit via Socket.IO (for web clients)
  if (io) {
    io.emit(event, payload);
  }

  // Emit via WebSocket (for mobile clients)
  switch (event) {
    case 'comment:created':
      if (payload.postId && payload.commentId && payload.userId) {
        websocketServer.broadcastCommentUpdate(
          payload.postId,
          payload.commentId,
          payload.userId
        );
      }
      break;

    case 'comment:deleted':
      if (payload.postId) {
        // Broadcast post update with new comment count
        websocketServer.broadcastPostUpdate(payload.postId, {
          comments: payload.commentCount || 0
        });
      }
      break;

    case 'post:likeToggled':
      if (payload.postId && payload.userId && typeof payload.isLiked === 'boolean') {
        websocketServer.broadcastLikeUpdate(
          payload.postId,
          payload.userId,
          payload.isLiked
        );
      }
      break;

    case 'post:created':
    case 'post:updated':
      if (payload.postId) {
        websocketServer.broadcastPostUpdate(payload.postId, payload);
      }
      break;

    case 'post:deleted':
      if (payload.postId) {
        websocketServer.broadcastPostUpdate(payload.postId, { deleted: true });
      }
      break;

    case 'notification:created':
      // payload.userId is the user ID (UUID), payload.userID is username
      if (payload.userId || payload.userID) {
        websocketServer.broadcastNotification(
          payload.userId || payload.userID,
          payload
        );
      }
      break;

    default:
      // For other events, try to broadcast if it has a postId
      if (payload.postId) {
        websocketServer.broadcastPostUpdate(payload.postId, payload);
      }
      break;
  }
};

module.exports = {
  initRealtime,
  getIO,
  emitEvent,
};



