// Run with: npm run test:filter   (node --experimental-strip-types)
import test from 'node:test';
import assert from 'node:assert';
import { isTransactional, rejectReason, filterTransactional, type RawSms } from '../src/native/sms.filter';

const sms = (address: string, body: string): RawSms => ({ _id: '1', address, body, date: Date.now() });

/* ── things that MUST pass ───────────────────────────────────────── */
const PASS: [string, string][] = [
  ['AD-HDFCBK', 'Rs.450.00 debited from a/c XX1234 on 21-09-26 to VPA swiggy@ybl. Ref 432198765123.'],
  ['VM-ICICIB', 'ICICI Bank Acct XX9012 debited for Rs 1,250.00 on 20-Sep-26; BIGBASKET credited. UPI:556677889900.'],
  ['JD-SBIUPI', 'Dear UPI user A/C X7788 debited by 180.0 on date 21Sep26 trf to ZEPTO Refno 119283746510. -SBI'],
  ['AD-AXISBK', 'Spent Card no. XX4455 INR 2399 21-09-26 AMAZON RETAIL Avl Lmt INR 87601'],
  ['VK-KOTAKB', 'Sent Rs.320.00 from Kotak Bank AC X3344 to uber@icici on 21-09-26. UPI Ref 998877665544'],
  ['JM-HDFCBK', 'Rs.85,000.00 credited to a/c XX1234 by NEFT from KINDERSPORTS LLP.'],  // operator prefix changed
];

for (const [sender, body] of PASS) {
  test(`passes: ${sender} — ${body.slice(0, 32)}…`, () => {
    assert.strictEqual(rejectReason(sms(sender, body)), null);
  });
}

/* ── things that MUST NEVER leave the phone ──────────────────────── */
const BLOCK: [string, string, string][] = [
  ['AD-HDFCBK', '123456 is your OTP for a txn of Rs.4,500 on card XX4455. Do not share with anyone.', 'excluded'],
  ['VM-ICICIB', 'Your One Time Password is 908172 for Rs 2,000 transfer. Never share this.', 'excluded'],
  ['AD-HDFCBK', 'Pre-approved loan of Rs.5,00,000! Apply now at hdfc.in/loan. T&C apply.', 'excluded'],
  ['VM-ICICIB', 'Get cashback upto Rs 500 on your next UPI payment. Click here.', 'excluded'],
  ['+919876543210', 'Hey can you send me Rs 500 for dinner? I paid the whole bill', 'sender'],
  ['MUMMY', 'Beta I paid Rs 2000 to the electrician today', 'sender'],
  ['AD-HDFCBK', 'Your account statement for September is ready. Login to view.', 'amount'],
  ['VM-ICICIB', 'Rs.50,000 is the new limit on your savings account.', 'txn_words'],
];

for (const [sender, body, reason] of BLOCK) {
  test(`blocks (${reason}): ${body.slice(0, 40)}…`, () => {
    assert.strictEqual(isTransactional(sms(sender, body)), false, 'THIS MESSAGE WOULD HAVE LEFT THE PHONE');
    assert.strictEqual(rejectReason(sms(sender, body)), reason);
  });
}

test('an OTP that also looks transactional is still blocked', () => {
  // Gate 4 runs BEFORE gates 2 and 3 for exactly this reason: OTP messages
  // come from real bank senders and contain real amounts.
  const otp = sms('AD-HDFCBK', 'OTP 445566 for Rs.12,000 debited from a/c XX1234 via UPI. Do not share.');
  assert.strictEqual(isTransactional(otp), false);
});

test('a realistic inbox keeps only the bank messages', () => {
  const inbox = [
    ...PASS.map(([s, b]) => sms(s, b)),
    ...BLOCK.map(([s, b]) => sms(s, b)),
  ];
  const { kept, rejected } = filterTransactional(inbox);
  assert.strictEqual(kept.length, PASS.length);
  assert.strictEqual(Object.values(rejected).reduce((a, b) => a + b, 0), BLOCK.length);
});
