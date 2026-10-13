'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { detectLanguage, transcribeAudio } = require('../src/ai/whisper.client');
const { processChat } = require('../src/copilot/copilot.service');
const Transaction = require('../src/db/models/Transaction');
const Account = require('../src/db/models/Account');
const Policy = require('../src/db/models/Policy');
const User = require('../src/db/models/User');
const Budget = require('../src/db/models/Budget');
const mongoose = require('mongoose');

function mockChain(result) {
  const promise = Promise.resolve(result);
  const chain = {
    sort: () => chain,
    limit: () => chain,
    select: () => chain,
    lean: () => Promise.resolve(result),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
  };
  return chain;
}

test('detectLanguage correctly identifies Marathi, Hindi, Hinglish, and English', () => {
  // Marathi (Devanagari)
  const mrDev = detectLanguage('मी या महिन्यात Swiggy वर किती खर्च केला?');
  assert.equal(mrDev.code, 'mr');
  assert.equal(mrDev.name, 'Marathi');

  // Marathi (Latin)
  const mrLat = detectLanguage('kiti kharch jhala');
  assert.equal(mrLat.code, 'mr');
  assert.equal(mrLat.name, 'Marathi (Latin)');

  // Hindi (Devanagari)
  const hiDev = detectLanguage('क्या मैं आज 1500 का डिनर कर सकता हूँ?');
  assert.equal(hiDev.code, 'hi');
  assert.equal(hiDev.name, 'Hindi');

  // Hinglish (Latin)
  const hiLat = detectLanguage('kitna kharcha hua aaj');
  assert.equal(hiLat.code, 'hi');
  assert.equal(hiLat.name, 'Hinglish');

  // English
  const en = detectLanguage('Can I afford dinner for 1500 tonight?');
  assert.equal(en.code, 'en');
  assert.equal(en.name, 'English');

  // Empty string defaults to English
  const empty = detectLanguage('');
  assert.equal(empty.code, 'en');
});

test('processChat produces localized replies for Marathi and Hindi queries without budget', async () => {
  const origTxn = Transaction.find;
  const origAcc = Account.find;
  const origPol = Policy.find;
  const origUser = User.findById;
  const origBudgetFindOne = Budget.findOne;
  const origBudgetFind = Budget.find;

  Transaction.find = () => mockChain([]);
  Account.find = () => mockChain([]);
  Policy.find = () => mockChain([]);
  User.findById = () => mockChain({ _id: 'u1', taxRegime: null });
  Budget.findOne = () => mockChain(null);
  Budget.find = () => mockChain([]);

  try {
    const dummyUserId = new mongoose.Types.ObjectId();

    // Marathi query
    const resMr = await processChat(dummyUserId, 'मी आज 1500 चा डिनर करू शकतो का');
    assert.equal(resMr.ok, true);
    // Should reply with Marathi budget warning
    assert.match(resMr.reply, /तुम्ही अजून मासिक बजेट सेट केलेले नाही/);

    // Hindi query
    const resHi = await processChat(dummyUserId, 'क्या मैं आज 1500 का डिनर कर सकता हूँ');
    assert.equal(resHi.ok, true);
    // Should reply with Hindi budget warning
    assert.match(resHi.reply, /आपने अभी तक मासिक बजट सेट नहीं किया है/);
  } finally {
    Transaction.find = origTxn;
    Account.find = origAcc;
    Policy.find = origPol;
    User.findById = origUser;
    Budget.findOne = origBudgetFindOne;
    Budget.find = origBudgetFind;
  }
});

test('transcribeAudio handles missing STT provider keys gracefully', async () => {
  const dummyBuffer = Buffer.from('fake-audio-content');
  // In test environment without valid GROQ_API_KEY, transcribeAudio throws STT_UNAVAILABLE
  await assert.rejects(
    async () => {
      await transcribeAudio(dummyBuffer, 'test.m4a', 'audio/m4a');
    },
    (err) => {
      assert.equal(err.code, 'STT_UNAVAILABLE');
      return true;
    }
  );
});
