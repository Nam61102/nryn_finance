'use strict';
const mongoose = require('mongoose');
const env = require('../config/env');

let connected = false;
let lastError = null;

async function connect() {
  if (connected) return mongoose.connection;
  mongoose.set('strictQuery', true);
  try {
    await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 8000 });
    connected = true;
    lastError = null;
    const { host, port, name } = mongoose.connection;
    console.log(`  mongo   connected → ${host}:${port}/${name}`);
    mongoose.connection.on('disconnected', () => {
      connected = false;
      console.warn('  mongo   disconnected');
    });
    return mongoose.connection;
  } catch (err) {
    connected = false;
    lastError = err.message || String(err);
    console.error('  mongo   connection error:', lastError);
    throw err;
  }
}

const isConnected = () => mongoose.connection.readyState === 1;
const getLastError = () => lastError;

module.exports = { connect, isConnected, getLastError, mongoose };
