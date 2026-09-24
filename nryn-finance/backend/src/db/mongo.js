'use strict';
const mongoose = require('mongoose');
const env = require('../config/env');

let connected = false;

async function connect() {
  if (connected) return mongoose.connection;
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 8000 });
  connected = true;
  const { host, port, name } = mongoose.connection;
  console.log(`  mongo   connected → ${host}:${port}/${name}`);
  mongoose.connection.on('disconnected', () => {
    connected = false;
    console.warn('  mongo   disconnected');
  });
  return mongoose.connection;
}

const isConnected = () => mongoose.connection.readyState === 1;

module.exports = { connect, isConnected, mongoose };
