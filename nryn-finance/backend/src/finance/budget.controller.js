'use strict';
const Budget = require('../db/models/Budget');
const Alert = require('../db/models/Alert');
const { status } = require('./budget.service');
const { monthSummary } = require('./analytics.service');
const { resolveMonth } = require('./period');
const { CATEGORY_KEYS } = require('../shared/categories');
const N = require('../parse/normalize');
const { isConnected } = require('../db/mongo');
const { store, save } = require('../db/fallback.store');

async function listBudgets(req, res) {
  try {
    if (!isConnected()) {
      const list = store.budgets.filter((b) => b.userId === req.userId);
      return res.json({ budgets: list });
    }
    const month = req.query.month ? resolveMonth(req.query.month).month : null;
    const q = { userId: req.userId };
    if (month) q.$or = [{ month }, { month: null }];
    res.json({ budgets: await Budget.find(q).lean() });
  } catch (err) {
    res.json({ budgets: store.budgets.filter((b) => b.userId === req.userId) });
  }
}

async function upsertBudget(req, res, next) {
  try {
    const { scope = 'category', category = null, amount, amountPaise, month = null } = req.body || {};
    const paise = amountPaise ?? N.toPaise(amount);
    if (paise === null || isNaN(paise) || paise < 0) {
      return res.status(400).json({ error: 'valid_amount_required' });
    }
    if (scope === 'category' && !CATEGORY_KEYS.includes(category)) {
      return res.status(400).json({ error: 'invalid_category' });
    }

    const targetCategory = (scope === 'total' || scope === 'daily') ? null : category;
    const targetMonth = month ? resolveMonth(month).month : null;

    if (!isConnected()) {
      let b = store.budgets.find(
        (x) => x.userId === req.userId && x.scope === scope && x.category === targetCategory
      );
      if (!b) {
        b = {
          _id: 'b_' + Date.now(),
          userId: req.userId,
          scope,
          category: targetCategory,
          amount: paise,
          period: scope === 'daily' ? 'daily' : 'monthly',
          month: targetMonth,
        };
        store.budgets.push(b);
      } else {
        b.amount = paise;
        b.period = scope === 'daily' ? 'daily' : 'monthly';
      }
      save();
      return res.json({ ok: true, budget: b });
    }

    const key = { userId: req.userId, scope, category: targetCategory, month: targetMonth };
    const budget = await Budget.findOneAndUpdate(
      key,
      { $set: { amount: paise, period: scope === 'daily' ? 'daily' : 'monthly' } },
      { upsert: true, new: true }
    );

    if (!targetMonth) {
      try {
        const curMonth = resolveMonth().month;
        await Budget.updateMany(
          { userId: req.userId, scope, category: targetCategory, month: curMonth },
          { $set: { amount: paise } }
        );
      } catch (errSync) {
        // non-blocking
      }
    }

    res.json({ ok: true, budget });
  } catch (err) {
    console.error('upsertBudget error:', err);
    res.status(500).json({ error: err.message || 'failed_to_save_budget' });
  }
}

