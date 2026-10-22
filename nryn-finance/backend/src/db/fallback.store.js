'use strict';
const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(__dirname, '../../data/store.json');

let store = {
  users: [],
  budgets: [],
  transactions: [],
  rawMessages: [],
};

try {
  if (fs.existsSync(STORE_PATH)) {
    store = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    if (!Array.isArray(store.users)) store.users = [];
    if (!Array.isArray(store.budgets)) store.budgets = [];
    if (!Array.isArray(store.transactions)) store.transactions = [];
    if (!Array.isArray(store.rawMessages)) store.rawMessages = [];
  }
} catch (e) {
  console.warn('Fallback store load warning:', e.message);
}

function save() {
  try {
    const dir = path.dirname(STORE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
  } catch (e) {
    // non-blocking
  }
}

module.exports = {
  store,
  save,
};
