'use strict';
/** Prove Mongo before anything else. `npm run db:indexes` */
require('dotenv').config();
const { connect, mongoose } = require('../src/db/mongo');

const MODELS = ['User', 'Device', 'RawMessage', 'Transaction', 'Merchant', 'Budget', 'Alert'];

(async () => {
  await connect();
  for (const name of MODELS) {
    const Model = require(`../src/db/models/${name}`);
    await Model.syncIndexes();
    const idx = await Model.collection.indexes();
    console.log(`  ${Model.collection.name.padEnd(20)} ${idx.length} indexes`);
  }
  console.log('\n  all indexes in place\n');
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
