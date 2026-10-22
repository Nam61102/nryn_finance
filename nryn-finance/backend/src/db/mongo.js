'use strict';
const mongoose = require('mongoose');
const env = require('../config/env');

let connected = false;
let lastError = null;

function sanitizeMongoUri(rawUri) {
  if (!rawUri) return rawUri;
  try {
    let clean = String(rawUri).trim();
    const schemeMatch = clean.match(/^(mongodb(?:\+srv)?:\/\/)(.*)$/);
    if (!schemeMatch) return clean;
    const prefix = schemeMatch[1];
    const rest = schemeMatch[2];
    const lastAtIndex = rest.lastIndexOf('@');
    if (lastAtIndex === -1) return clean;
    const creds = rest.substring(0, lastAtIndex).trim();
    let hostAndDb = rest.substring(lastAtIndex + 1).trim();
    const colonIndex = creds.indexOf(':');
    if (colonIndex === -1) return clean;
    let user = creds.substring(0, colonIndex).trim();
    let pass = creds.substring(colonIndex + 1).trim();
    if (pass.startsWith('<') && pass.endsWith('>')) {
      pass = pass.substring(1, pass.length - 1).trim();
    }
    const decodedPass = decodeURIComponent(pass);
    const encodedPass = encodeURIComponent(decodedPass);
    const encodedUser = encodeURIComponent(decodeURIComponent(user));
    return `${prefix}${encodedUser}:${encodedPass}@${hostAndDb}`;
  } catch {
    return rawUri;
  }
}

async function connect() {
  if (connected) return mongoose.connection;
  mongoose.set('strictQuery', true);
  const targetUri = sanitizeMongoUri(env.mongoUri);
  try {
    await mongoose.connect(targetUri, { serverSelectionTimeoutMS: 8000 });
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

module.exports = { connect, isConnected, getLastError, sanitizeMongoUri, mongoose };
