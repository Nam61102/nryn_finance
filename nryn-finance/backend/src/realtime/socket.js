'use strict';
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

/** Per-user room. Events: txn:new, budget:breach. */
function attachSocket(httpServer) {
  const io = new Server(httpServer, { cors: { origin: env.corsOrigins.length ? env.corsOrigins : true, credentials: true } });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('missing_token'));
    try {
      socket.userId = jwt.verify(token, env.jwtSecret).sub;
      next();
    } catch {
      next(new Error('invalid_token'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.userId}`);
    socket.emit('ready', { userId: socket.userId });
  });

  return io;
}

module.exports = { attachSocket };
