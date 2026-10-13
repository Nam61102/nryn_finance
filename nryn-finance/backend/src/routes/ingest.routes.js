'use strict';
const router = require('express').Router();
const c = require('../ingest/sms.controller');
const { requireAuth } = require('../auth/session.middleware');

router.use(requireAuth);
router.post('/sms', c.postSms);
router.get('/cursor', c.getCursor);
router.post('/backfill-done', c.markBackfillDone);
router.post('/seed-demo', c.seedDemo);
router.get('/stats', c.ingestStats);

module.exports = router;