async function patchBudget(req, res) {
  try {
    const { amount, amountPaise } = req.body || {};
    const paise = amountPaise ?? N.toPaise(amount);
    if (paise === null || paise < 0) return res.status(400).json({ error: 'valid_amount_required' });

    if (!isConnected()) {
      const b = store.budgets.find((x) => x._id === req.params.id && x.userId === req.userId);
      if (!b) return res.status(404).json({ error: 'not_found' });
      b.amount = paise;
      save();
      return res.json({ budget: b });
    }

    const budget = await Budget.findOneAndUpdate({ _id: req.params.id, userId: req.userId }, { $set: { amount: paise } }, { new: true });
    if (!budget) return res.status(404).json({ error: 'not_found' });
    res.json({ budget });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function deleteBudget(req, res) {
  try {
    if (!isConnected()) {
      const idx = store.budgets.findIndex((x) => x._id === req.params.id && x.userId === req.userId);
      if (idx === -1) return res.status(404).json({ error: 'not_found' });
      store.budgets.splice(idx, 1);
      save();
      return res.json({ ok: true });
    }
    const r = await Budget.deleteOne({ _id: req.params.id, userId: req.userId });
    if (!r.deletedCount) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getStatus(req, res) {
  try {
    if (!isConnected()) {
      const uid = String(req.userId);
      const userBudgets = store.budgets.filter((b) => String(b.userId) === uid);
      const totalB = userBudgets.find((b) => b.scope === 'total')?.amount || 0;
      const dailyB = userBudgets.find((b) => b.scope === 'daily')?.amount || 0;
      const p = resolveMonth(req.query.month);
      const prevP = resolveMonth(p.prev);

      const userTxns = (store.transactions || []).filter(
        (t) => String(t.userId) === uid && !t.deletedAt && t.isExpense && t.direction === 'debit'
      );

      const thisMonthTxns = userTxns.filter((t) => {
        const d = new Date(t.occurredAt);
        return d >= p.start && d <= p.end;
      });
      const spent = thisMonthTxns.reduce((sum, t) => sum + (t.amount || 0), 0);

      const prevMonthTxns = userTxns.filter((t) => {
        const d = new Date(t.occurredAt);
        return d >= prevP.start && d <= prevP.end;
      });
      const lastMonthSpent = prevMonthTxns.reduce((sum, t) => sum + (t.amount || 0), 0);

      const remaining = totalB - spent;
      const diff = spent - lastMonthSpent;
      const isSaved = lastMonthSpent > spent;
      const isMore = spent > lastMonthSpent;
      const savedAmount = isSaved ? lastMonthSpent - spent : 0;
      const moreAmount = isMore ? spent - lastMonthSpent : 0;
      const percentChange = lastMonthSpent > 0 ? Math.round((Math.abs(diff) / lastMonthSpent) * 100) : null;

      let comparisonText = '';
      if (lastMonthSpent === 0 && spent === 0) {
        comparisonText = 'No expenses recorded';
      } else if (lastMonthSpent === 0) {
        comparisonText = 'First tracked month';
      } else if (isSaved) {
        comparisonText = 'Saved ₹' + Math.round(savedAmount / 100).toLocaleString('en-IN') + (percentChange !== null ? ' (' + percentChange + '%)' : '') + ' compared to ' + prevP.shortLabel;
      } else if (isMore) {
        comparisonText = 'Spent ₹' + Math.round(moreAmount / 100).toLocaleString('en-IN') + (percentChange !== null ? ' (' + percentChange + '%)' : '') + ' more than ' + prevP.shortLabel;
      } else {
        comparisonText = 'Same spend as ' + prevP.shortLabel;
      }

      const comparison = {
        currentSpent: spent,
        lastMonthSpent,
        diff,
        isSaved,
        isMore,
        savedAmount,
        moreAmount,
        percentChange,
        prevMonth: prevP.month,
        prevLabel: prevP.shortLabel,
        prevFullLabel: prevP.label,
        comparisonText,
      };

      const { BY_KEY } = require('../shared/categories');
      const { paceFor } = require('./budget.service');

      const categoryBudgets = userBudgets.filter((b) => b.scope === 'category' && b.category);
      const chips = categoryBudgets.map((b) => {
        const catSpent = thisMonthTxns.filter((t) => t.category === b.category).reduce((s, t) => s + (t.amount || 0), 0);
        return {
          category: b.category,
          label: BY_KEY[b.category]?.label || b.category,
          icon: BY_KEY[b.category]?.icon || '📦',
          color: BY_KEY[b.category]?.color || '#FF6D00',
          budget: b.amount,
          spent: catSpent,
          remaining: b.amount - catSpent,
          ratio: b.amount > 0 ? Math.min(catSpent / b.amount, 1) : 0,
          over: catSpent > b.amount,
          isOverride: false,
        };
      });
      const allocated = chips.reduce((s, c) => s + c.budget, 0);

      const now = new Date();
      const isCurrentMonth = p.isCurrent;
      const todaySpent = isCurrentMonth
        ? thisMonthTxns.filter((t) => {
            const d = new Date(t.occurredAt);
            return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
          }).reduce((s, t) => s + (t.amount || 0), 0)
        : 0;

      return res.json({
        period: p,
        comparison,
        ring: {
          total: totalB,
          spent,
          remaining,
          ratio: totalB > 0 ? Math.min(spent / totalB, 1) : 0,
          over: spent > totalB && totalB > 0,
        },
        dailyBudget: dailyB,
        pace: paceFor(spent, totalB, p.elapsedDays, p.totalDays),
        chips,
        unallocated: totalB - allocated,
        todaySpent,
        needsReview: 0,
        txnCount: thisMonthTxns.length,
        hasBudget: Boolean(totalB || dailyB),
        totalBudgetPaise: totalB,
        totalBudgetINR: Math.round(totalB / 100),
        dailyBudgetPaise: dailyB,
        dailyBudgetINR: Math.round(dailyB / 100),
        spentPaise: spent,
        spentINR: Math.round(spent / 100),
        remainingPaise: remaining,
        remainingINR: Math.round(remaining / 100),
        categories: [],
      });
    }
    res.json(await status(req.userId, req.query.month));
  } catch (err) {
    res.json({
      hasBudget: false,
      totalBudgetPaise: 0,
      totalBudgetINR: 0,
      dailyBudgetPaise: 0,
      dailyBudgetINR: 0,
      spentPaise: 0,
      spentINR: 0,
      remainingPaise: 0,
      remainingINR: 0,
      categories: [],
    });
  }
}

async function getSuggestion(req, res, next) {
  try {
    if (!isConnected()) {
      return res.json({
        basis: 'none',
        monthsUsed: [],
        avgMonthlySpend: 0,
        avgMonthlyIncome: 0,
        options: [],
      });
    }
    const months = [];
    let m = resolveMonth();
    const current = await monthSummary(req.userId, m.month);
    for (let i = 0; i < 3; i++) {
      m = resolveMonth(m.prev);
      const s = await monthSummary(req.userId, m.month);
      if ((s.spent || 0) > 0) months.push({ month: m.month, label: m.shortLabel, spent: s.spent, income: s.income || 0 });
    }

    let avgSpentPaise = 0;
    let basis = 'none';
    if (months.length) {
      avgSpentPaise = Math.round(months.reduce((a, x) => a + x.spent, 0) / months.length);
      basis = 'history';
    } else if ((current.spent || 0) > 0) {
      const p = resolveMonth();
      avgSpentPaise = Math.round((current.spent / Math.max(1, p.elapsedDays)) * p.totalDays);
      basis = 'projection';
    }
    const avgIncomePaise = months.length ? Math.round(months.reduce((a, x) => a + x.income, 0) / months.length) : 0;

    const round500 = (paise) => Math.max(0, Math.round(paise / 100 / 500) * 500);
    const avg = round500(avgSpentPaise);
    const options = avg > 0
      ? [
          { key: 'save10', label: 'Save 10%', amount: round500(avgSpentPaise * 0.9), recommended: true },
          { key: 'same', label: 'Same as usual', amount: avg },
          { key: 'save20', label: 'Save 20%', amount: round500(avgSpentPaise * 0.8) },
        ]
      : [];

    res.json({
      basis,
      monthsUsed: months,
      avgMonthlySpend: Math.round(avgSpentPaise / 100),
      avgMonthlyIncome: Math.round(avgIncomePaise / 100),
      options,
    });
  } catch (err) {
    res.json({
      basis: 'none',
      monthsUsed: [],
      avgMonthlySpend: 0,
      avgMonthlyIncome: 0,
      options: [],
    });
  }
}

async function listAlerts(req, res) {
  try {
    if (!isConnected()) return res.json({ alerts: [] });
    const q = { userId: req.userId };
    if (req.query.unread === 'true') q.read = false;
    res.json({ alerts: await Alert.find(q).sort({ createdAt: -1 }).limit(50).lean() });
  } catch (err) {
    res.json({ alerts: [] });
  }
}

async function readAlert(req, res) {
  try {
    if (!isConnected()) return res.json({ ok: true });
    await Alert.updateOne({ _id: req.params.id, userId: req.userId }, { $set: { read: true } });
    res.json({ ok: true });
  } catch (err) {
    res.json({ ok: true });
  }
}

module.exports = { getSuggestion, listBudgets, upsertBudget, patchBudget, deleteBudget, getStatus, listAlerts, readAlert };
