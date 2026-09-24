'use strict';
/**
 * Optional: load realistic Indian bank SMS for the signed-up user so the
 * dashboard has data before a real phone is connected.  `npm run db:demo -- you@email.com`
 */
require('dotenv').config();
const { connect, mongoose } = require('../src/db/mongo');
const User = require('../src/db/models/User');
const RawMessage = require('../src/db/models/RawMessage');
const Budget = require('../src/db/models/Budget');
const { drainPending } = require('../src/parse/parse.service');

const D = (daysAgo, hour = 13) => { const d = new Date(); d.setDate(d.getDate() - daysAgo); d.setHours(hour, 30, 0, 0); return d; };
const fmt = (d) => `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getFullYear()).slice(2)}`;

const SPENDS = [
  [0, 'AD-HDFCBK', 420, 'swiggy@ybl', 'upi'], [0, 'AD-HDFCBK', 145, 'zepto@ybl', 'upi'],
  [1, 'VK-KOTAKB', 320, 'uber@icici', 'upi'], [1, 'AD-HDFCBK', 2399, 'AMAZON RETAIL', 'card'],
  [2, 'JD-SBIUPI', 180, 'BLINKIT', 'upi'], [3, 'AD-HDFCBK', 899, 'zomato@ybl', 'upi'],
  [4, 'VM-ICICIB', 1250, 'BIGBASKET', 'upi'], [5, 'AD-AXISBK', 649, 'NETFLIX', 'card'],
  [6, 'AD-HDFCBK', 250, 'rapido@ybl', 'upi'], [7, 'AD-HDFCBK', 3200, 'DMART', 'card'],
  [8, 'JD-SBIUPI', 99, 'JIO RECHARGE', 'upi'], [9, 'VK-KOTAKB', 1599, 'MYNTRA', 'card'],
  [11, 'AD-HDFCBK', 540, 'swiggy@ybl', 'upi'], [12, 'VM-ICICIB', 780, 'APOLLO PHARMACY', 'card'],
  [14, 'AD-HDFCBK', 2100, 'INDIGO', 'card'], [16, 'JD-SBIUPI', 360, 'ola@ybl', 'upi'],
  [18, 'AD-HDFCBK', 1450, 'BLINKIT', 'upi'], [20, 'AD-AXISBK', 499, 'SPOTIFY', 'card'],
  [22, 'AD-HDFCBK', 675, 'dominos@ybl', 'upi'], [24, 'VM-ICICIB', 2800, 'CROMA', 'card'],
];

// These three MUST NOT count as spend — they are the §6.2 cases.
const NON_EXPENSE = [
  [10, 'AD-HDFCBK', 'Rs.24,500.00 debited from a/c XX1234 towards Credit Card Bill payment for card ending 4455 on {d}. Ref 771122334455.'],
  [5, 'AD-HDFCBK', 'Rs.10,000.00 debited from a/c XX1234 for SIP in Parag Parikh Flexi Cap Fund folio 88231 on {d}.'],
  [3, 'AD-AXISBK', 'Your txn of Rs.5000 on card XX4455 was DECLINED due to insufficient balance on {d}.'],
];

(async () => {
  await connect();
  const email = (process.argv[2] || '').toLowerCase();
  const user = email ? await User.findOne({ email }) : await User.findOne().sort({ createdAt: 1 });
  if (!user) { console.error('\n  No user found. Register in the app first, or pass an email.\n'); process.exit(1); }
  console.log(`\n  seeding demo data for ${user.email}\n`);

  let n = 0;
  const push = async (date, sender, body) => {
    await RawMessage.create({
      userId: user._id, source: 'sms', sourceId: `demo-${n++}`, sender,
      body, receivedAt: date, status: 'pending',
    }).catch((e) => { if (e.code !== 11000) throw e; });
  };

  for (const [days, sender, rupees, merchant, method] of SPENDS) {
    const d = D(days, 9 + (days % 12));
    const ref = String(100000000000 + Math.floor(Math.random() * 8e11));
    const body = method === 'upi'
      ? `Rs.${rupees.toFixed(2)} debited from a/c XX1234 on ${fmt(d)} to VPA ${merchant}. Ref ${ref}. Not you? Call 18002586161.`
      : `Spent Card no. XX4455 INR ${rupees} ${fmt(d)} ${merchant} Avl Lmt INR 87601. Not you? SMS BLOCK 4455`;
    await push(d, sender, body);
  }

  for (const [days, sender, tpl] of NON_EXPENSE) {
    const d = D(days, 11);
    await push(d, sender, tpl.replace('{d}', fmt(d)));
  }

  // Salary
  const sal = D(new Date().getDate() - 1, 10);
  await push(sal, 'AD-HDFCBK', `Rs.85,000.00 credited to a/c XX1234 on ${fmt(sal)} by NEFT from KINDERSPORTS LLP. Avl bal Rs 1,02,340.55`);

  const budgets = [['total', null, 3000000], ['category', 'food', 800000], ['category', 'groceries', 600000], ['category', 'transport', 400000], ['category', 'shopping', 700000], ['category', 'entertainment', 200000]];
  for (const [scope, category, amount] of budgets) {
    await Budget.updateOne({ userId: user._id, scope, category, month: null }, { $set: { amount, period: 'monthly' } }, { upsert: true });
  }

  console.log(`  ${n} raw messages queued · budgets set`);
  const stats = await drainPending({ limit: 500 });
  console.log('  parsed:', stats, '\n');
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
