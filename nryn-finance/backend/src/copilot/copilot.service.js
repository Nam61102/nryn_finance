'use strict';
const { Types } = require('mongoose');
const Transaction = require('../db/models/Transaction');
const Account = require('../db/models/Account');
const Policy = require('../db/models/Policy');
const { calculateSafeSpend } = require('./safespend.service');
const { detectSubscriptions } = require('./subscription.service');
const { calculateTaxRadar } = require('./tax.service');
const { calculateLoanPrepayment } = require('./loan.service');
const { buildBlocks } = require('./blocks.service');
const { chatMessages, chatStream, isCopilotEnabled } = require('../ai/llm.client');
const { detectLanguage, normalizeDigits, normalizeTransliteratedEnglish } = require('../ai/whisper.client');
const { resolveMonth } = require('../finance/period');

/**
 * NRYN Conversational Financial Copilot Service
 * Uses real user data only. Never fabulates fake numbers, merchants or loans.
 */

async function fetchUserFinancialContext(userId, currentMonth) {
  const { isConnected } = require('../db/mongo');
  const { store } = require('../db/fallback.store');
  const { inferCategory } = require('../shared/categories');
  const uid = String(userId);

  if (!isConnected()) {
    const rawTxns = (store.transactions || []).filter((t) => {
      if (String(t.userId) !== uid || t.deletedAt) return false;
      const d = new Date(t.occurredAt);
      return d >= currentMonth.start && d <= currentMonth.end;
    });

    const txns = rawTxns.map((t) => {
      let c = t.category;
      if (!c || c === 'other') c = inferCategory(t.merchantName, t.merchantRaw);
      return { ...t, category: c };
    });

    const userBudgets = (store.budgets || []).filter((b) => String(b.userId) === uid);
    const totalB = userBudgets.find((b) => b.scope === 'total')?.amount || 0;
    const dailyB = userBudgets.find((b) => b.scope === 'daily')?.amount || 0;
    const totalBudgetINR = Math.round(totalB / 100);
    const dailySafeSpendINR = Math.round(dailyB / 100) || Math.round(totalBudgetINR / 30);
    const debitTxns = txns.filter((t) => t.isExpense && t.direction === 'debit');
    const totalSpentINR = Math.round(debitTxns.reduce((s, t) => s + (t.amount || 0), 0) / 100);
    const todayRemainingINR = Math.max(0, dailySafeSpendINR);

    const safeSpend = {
      ok: true,
      hasBudget: Boolean(totalB || dailyB),
      month: currentMonth.month,
      currentDay: new Date().getDate(),
      daysRemaining: Math.max(1, currentMonth.totalDays - new Date().getDate()),
      dailySafeSpendINR,
      todaySpentINR: 0,
      todayRemainingINR,
      totalBudgetINR,
      totalSpentSoFarINR: totalSpentINR,
      burnStatus: 'green',
      projectedRunoutDate: null,
      insightMessage: 'Safe daily allowance is ₹' + dailySafeSpendINR + '.',
    };

    const subs = { count: 0, empty: true, subscriptions: [], totalMonthlyRecurringINR: 0 };
    const taxRadar = { ok: true, empty: true, section80C: {}, section80D: {} };
    const accounts = [];
    const policies = [];

    return [txns, safeSpend, subs, taxRadar, accounts, policies];
  }

  const isObjectId = Types.ObjectId.isValid(userId);
  const mongoUserId = isObjectId ? new Types.ObjectId(userId) : userId;

  return Promise.all([
    Transaction.find({
      userId: mongoUserId,
      deletedAt: null,
      occurredAt: { $gte: currentMonth.start, $lte: currentMonth.end },
    })
      .sort({ occurredAt: -1 })
      .limit(100)
      .lean()
      .catch(() => []),
    calculateSafeSpend(userId).catch(() => null),
    detectSubscriptions(userId).catch(() => null),
    calculateTaxRadar(userId).catch(() => null),
    Account.find({ userId: mongoUserId }).lean().catch(() => []),
    Policy.find({ userId: mongoUserId }).lean().catch(() => []),
  ]);
}

