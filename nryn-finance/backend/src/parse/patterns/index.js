'use strict';
const { senderToken } = require('../senders');

const MODULES = [
  require('./hdfc'),
  require('./icici'),
  require('./sbi'),
  require('./axis'),
  require('./kotak'),
  require('./upi-generic'),    // always last — the catch-all
];

/**
 * Ordered matcher: first confident hit wins. Bank-specific modules are tried
 * only when the sender token matches, so an HDFC parser never mangles an SBI
 * message.
 */
function runPatterns(body, ctx) {
  const token = senderToken(ctx.sender);
  for (const mod of MODULES) {
    if (mod.tokens && (!token || !mod.tokens.includes(token))) continue;
    try {
      const hit = mod.match(body, ctx);
      if (hit && hit.amount !== null && hit.direction) return hit;
    } catch (err) {
      console.warn(`  parse   pattern ${mod.id} threw: ${err.message}`);
    }
  }
  return null;
}

module.exports = { runPatterns, MODULES };
