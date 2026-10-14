'use strict';
const router = require('express').Router();
const c = require('../ingest/sms.controller');
const { requireAuth } = require('../auth/session.middleware');

router.use(requireAuth);
router.post('/sms', c.postSms);
router.get('/cursor', c.getCursor);
router.post('/backfill-done', c.markBackfillDone);
// Demo seeding disabled: it injected fake Swiggy/Zepto/Zomato spends and fake budgets into real accounts.
// router.post('/seed-demo', c.seedDemo);
router.post('/reset-data', c.resetData);
router.post('/paste-sms', c.pasteSms);
router.get('/stats', c.ingestStats);

module.exports = router;
