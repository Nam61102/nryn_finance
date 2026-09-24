'use strict';
const { DateTime } = require('luxon');
const User = require('../db/models/User');
const Alert = require('../db/models/Alert');
const { status } = require('../finance/budget.service');
const { resolveMonth, ZONE } = require('../finance/period');
const { toRupees } = require('../parse/normalize');

/** 21:00 IST daily summary. Checked once a minute; fires once per day. */
function startDigestJob(io) {
  let lastRunDay = null;
  return setInterval(async () => {
    const now = DateTime.now().setZone(ZONE);
    const day = now.toFormat('yyyy-MM-dd');
    if (now.hour !== 21 || now.minute !== 0 || lastRunDay === day) return;
    lastRunDay = day;

    try {
      const users = await User.find().select('_id').lean();
      for (const u of users) {
        const s = await status(u._id, resolveMonth().month);
        const body = `Today: ₹${toRupees(s.todaySpent).toFixed(0)} · ${s.period.label} remaining: ₹${toRupees(s.ring.remaining).toFixed(0)}`;
        await Alert.create({ userId: u._id, type: 'digest', month: `${s.period.month}#${day}`, title: 'Daily summary', body, data: s.ring })
          .catch((e) => { if (e.code !== 11000) throw e; });
        io?.to(`user:${u._id}`).emit('digest', { title: 'Daily summary', body });
      }
    } catch (err) {
      console.error('  digest  job error:', err.message);
    }
  }, 60000);
}

module.exports = { startDigestJob };