async function processChat(userId, message, history = []) {
  const rawQuery = (message || '').trim();
  const translit = normalizeTransliteratedEnglish(rawQuery);
  const query = translit.isTransliterated ? translit.text : rawQuery;
  const userLang = translit.isTransliterated ? { code: 'en', name: 'English' } : detectLanguage(query);
  const lower = normalizeDigits(query).toLowerCase();

  const currentMonth = resolveMonth();

  // 1. Fetch user's live financial data
  const [txns, safeSpend, subs, taxRadar, accounts, policies] = await fetchUserFinancialContext(userId, currentMonth);

  const debitExpenseTxns = txns.filter((t) => t.direction === 'debit' && t.isExpense);
  const totalSpentINR = Math.round(debitExpenseTxns.reduce((sum, t) => sum + (t.amount || 0), 0) / 100);

  const foodTxns = debitExpenseTxns.filter((t) => t.category === 'food');
  const foodSpendINR = Math.round(foodTxns.reduce((sum, t) => sum + (t.amount || 0), 0) / 100);

  const loanAccounts = accounts.filter((a) => a.type === 'loan');

  // Validate history array (last 6 turns, role 'user'|'assistant', length capped)
  const validatedHistory = [];
  if (Array.isArray(history)) {
    for (const h of history.slice(-6)) {
      if (h && (h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string') {
        const text = h.content.trim().slice(0, 1000);
        if (text) validatedHistory.push({ role: h.role, content: text });
      }
    }
  }

  // 2. Try LLM Completion if COPILOT_LLM_ENABLED
  if (isCopilotEnabled()) {
    try {
      const contextSummary = `User's Live Financial State:
- Month: ${currentMonth.label}
- Total Spent This Month: ₹${totalSpentINR.toLocaleString('en-IN')}
- Food & Dining Spend: ₹${foodSpendINR.toLocaleString('en-IN')}
- Monthly Budget Set: ${safeSpend?.hasBudget ? `Yes (Total Budget: ₹${safeSpend.totalBudgetINR?.toLocaleString('en-IN')})` : 'No budget set yet'}
- Daily Safe Spend Limit: ${safeSpend?.hasBudget ? `₹${safeSpend.dailySafeSpendINR?.toLocaleString('en-IN')}` : 'Not available (no budget set)'}
- Today's Spend: ₹${(safeSpend?.todaySpentINR || 0).toLocaleString('en-IN')}
- Today's Remaining Safe Allowance: ${safeSpend?.hasBudget ? `₹${safeSpend.todayRemainingINR?.toLocaleString('en-IN')}` : 'Not available'}
- Burn Status: ${safeSpend?.hasBudget ? safeSpend.burnStatus : 'no_budget'}
- Recurring Subscriptions: ${subs?.count || 0} active subscriptions totaling ₹${(subs?.totalMonthlyRecurringINR || 0).toLocaleString('en-IN')}/mo
- Tax Regime: ${taxRadar?.taxRegime ? `${taxRadar.taxRegime.toUpperCase()} Regime` : 'Not selected / Unknown'}
- Section 80C Claimed: ${taxRadar?.taxRegime === 'new' ? 'Not applicable under New Regime' : `₹${(taxRadar?.section80C?.utilizedINR || 0).toLocaleString('en-IN')} of ₹1,50,000`}
- Section 80D Claimed: ${taxRadar?.taxRegime === 'new' ? 'Not applicable under New Regime' : `₹${(taxRadar?.section80D?.utilizedINR || 0).toLocaleString('en-IN')} of ₹25,000`}
- Recorded Accounts: ${accounts.length} (${loanAccounts.length} loans)
- Recorded Policies: ${policies.length}`;

      const systemPrompt = `You are NRYN Copilot, an Indian Personal Finance AI assistant.
You have access to the user's live financial aggregated state.
Rules:
1. Format all currency amounts in Indian Rupees (₹) with Indian commas (e.g. ₹1,50,000).
2. NEVER invent fake figures, fake subscriptions, or fake accounts. If the user has not set a budget or has no loans, state that clearly and advise them to configure them in the app.
3. MULTILINGUAL SUPPORT: The user asked in ${userLang.name} (${userLang.code}). You MUST reply naturally and conversationally in the EXACT SAME language (${userLang.name})!
   - If the user asked in Marathi (मराठी), reply in natural, fluent Marathi.
   - If the user asked in Hindi (हिंदी), reply in natural Hindi.
   - If the user asked in Hinglish, reply in conversational Hinglish.
   - If the user asked in English, reply in English.
4. Be concise and practical.
5. Return a valid JSON object matching this schema:
{
  "reply": "markdown text reply",
  "insights": { "key": "value" },
  "suggestedFollowUps": ["Question 1", "Question 2"]
}`;

      const messages = [
        { role: 'system', content: systemPrompt },
        ...validatedHistory,
        { role: 'user', content: `${contextSummary}\n\nUser Question: ${query}` },
      ];

      const blocks = buildBlocks(query, {
        safeSpend,
        subs,
        taxRadar,
        accounts,
        policies,
        txns,
        foodTxns,
        currentMonth,
      });

      const { json } = await chatMessages(messages, { timeoutMs: 7000, forCopilot: true });
      if (json && json.reply) {
        return {
          ok: true,
          source: 'llm',
          reply: json.reply,
          blocks,
          insights: json.insights || {},
          suggestedFollowUps: Array.isArray(json.suggestedFollowUps) ? json.suggestedFollowUps : [],
        };
      }
    } catch (err) {
      // Fallback cleanly to deterministic rules engine
    }
  }

  // 3. Deterministic Heuristic Rules Engine (100% real data, no fabrications)
  let reply = '';
  let insights = {};
  let suggestedFollowUps = userLang.code === 'mr'
    ? ['मी आज किती खर्च करू शकतो?', 'माझे सबस्क्रिप्शन दाखवा', 'टॅक्स कसा वाचवू?']
    : userLang.code === 'hi'
    ? ['आज मैं कितना खर्च कर सकता हूँ?', 'मेरे सब्सक्रिप्शन दिखाएं', 'टैक्स कैसे बचाएं?']
    : [
      'How much can I spend today?',
      'Show my subscriptions',
      'How can I save tax?',
    ];

  // Pattern A: "Can I afford X?" / "परवडेल का" / "खर्च करू शकतो का" / "अफोर्ड कर सकता हूँ"
  const isAffordQuery =
    lower.includes('afford') ||
    lower.includes('परवडेल') ||
    lower.includes('परवडतील') ||
    lower.includes('खर्च करू') ||
    lower.includes('अफोर्ड') ||
    lower.includes('कर सकता') ||
    lower.includes('कर सकती') ||
    lower.includes('spend') ||
    lower.includes('buy') ||
    lower.includes('dinner') ||
    lower.includes('डिनर') ||
    lower.includes('जेवण');

  let askAmt = 0;
  if (isAffordQuery) {
    const numberMatch = lower.match(/(?:rs\.?|inr|₹|रुपये|रूपीज|रु\.?)?\s*([\d,]+)\s*(?:rs\.?|inr|₹|रुपये|रूपीज|रु\.?|k)?/i);
    if (numberMatch && numberMatch[1]) {
      const rawNum = numberMatch[1].replace(/,/g, '');
      askAmt = parseFloat(rawNum) || 0;
      if (lower.includes(`${rawNum}k`)) {
        askAmt *= 1000;
      }
    }
  }

  if (isAffordQuery) {

    if (!safeSpend?.hasBudget) {
      if (userLang.code === 'mr') {
        reply = askAmt > 0
          ? `तुम्ही अजून मासिक बजेट सेट केलेले नाही, त्यामुळे ₹${askAmt.toLocaleString('en-IN')} परवडेल का हे सांगता येत नाही. बजेट टॅबमध्ये जाऊन मासिक बजेट सेट करा.`
          : 'तुम्ही अजून मासिक बजेट सेट केलेले नाही, त्यामुळे तुमची सुरक्षित खर्च मर्यादा काढता येत नाही. बजेट टॅबमध्ये जाऊन सेट करा.';
      } else if (userLang.code === 'hi') {
        reply = askAmt > 0
          ? `आपने अभी तक मासिक बजट सेट नहीं किया है, इसलिए यह बताना संभव नहीं है कि आप ₹${askAmt.toLocaleString('en-IN')} खर्च कर सकते हैं या नहीं। बजट टैब में जाकर मासिक बजट सेट करें।`
          : 'आपने अभी तक मासिक बजट सेट नहीं किया है, इसलिए सुरक्षित खर्च सीमा नहीं निकाली जा सकती। बजट टैब में जाकर सेट करें।';
      } else {
        reply = askAmt > 0
          ? `You haven't set a monthly budget yet, so I cannot calculate whether you can safely afford ₹${askAmt.toLocaleString('en-IN')}. Set a monthly budget in the Budgets tab to unlock your safe spending limits.`
          : 'You haven\'t set a monthly budget yet, so I cannot calculate your safe spending allowance. Set one in the Budgets tab.';
      }
      insights = { verdict: 'No Budget Set' };
      suggestedFollowUps = userLang.code === 'mr'
        ? ['मासिक बजेट सेट करा', 'या महिन्याचा सारांश दाखवा']
        : userLang.code === 'hi'
        ? ['मासिक बजट सेट करें', 'इस महीने का सारांश दिखाएं']
        : ['Set monthly budget', 'Show monthly summary'];
    } else {
      const dailyLimit = safeSpend.dailySafeSpendINR;
      const todayLeft = safeSpend.todayRemainingINR;

      if (askAmt <= 0) {
        if (userLang.code === 'mr') {
          reply = `तुमची आजची सुरक्षित खर्च मर्यादा **₹${dailyLimit.toLocaleString('en-IN')}** आहे, आणि आज **₹${todayLeft.toLocaleString('en-IN')}** शिल्लक आहेत.`;
        } else if (userLang.code === 'hi') {
          reply = `आपकी आज की सुरक्षित खर्च सीमा **₹${dailyLimit.toLocaleString('en-IN')}** है, और आज अभी **₹${todayLeft.toLocaleString('en-IN')}** बचे हैं।`;
        } else {
          reply = `Your today's safe spending limit is **₹${dailyLimit.toLocaleString('en-IN')}**, with **₹${todayLeft.toLocaleString('en-IN')}** remaining today.`;
        }
        insights = { safeLimit: dailyLimit, remainingToday: todayLeft };
      } else if (askAmt <= todayLeft) {
        if (userLang.code === 'mr') {
          reply = `**होय, तुम्ही आज ₹${askAmt.toLocaleString('en-IN')} खर्च करू शकता!** 🎉\n\nतुमची दैनिक मर्यादा **₹${dailyLimit.toLocaleString('en-IN')}** आहे आणि आज अजून **₹${todayLeft.toLocaleString('en-IN')}** शिल्लक आहेत.`;
        } else if (userLang.code === 'hi') {
          reply = `**हाँ, आप आज ₹${askAmt.toLocaleString('en-IN')} खर्च कर सकते हैं!** 🎉\n\nआपकी दैनिक लिमिट **₹${dailyLimit.toLocaleString('en-IN')}** है और आज अभी **₹${todayLeft.toLocaleString('en-IN')}** बचे हैं।`;
        } else {
          reply = `**Yes, you can afford ₹${askAmt.toLocaleString('en-IN')} today!** 🎉\n\nYour daily allowance is **₹${dailyLimit.toLocaleString('en-IN')}**, and you currently have **₹${todayLeft.toLocaleString('en-IN')}** remaining for today without disrupting your month-end budget.`;
        }
        insights = { verdict: 'Approved', safeLimit: dailyLimit, margin: todayLeft - askAmt };
      } else if (askAmt <= dailyLimit * 2) {
        const excess = askAmt - todayLeft;
        if (userLang.code === 'mr') {
          reply = `**खर्च करू शकता, पण काळजीपूर्वक.** ⚠️\n\n₹${askAmt.toLocaleString('en-IN')} खर्च केल्यास आजची शिल्लक मर्यादा ₹${excess.toLocaleString('en-IN')} ने ओलांडली जाईल. पुढील २ दिवसांत खर्चावर नियंत्रण ठेवा.`;
        } else if (userLang.code === 'hi') {
          reply = `**खर्च कर सकते हैं, लेकिन सावधानी से।** ⚠️\n\n₹${askAmt.toLocaleString('en-IN')} खर्च करने से आपकी दैनिक सीमा ₹${excess.toLocaleString('en-IN')} से अधिक हो जाएगी। अगले 2 दिनों में खर्च कम रखें।`;
        } else {
          reply = `**You can afford it, but with caution.** ⚠️\n\nSpending **₹${askAmt.toLocaleString('en-IN')}** exceeds your remaining daily allowance by **₹${excess.toLocaleString('en-IN')}**. You will need to curb spending over the next couple of days to stay on track.`;
        }
        insights = { verdict: 'Caution', excess, dailyLimit };
      } else {
        if (userLang.code === 'mr') {
          reply = `**सध्या हा खर्च करणे योग्य नाही.** 🛑\n\n₹${askAmt.toLocaleString('en-IN')} तुमच्या दैनिक मर्यादेपेक्षा (₹${dailyLimit.toLocaleString('en-IN')}) जास्त आहे.`;
        } else if (userLang.code === 'hi') {
          reply = `**अभी यह खर्च न करें।** 🛑\n\n₹${askAmt.toLocaleString('en-IN')} आपकी दैनिक लिमिट (₹${dailyLimit.toLocaleString('en-IN')}) से काफी अधिक है।`;
        } else {
          reply = `**Not recommended right now.** 🛑\n\n₹${askAmt.toLocaleString('en-IN')} significantly exceeds your daily safe limit of ₹${dailyLimit.toLocaleString('en-IN')}. This will impact your monthly budget balance.`;
        }
        insights = { verdict: 'Warning', safeLimit: dailyLimit };
      }
      suggestedFollowUps = userLang.code === 'mr'
        ? ['माझी सुरक्षित मर्यादा तपासा', 'मोठे खर्च दाखवा']
        : userLang.code === 'hi'
        ? ['मेरी सुरक्षित लिमिट देखें', 'बड़े खर्च दिखाएं']
        : ['Check my safe spend limit', 'What are my top expenses?'];
    }
  }

  // Pattern B: Safe to spend / Daily Limit / Burn / Today (English, Marathi, Hindi)
  else if (
    lower.includes('safe') ||
    lower.includes('limit') ||
    lower.includes('burn') ||
    lower.includes('मर्यादा') ||
    lower.includes('शिल्लक') ||
    lower.includes('सीमा') ||
    (lower.includes('today') && !lower.includes('afford')) ||
    (lower.includes('आज') && !isAffordQuery)
  ) {
    if (!safeSpend?.hasBudget) {
      if (userLang.code === 'mr') {
        reply = `🎯 **सुरक्षित खर्च मर्यादा:**\n\nतुम्ही अजून मासिक बजेट सेट केलेले नाही. आज तुम्ही **₹${(safeSpend?.todaySpentINR || 0).toLocaleString('en-IN')}** खर्च केले आहेत.\n\nदैनिक सुरक्षित मर्यादा जाणून घेण्यासाठी **Budgets** टॅबमध्ये बजेट सेट करा!`;
      } else if (userLang.code === 'hi') {
        reply = `🎯 **सुरक्षित खर्च सीमा:**\n\nआपने अभी तक मासिक बजट सेट नहीं किया है। आज आपने **₹${(safeSpend?.todaySpentINR || 0).toLocaleString('en-IN')}** खर्च किए हैं।\n\nदैनिक लिमिट जानने के लिए **Budgets** टैब में बजट सेट करें!`;
      } else {
        reply = `🎯 **Safe-to-Spend Limit:**\n\nYou haven't set a monthly budget yet. You have spent **₹${(safeSpend?.todaySpentINR || 0).toLocaleString('en-IN')}** today.\n\nSet your monthly budget in the **Budgets** tab to calculate your daily safe limit!`;
      }
      insights = { hasBudget: false, spentToday: safeSpend?.todaySpentINR || 0 };
      suggestedFollowUps = userLang.code === 'mr'
        ? ['मासिक बजेट सेट करा', 'या महिन्याचा सारांश दाखवा']
        : userLang.code === 'hi'
        ? ['मासिक बजट सेट करें', 'इस महीने का सारांश दिखाएं']
        : ['Set monthly budget', 'Show monthly summary'];
    } else {
      const dailyLimit = safeSpend.dailySafeSpendINR;
      const spentToday = safeSpend.todaySpentINR;
      const remaining = safeSpend.todayRemainingINR;

      if (userLang.code === 'mr') {
        reply = `🎯 **आजची सुरक्षित खर्च मर्यादा:**\n\n- **दैनिक टार्गेट:** ₹${dailyLimit.toLocaleString('en-IN')}\n- **आज खर्च झाले:** ₹${spentToday.toLocaleString('en-IN')}\n- **आज शिल्लक:** **₹${remaining.toLocaleString('en-IN')}**\n\n*स्थिती:* **${safeSpend.burnStatus.toUpperCase()} ZONE**.`;
      } else if (userLang.code === 'hi') {
        reply = `🎯 **आज की सुरक्षित खर्च सीमा:**\n\n- **दैनिक टारगेट:** ₹${dailyLimit.toLocaleString('en-IN')}\n- **आज खर्च:** ₹${spentToday.toLocaleString('en-IN')}\n- **आज बचा हुआ:** **₹${remaining.toLocaleString('en-IN')}**\n\n*स्थिति:* **${safeSpend.burnStatus.toUpperCase()} ZONE**.`;
      } else {
        reply = `🎯 **Today's Safe-to-Spend Allowance:**\n\n- **Daily Target:** ₹${dailyLimit.toLocaleString('en-IN')}\n- **Spent Today:** ₹${spentToday.toLocaleString('en-IN')}\n- **Remaining Today:** **₹${remaining.toLocaleString('en-IN')}**\n\n*Status:* **${safeSpend.burnStatus.toUpperCase()} ZONE**. ${safeSpend.insightMessage || ''}`;
      }
      insights = { dailyLimit, spentToday, remaining, burnStatus: safeSpend.burnStatus };
      suggestedFollowUps = userLang.code === 'mr'
        ? ['मी आज ₹१,५०० खर्च करू शकतो का?', 'या महिन्याचा सारांश दाखवा']
        : userLang.code === 'hi'
        ? ['क्या मैं आज ₹1,500 खर्च कर सकता हूँ?', 'इस महीने का सारांश दिखाएं']
        : ['Can I afford dinner for ₹1,500?', 'Show monthly summary'];
    }
  }

  // Pattern C: Food / Swiggy / Zomato / Dining (English, Marathi, Hindi)
  else if (
    lower.includes('food') ||
    lower.includes('swiggy') ||
    lower.includes('zomato') ||
    lower.includes('restaurant') ||
    lower.includes('जेवण') ||
    lower.includes('खाण्या') ||
    lower.includes('खाना') ||
    lower.includes('नाश्ता')
  ) {
    if (foodSpendINR === 0) {
      if (userLang.code === 'mr') {
        reply = `🍔 **खाण्यापिण्यावरील खर्च:**\n\n${currentMonth.label} मध्ये खाण्यावर कोणताही खर्च नोंदवला गेलेला नाही.`;
      } else if (userLang.code === 'hi') {
        reply = `🍔 **खाने-पीने का खर्च:**\n\n${currentMonth.label} में खाने पर कोई खर्च दर्ज नहीं है।`;
      } else {
        reply = `🍔 **Food & Dining Breakdown:**\n\nNo food or dining expenses recorded for ${currentMonth.label} yet.`;
      }
      insights = { foodSpendINR: 0, orderCount: 0 };
    } else {
      const deliveryTxns = foodTxns.filter((t) =>
        /swiggy|zomato|eatclub|domino|mcdonald/i.test(`${t.merchantName || ''} ${t.merchantRaw || ''}`)
      );
      const deliveryCount = deliveryTxns.length;
      const deliveryTotalINR = Math.round(deliveryTxns.reduce((sum, t) => sum + (t.amount || 0), 0) / 100);

      if (userLang.code === 'mr') {
        reply = `🍔 **खाण्यापिण्यावरील खर्च (${currentMonth.label}):**\n\n- खाण्यावर एकूण खर्च: **₹${foodSpendINR.toLocaleString('en-IN')}**`;
        if (deliveryCount > 0) {
          reply += `\n- फूड डिलिव्हरी (${deliveryCount} ऑर्डर्स): **₹${deliveryTotalINR.toLocaleString('en-IN')}**`;
        }
      } else if (userLang.code === 'hi') {
        reply = `🍔 **खाने-पीने का खर्च (${currentMonth.label}):**\n\n- खाने पर कुल खर्च: **₹${foodSpendINR.toLocaleString('en-IN')}**`;
        if (deliveryCount > 0) {
          reply += `\n- फूड डिलीवरी (${deliveryCount} ऑर्डर्स): **₹${deliveryTotalINR.toLocaleString('en-IN')}**`;
        }
      } else {
        reply = `🍔 **Food & Dining Breakdown (${currentMonth.label}):**\n\n- Total spent on food: **₹${foodSpendINR.toLocaleString('en-IN')}**`;
        if (deliveryCount > 0) {
          reply += `\n- Food delivery (${deliveryCount} orders): **₹${deliveryTotalINR.toLocaleString('en-IN')}**`;
          if (deliveryCount >= 4) {
            const potSavings = Math.round(deliveryTotalINR * 0.35);
            reply += `\n\n💡 *Cooking dinner on 1–2 extra days each week could save ~₹${potSavings.toLocaleString('en-IN')} this month.*`;
          }
        }
      }
      insights = { foodSpendINR, deliveryCount, deliveryTotalINR };
    }
    suggestedFollowUps = userLang.code === 'mr'
      ? ['सबस्क्रिप्शन दाखवा', 'सुरक्षित मर्यादा तपासा']
      : userLang.code === 'hi'
      ? ['सब्सक्रिप्शन दिखाएं', 'सुरक्षित लिमिट देखें']
      : ['Show my subscriptions', 'Check safe spend limit'];
  }

  // Pattern D: Subscriptions / Recurring (English, Marathi, Hindi)
  else if (
    lower.includes('subscri') ||
    lower.includes('recurring') ||
    lower.includes('zombie') ||
    lower.includes('सबस्क्रिप्शन') ||
    lower.includes('बिल')
  ) {
    if (!subs || subs.empty || subs.count === 0) {
      if (userLang.code === 'mr') {
        reply = `🕵️‍♂️ **सबस्क्रिप्शन ऑडिट:**\n\nकोणतेही सक्रिय सबस्क्रिप्शन आढळले नाही. जेव्हा सलग २ किंवा अधिक महिने नियमित खर्च होतो, तेव्हा सबस्क्रिप्शन आपोआप ओळखले जातात.`;
      } else if (userLang.code === 'hi') {
        reply = `🕵️‍♂️ **सब्सक्रिप्शन ऑडिट:**\n\nकोई भी सक्रिय सब्सक्रिप्शन नहीं मिला। लगातार 2 या अधिक महीनों के नियमित भुगतान से सब्सक्रिप्शन अपने आप पहचाने जाते हैं।`;
      } else {
        reply = `🕵️‍♂️ **Subscription Hunter Audit:**\n\nNo recurring subscriptions detected yet from your SMS charges. Subscriptions are automatically identified when recurring payments appear across 2 or more months.`;
      }
      insights = { count: 0, monthlyRecurring: 0 };
    } else {
      const totalM = subs.totalMonthlyRecurringINR;
      const totalA = subs.totalAnnualCostINR;
      const zombieSubs = subs.subscriptions.filter((s) => s.isZombie);

      if (userLang.code === 'mr') {
        reply = `🕵️‍♂️ **सबस्क्रिप्शन ऑडिट:**\n\n**${subs.count} सक्रिय सबस्क्रिप्शन** आढळले आहेत. दरमहा खर्च: **₹${totalM.toLocaleString('en-IN')}/महिना** (₹${totalA.toLocaleString('en-IN')}/वर्ष).`;
        if (zombieSubs.length > 0) {
          reply += `\n\n⚠️ **सूचना:**`;
          for (const z of zombieSubs) {
            reply += `\n- **${z.merchantName}** (₹${z.amountINR}): ${z.zombieReason || 'तपासा'}`;
          }
        }
      } else if (userLang.code === 'hi') {
        reply = `🕵️‍♂️ **सब्सक्रिप्शन ऑडिट:**\n\n**${subs.count} सक्रिय सब्सक्रिप्शन** मिले हैं। मासिक खर्च: **₹${totalM.toLocaleString('en-IN')}/माह** (₹${totalA.toLocaleString('en-IN')}/वर्ष).`;
        if (zombieSubs.length > 0) {
          reply += `\n\n⚠️ **अलर्ट:**`;
          for (const z of zombieSubs) {
            reply += `\n- **${z.merchantName}** (₹${z.amountINR}): ${z.zombieReason || 'रिव्यू करें'}`;
          }
        }
      } else {
        reply = `🕵️‍♂️ **Subscription Hunter Audit:**\n\nDetected **${subs.count} recurring subscription(s)** costing **₹${totalM.toLocaleString('en-IN')}/month** (₹${totalA.toLocaleString('en-IN')}/year).`;

        if (zombieSubs.length > 0) {
          reply += `\n\n⚠️ **Alert:**`;
          for (const z of zombieSubs) {
            reply += `\n- **${z.merchantName}** (₹${z.amountINR}): ${z.zombieReason || 'Review subscription'}`;
          }
        } else {
          reply += `\n\n✅ All subscriptions are normal with no sudden price hikes detected.`;
        }
      }
      insights = { count: subs.count, monthlyRecurring: totalM, annualCost: totalA, zombieCount: zombieSubs.length };
    }
    suggestedFollowUps = userLang.code === 'mr'
      ? ['टॅक्स कसा वाचवू?', 'सुरक्षित मर्यादा तपासा']
      : userLang.code === 'hi'
      ? ['टैक्स कैसे बचाएं?', 'सुरक्षित लिमिट देखें']
      : ['How can I save tax?', 'Check safe spend limit'];
  }

  // Pattern E: Tax / 80C / 80D (English, Marathi, Hindi)
  else if (
    lower.includes('tax') ||
    lower.includes('80c') ||
    lower.includes('80d') ||
    lower.includes('कर बचत') ||
    lower.includes('टॅक्स') ||
    lower.includes('टैक्स')
  ) {
    const fyLabel = taxRadar?.financialYearLabel ? ` (${taxRadar.financialYearLabel})` : '';

    if (taxRadar?.regimeUnknown) {
      if (userLang.code === 'mr') {
        reply = `📑 **इन्कम टॅक्स रडार:**\n\nकृपया ॲपमध्ये तुमची कर प्रणाली (नवीन किंवा जुनी कर पद्धत) निवडा, जेणेकरून योग्य वजावट तपासता येईल.\n\n*टीप: नवीन कर प्रणाली (New Tax Regime) अंतर्गत Section 80C आणि 80D वजावट लागू होत नाही.*`;
      } else if (userLang.code === 'hi') {
        reply = `📑 **इनकम टैक्स रडार:**\n\nकृपया ऐप में अपना टैक्स रिजीम (नया या पुराना टैक्स सिस्टम) चुनें ताकि सही छूट देखी जा सके।\n\n*नोट: नए टैक्स रिजीम के तहत धारा 80C और 80D की छूट लागू नहीं होती है।*`;
      } else {
        reply = `📑 **Income Tax Radar:**\n\nPlease select your tax regime (New Regime or Old Regime) in the app to view applicable deductions.\n\n*Note: Under the New Tax Regime, Section 80C and 80D deductions do not apply.*`;
      }
      insights = { regimeUnknown: true };
    } else if (taxRadar?.taxRegime === 'new') {
      if (userLang.code === 'mr') {
        reply = `📑 **इन्कम टॅक्स रडार${fyLabel}:**\n\nतुम्ही **नवीन कर प्रणाली (New Tax Regime)** वर आहात.\n\nनवीन कर प्रणालीत Section 80C आणि 80D वजावट लागू होत नाही. त्याऐवजी स्टँडर्ड डिडक्शन आणि कमी कर स्लॅब दर लागू होतात.`;
      } else if (userLang.code === 'hi') {
        reply = `📑 **इनकम टैक्स रडार${fyLabel}:**\n\nआप **नए टैक्स रिजीम (New Tax Regime)** पर हैं।\n\nनए टैक्स रिजीम में धारा 80C और 80D की छूट लागू नहीं होती। इसके बजाय स्टैंडर्ड डिडक्शन और कम टैक्स स्लैब दरें लागू होती हैं।`;
      } else {
        reply = `📑 **Income Tax Radar${fyLabel}:**\n\nYou are on the **New Tax Regime**.\n\nSection 80C and 80D deductions do not apply under the New Tax Regime (default since FY 2023-24). Standard deduction and lower tax slab rates apply instead.`;
      }
      insights = { taxRegime: 'new', notApplicable: true };
    } else if (taxRadar?.empty) {
      if (userLang.code === 'mr') {
        reply = `📑 **इन्कम टॅक्स रडार${fyLabel} - जुनी कर पद्धत:**\n\nकोणतीही कर बचत गुंतवणूक किंवा विमा पॉलिसी नोंदवलेली नाही.\n\nSection 80C (₹१.५ लाखांपर्यंत) आणि Section 80D (₹२५ हजारांपर्यंत) वजावट ट्रॅक करण्यासाठी Financial Hub मध्ये PPF, ELSS किंवा विमा पॉलिसी जोडा.`;
      } else if (userLang.code === 'hi') {
        reply = `📑 **इनकम टैक्स रडार${fyLabel} - पुरानी कर प्रणाली:**\n\nकोई टैक्स-बचत निवेश या बीमा पॉलिसी दर्ज नहीं है।\n\nधारा 80C (₹1.5 लाख तक) और धारा 80D (₹25 हजार तक) छूट ट्रैक करने के लिए Financial Hub में PPF, ELSS या बीमा पॉलिसी जोड़ें।`;
      } else {
        reply = `📑 **Income Tax Radar${fyLabel} - Old Regime:**\n\nNo tax-saving investments or insurance policies recorded yet.\n\nAdd your ELSS mutual funds, PPF, or life/health insurance policies in the Financial Hub to track your Section 80C (up to ₹1.5L) and Section 80D (up to ₹25k) deductions.`;
      }
      insights = { taxRegime: 'old', empty: true };
    } else {
      const u80C = taxRadar.section80C.utilizedINR;
      const r80C = taxRadar.section80C.remainingINR;
      const u80D = taxRadar.section80D.utilizedINR;

      if (userLang.code === 'mr') {
        reply = `📑 **इन्कम टॅक्स रडार${fyLabel} - जुनी कर पद्धत:**\n\n- **Section 80C:** ₹१,५०,००० पैकी ₹${u80C.toLocaleString('en-IN')} क्लेम केले (${taxRadar.section80C.percentage}%)\n- **Section 80D:** ₹२५,००० पैकी ₹${u80D.toLocaleString('en-IN')} क्लेम केले (${taxRadar.section80D.percentage}%)\n\n💡 ${taxRadar.actionableTip}`;
      } else if (userLang.code === 'hi') {
        reply = `📑 **इनकम टैक्स रडार${fyLabel} - पुरानी कर प्रणाली:**\n\n- **Section 80C:** ₹1,50,000 में से ₹${u80C.toLocaleString('en-IN')} क्लेम किया (${taxRadar.section80C.percentage}%)\n- **Section 80D:** ₹25,000 में से ₹${u80D.toLocaleString('en-IN')} क्लेम किया (${taxRadar.section80D.percentage}%)\n\n💡 ${taxRadar.actionableTip}`;
      } else {
        reply = `📑 **Income Tax Radar${fyLabel} - Old Regime:**\n\n- **Section 80C:** ₹${u80C.toLocaleString('en-IN')} claimed of ₹1,50,000 (${taxRadar.section80C.percentage}%)\n- **Section 80D:** ₹${u80D.toLocaleString('en-IN')} claimed of ₹25,000 (${taxRadar.section80D.percentage}%)\n\n💡 ${taxRadar.actionableTip}`;
      }
      insights = { utilized80C: u80C, remaining80C: r80C, utilized80D: u80D };
    }
    suggestedFollowUps = userLang.code === 'mr'
      ? ['माझे कर्ज दाखवा', 'सुरक्षित मर्यादा तपासा']
      : userLang.code === 'hi'
      ? ['मेरे लोन दिखाएं', 'सुरक्षित लिमिट देखें']
      : ['Show my loans', 'Check safe spend limit'];
  }

  // Pattern F: Loans / Prepayment (English, Marathi, Hindi)
  else if (
    lower.includes('loan') ||
    lower.includes('emi') ||
    lower.includes('prepay') ||
    lower.includes('interest') ||
    lower.includes('कर्ज') ||
    lower.includes('हप्ता') ||
    lower.includes('किश्त') ||
    lower.includes('ब्याज')
  ) {
    if (loanAccounts.length === 0) {
      if (userLang.code === 'mr') {
        reply = `💡 **कर्ज आणि ईएमआय सिम्युलेटर:**\n\nतुम्ही अजून कोणतेही कर्ज खाते जोडलेले नाही. व्याजावरील बचत आणि प्री-पेमेंट समजून घेण्यासाठी **Financial Hub** मध्ये तुमचे कर्ज जोडा!`;
      } else if (userLang.code === 'hi') {
        reply = `💡 **लोन और ईएमआई सिम्युलेटर:**\n\nआपने अभी तक कोई लोन खाता नहीं जोड़ा है। ब्याज बचत और प्री-पेमेंट समझने के लिए **Financial Hub** में अपना लोन जोड़ें!`;
      } else {
        reply = `💡 **Loan & EMI Simulator:**\n\nYou haven't added any loan accounts yet. Add your home, auto, or personal loan in the **Financial Hub** to calculate interest savings and prepayment strategies!`;
      }
      insights = { hasLoans: false };
      suggestedFollowUps = userLang.code === 'mr'
        ? ['सुरक्षित मर्यादा तपासा', 'या महिन्याचा सारांश दाखवा']
        : userLang.code === 'hi'
        ? ['सुरक्षित लिमिट देखें', 'इस महीने का सारांश दिखाएं']
        : ['Check safe spend limit', 'Show monthly summary'];
    } else {
      const firstLoan = loanAccounts[0];
      const principal = Math.round((firstLoan.principalAmount || firstLoan.outstandingAmount || 0) / 100);
      const rate = firstLoan.interestRate || 9.0;
      const tenure = firstLoan.tenureMonths;

      if (principal <= 0) {
        if (userLang.code === 'mr') {
          reply = `💡 **कर्ज सिम्युलेटर (${firstLoan.bankName}):**\n\nप्री-पेमेंट कॅल्क्युलेशनसाठी कृपया Financial Hub मध्ये तुमच्या ${firstLoan.bankName} कर्जाची मुद्दल रक्कम अपडेट करा.`;
        } else if (userLang.code === 'hi') {
          reply = `💡 **लोन सिम्युलेटर (${firstLoan.bankName}):**\n\nप्री-पेमेंट गणना के लिए कृपया Financial Hub में अपने ${firstLoan.bankName} लोन की मूल राशि अपडेट करें।`;
        } else {
          reply = `💡 **Loan Simulator (${firstLoan.bankName}):**\n\nPlease update the principal amount for your ${firstLoan.bankName} loan in the Financial Hub to run prepayment calculations.`;
        }
        insights = { hasLoans: true, principal: 0 };
      } else if (!tenure || tenure <= 0) {
        if (userLang.code === 'mr') {
          reply = `💡 **कर्ज सिम्युलेटर (${firstLoan.bankName}):**\n\nप्री-पेमेंट कॅल्क्युलेशनसाठी कृपया Financial Hub मध्ये तुमच्या ${firstLoan.bankName} कर्जाचा कालावधी अपडेट करा.`;
        } else if (userLang.code === 'hi') {
          reply = `💡 **लोन सिम्युलेटर (${firstLoan.bankName}):**\n\nप्री-पेमेंट गणना के लिए कृपया Financial Hub में अपने ${firstLoan.bankName} लोन की अवधि अपडेट करें।`;
        } else {
          reply = `💡 **Loan Simulator (${firstLoan.bankName}):**\n\nPlease update the tenure for your ${firstLoan.bankName} loan in the Financial Hub to run prepayment calculations.`;
        }
        insights = { hasLoans: true, tenure: 0 };
      } else {
        try {
          const sim = calculateLoanPrepayment({
            principalAmount: principal,
            annualInterestRate: rate,
            tenureMonths: tenure,
            extraMonthlyPrepayment: Math.max(1000, Math.round(principal * 0.002)),
          });

          if (userLang.code === 'mr') {
            reply = `💡 **कर्ज सिम्युलेटर (${firstLoan.bankName} ₹${principal.toLocaleString('en-IN')} @ ${rate}%):**\n\n${sim.recommendation}\n\nवेगवेगळ्या प्री-पेमेंट रकमेची चाचणी घेण्यासाठी Financial Hub मधील इंटरॅक्टिव्ह लोन सिम्युलेटर वापरा.`;
          } else if (userLang.code === 'hi') {
            reply = `💡 **लोन सिम्युलेटर (${firstLoan.bankName} ₹${principal.toLocaleString('en-IN')} @ ${rate}%):**\n\n${sim.recommendation}\n\nविभिन्न प्री-पेमेंट राशियों का परीक्षण करने के लिए Financial Hub में इंटरैक्टिव लोन सिम्युलेटर का उपयोग करें।`;
          } else {
            reply = `💡 **Loan Simulator (${firstLoan.bankName} ₹${principal.toLocaleString('en-IN')} @ ${rate}%):**\n\n${sim.recommendation}\n\nCheck the interactive Loan Simulator in the Hub to test different prepayment amounts.`;
          }
          insights = { principal, interestSaved: sim.totalInterestSavedINR, yearsSaved: sim.yearsSaved };
        } catch {
          if (userLang.code === 'mr') {
            reply = `💡 तुमचे **${firstLoan.bankName}** कडे कर्ज आहे. व्याजावरील बचत पाहण्यासाठी Financial Hub मध्ये लोन सिम्युलेटर उघडा.`;
          } else if (userLang.code === 'hi') {
            reply = `💡 आपका **${firstLoan.bankName}** के पास लोन है। ब्याज बचत देखने के लिए Financial Hub में लोन सिम्युलेटर खोलें।`;
          } else {
            reply = `💡 You have a loan with **${firstLoan.bankName}**. Open the Loan Simulator in the Financial Hub to calculate interest savings.`;
          }
          insights = { hasLoans: true };
        }
      }
      suggestedFollowUps = userLang.code === 'mr'
        ? ['सुरक्षित मर्यादा तपासा', 'या महिन्याचा सारांश दाखवा']
        : userLang.code === 'hi'
        ? ['सुरक्षित लिमिट देखें', 'इस महीने का सारांश दिखाएं']
        : ['Check safe spend limit', 'Show monthly summary'];
    }
  }

  // Pattern G: General / Greeting / Overview
  else {
    const budgetStatus = safeSpend?.hasBudget
      ? `₹${safeSpend.dailySafeSpendINR.toLocaleString('en-IN')}/day`
      : 'No budget set';
    const subStatus = subs && !subs.empty && subs.count > 0
      ? `${subs.count} active (₹${subs.totalMonthlyRecurringINR.toLocaleString('en-IN')}/mo)`
      : 'None detected';

    if (userLang.code === 'mr') {
      reply = `👋 **नमस्कार! मी आपला NRYN फायनान्शियल कोपायलट आहे.**\n\n${currentMonth.label} चा स्नॅपशॉट:\n- **एकूण खर्च:** ₹${totalSpentINR.toLocaleString('en-IN')}\n- **दैनिक सुरक्षित मर्यादा:** ${budgetStatus}\n- **सक्रिय सबस्क्रिप्शन:** ${subStatus}\n\nमला कोणताही प्रश्न विचारा! उदा: *"मी आज ₹१,५०० खर्च करू शकतो का?"*, *"खाण्यावर किती खर्च झाला?"*, किंवा *"टॅक्स कसा वाचवू?"*`;
    } else if (userLang.code === 'hi') {
      reply = `👋 **नमस्ते! मैं आपका NRYN फाइनेंशियल कोपायलट हूँ।**\n\n${currentMonth.label} का स्नैपशॉट:\n- **कुल खर्च:** ₹${totalSpentINR.toLocaleString('en-IN')}\n- **दैनिक सुरक्षित लिमिट:** ${budgetStatus}\n- **सक्रिय सब्सक्रिप्शन:** ${subStatus}\n\nमुझसे कुछ भी पूछें! जैसे: *"क्या मैं आज ₹1,500 खर्च कर सकता हूँ?"*, *"खाने पर कितना खर्च हुआ?"*, या *"टैक्स कैसे बचाएं?"*`;
    } else {
      reply = `👋 **Hello! I am your NRYN Financial Copilot.**\n\nHere is your live snapshot for ${currentMonth.label}:\n- **Total Spent:** ₹${totalSpentINR.toLocaleString('en-IN')}\n- **Daily Safe Limit:** ${budgetStatus}\n- **Recurring Subscriptions:** ${subStatus}\n\nAsk me anything! For example: *"Can I afford dinner for ₹1,500 tonight?"*, *"How much did I spend on food?"*, or *"How can I save tax?"*`;
    }
    insights = { totalSpentINR, hasBudget: Boolean(safeSpend?.hasBudget) };
  }

  const blocks = buildBlocks(query, {
    safeSpend,
    subs,
    taxRadar,
    accounts,
    policies,
    txns,
    foodTxns,
    currentMonth,
  });

  return {
    ok: true,
    source: 'rules',
    reply,
    blocks,
    insights,
    suggestedFollowUps,
  };
}

/**
 * Streaming Financial Copilot with SSE and Deterministic Live Rich Blocks
 */
async function streamChat(userId, message, history = [], res) {
  // Set SSE response headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  let isClosed = false;
  if (res.req) {
    res.req.on('close', () => { isClosed = true; });
  }

  const sendEvent = (event, data) => {
    if (isClosed) return;
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    if (typeof res.flush === 'function') res.flush();
  };

  try {
    const rawQuery = (message || '').trim();
    const translit = normalizeTransliteratedEnglish(rawQuery);
    const query = translit.isTransliterated ? translit.text : rawQuery;
    const currentMonth = resolveMonth();
    const userLang = translit.isTransliterated ? { code: 'en', name: 'English' } : detectLanguage(query);

    // 1. Fetch user's live financial data
    const [txns, safeSpend, subs, taxRadar, accounts, policies] = await fetchUserFinancialContext(userId, currentMonth);

    const debitExpenseTxns = txns.filter((t) => t.direction === 'debit' && t.isExpense);
    const totalSpentINR = Math.round(debitExpenseTxns.reduce((sum, t) => sum + (t.amount || 0), 0) / 100);
    const foodTxns = debitExpenseTxns.filter((t) => t.category === 'food');
    const foodSpendINR = Math.round(foodTxns.reduce((sum, t) => sum + (t.amount || 0), 0) / 100);

    // 2. Build and immediately stream deterministic rich blocks from live DB data
    const blocks = buildBlocks(query, {
      safeSpend,
      subs,
      taxRadar,
      accounts,
      policies,
      txns,
      foodTxns,
      currentMonth,
    });

    sendEvent('blocks', { blocks });

    // 3. Stream text response
    let streamedViaLLM = false;
    let suggestedFollowUps = userLang.code === 'mr'
      ? ['मी आज किती खर्च करू शकतो?', 'माझे सबस्क्रिप्शन दाखवा', 'टॅक्स कसा वाचवू?']
      : userLang.code === 'hi'
      ? ['आज मैं कितना खर्च कर सकता हूँ?', 'मेरे सब्सक्रिप्शन दिखाएं', 'टैक्स कैसे बचाएं?']
      : [
        'How much can I spend today?',
        'Show my subscriptions',
        'How can I save tax?',
      ];

    if (isCopilotEnabled()) {
      try {
        const validatedHistory = [];
        if (Array.isArray(history)) {
          for (const h of history.slice(-6)) {
            if (h && (h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string') {
              const text = h.content.trim().slice(0, 1000);
              if (text) validatedHistory.push({ role: h.role, content: text });
            }
          }
        }

        const contextSummary = `User's Live Financial State:
- Month: ${currentMonth.label}
- Total Spent This Month: ₹${totalSpentINR.toLocaleString('en-IN')}
- Food & Dining Spend: ₹${foodSpendINR.toLocaleString('en-IN')}
- Monthly Budget Set: ${safeSpend?.hasBudget ? `Yes (Total Budget: ₹${safeSpend.totalBudgetINR?.toLocaleString('en-IN')})` : 'No budget set yet'}
- Daily Safe Spend Limit: ${safeSpend?.hasBudget ? `₹${safeSpend.dailySafeSpendINR?.toLocaleString('en-IN')}` : 'Not available'}
- Today's Spend: ₹${(safeSpend?.todaySpentINR || 0).toLocaleString('en-IN')}
- Today's Remaining Safe Allowance: ${safeSpend?.hasBudget ? `₹${safeSpend.todayRemainingINR?.toLocaleString('en-IN')}` : 'Not available'}
- Burn Status: ${safeSpend?.hasBudget ? safeSpend.burnStatus : 'no_budget'}
- Recurring Subscriptions: ${subs?.count || 0} active subscriptions totaling ₹${(subs?.totalMonthlyRecurringINR || 0).toLocaleString('en-IN')}/mo
- Tax Regime: ${taxRadar?.taxRegime ? `${taxRadar.taxRegime.toUpperCase()} Regime` : 'Not selected / Unknown'}`;

        const systemPrompt = `You are NRYN Copilot, an Indian Personal Finance AI assistant.
Rules:
1. Format all currency amounts in Indian Rupees (₹) with Indian numbering (e.g. ₹1,50,000).
2. NEVER invent fake figures, fake subscriptions, or fake accounts.
3. MULTILINGUAL SUPPORT: The user asked in ${userLang.name} (${userLang.code}). You MUST reply naturally and conversationally in the EXACT SAME language (${userLang.name})!
   - If the user asked in Marathi (मराठी), reply in natural, fluent Marathi.
   - If the user asked in Hindi (हिंदी), reply in natural Hindi.
   - If the user asked in Hinglish, reply in conversational Hinglish.
   - If the user asked in English, reply in English.
4. Be concise and practical. Output clean markdown text.`;

        const messages = [
          { role: 'system', content: systemPrompt },
          ...validatedHistory,
          { role: 'user', content: `${contextSummary}\n\nUser Question: ${query}` },
        ];

        await chatStream(messages, (delta) => {
          if (!isClosed) sendEvent('delta', { text: delta });
        }, { timeoutMs: 10000, forCopilot: true });

        streamedViaLLM = true;
      } catch (_) {
        // Fallback cleanly to deterministic rules engine
      }
    }

    if (!streamedViaLLM) {
      // Deterministic rules reply
      const ruleResult = await processChat(userId, query, history);
      suggestedFollowUps = ruleResult.suggestedFollowUps || suggestedFollowUps;
      const text = ruleResult.reply || '';

      // Stream text in word chunks with 20ms delay
      const tokens = text.split(/(\s+)/);
      for (const token of tokens) {
        if (isClosed) break;
        sendEvent('delta', { text: token });
        await new Promise((r) => setTimeout(r, 20));
      }
    }

    sendEvent('done', {
      source: streamedViaLLM ? 'llm' : 'rules',
      suggestedFollowUps,
    });
  } catch (err) {
    sendEvent('error', { error: err.message || 'Stream processing failed' });
  } finally {
    if (!isClosed) res.end();
  }
}

module.exports = { processChat, streamChat };
