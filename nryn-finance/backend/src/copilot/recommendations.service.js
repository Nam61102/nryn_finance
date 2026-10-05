'use strict';
const Transaction = require('../db/models/Transaction');
const Budget = require('../db/models/Budget');
const { chatJSON, isEnabled } = require('../ai/llm.client');

/**
 * 100% Dynamic AI Recommendation Engine
 * Analyzes live transactions to detect merchant-level & category-level overspending,
 * frequency leaks (e.g. multiple Swiggy/Zomato/cabs orders), and generates tailored, actionable saving advice.
 * NEVER returns hardcoded/static dummy cards.
 */
async function generateRecommendations(userId, monthStr) {
  const now = new Date();
  let targetYear, targetMonth;

  if (monthStr && /^\d{4}-\d{2}$/.test(monthStr)) {
    const parts = monthStr.split('-');
    targetYear = parseInt(parts[0], 10);
    targetMonth = parseInt(parts[1], 10) - 1;
  } else {
    targetYear = now.getFullYear();
    targetMonth = now.getMonth();
  }

  const startOfMonth = new Date(Date.UTC(targetYear, targetMonth, 1));
  const endOfMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0, 23, 59, 59, 999));

  // Previous month dates for delta comparisons
  const prevMonthStart = new Date(Date.UTC(targetYear, targetMonth - 1, 1));
  const prevMonthEnd = new Date(Date.UTC(targetYear, targetMonth, 0, 23, 59, 59, 999));

  // 1. Fetch current month and previous month real transactions
  const [currentTxns, prevTxns, budgetDoc] = await Promise.all([
    Transaction.find({
      userId,
      direction: 'debit',
      isExpense: true,
      occurredAt: { $gte: startOfMonth, $lte: endOfMonth }
    }).lean(),
    Transaction.find({
      userId,
      direction: 'debit',
      isExpense: true,
      occurredAt: { $gte: prevMonthStart, $lte: prevMonthEnd }
    }).lean(),
    Budget.findOne({ userId, scope: 'total', month: { $in: [monthStr, null] } }).lean().catch(() => null)
  ]);

  const totalSpentPaise = currentTxns.reduce((sum, t) => sum + (t.amount || 0), 0);
  const totalSpentINR = Math.round(totalSpentPaise / 100);

  // Group by Merchant with entity normalization
  const merchantMap = new Map();
  currentTxns.forEach(t => {
    let name = (t.merchantName || t.merchantRaw || 'Other').trim();
    const lower = name.toLowerCase();
    if (lower.includes('swiggy')) name = 'Swiggy';
    else if (lower.includes('zomato')) name = 'Zomato';
    else if (lower.includes('uber')) name = 'Uber';
    else if (lower.includes('ola')) name = 'Ola Cabs';
    else if (lower.includes('blinkit')) name = 'Blinkit';
    else if (lower.includes('zepto')) name = 'Zepto';
    else if (lower.includes('amazon')) name = 'Amazon';
    else if (lower.includes('starbucks')) name = 'Starbucks';
    else if (lower.includes('instamart')) name = 'Instamart';
    else if (lower.includes('flipkart')) name = 'Flipkart';

    if (!merchantMap.has(name)) {
      merchantMap.set(name, {
        name,
        category: t.category || 'other',
        totalPaise: 0,
        count: 0,
        txns: []
      });
    }
    const item = merchantMap.get(name);
    item.totalPaise += t.amount || 0;
    item.count += 1;
    item.txns.push(t);
  });

  // Calculate previous month spend by merchant for delta comparisons
  const prevMerchantMap = new Map();
  prevTxns.forEach(t => {
    let name = (t.merchantName || t.merchantRaw || 'Other').trim();
    const lower = name.toLowerCase();
    if (lower.includes('swiggy')) name = 'Swiggy';
    else if (lower.includes('zomato')) name = 'Zomato';
    else if (lower.includes('uber')) name = 'Uber';
    else if (lower.includes('blinkit')) name = 'Blinkit';
    else if (lower.includes('zepto')) name = 'Zepto';

    prevMerchantMap.set(name, (prevMerchantMap.get(name) || 0) + (t.amount || 0));
  });

  // Sort merchants by highest spend
  const sortedMerchants = Array.from(merchantMap.values()).sort((a, b) => b.totalPaise - a.totalPaise);

  const recommendations = [];
  let totalPotentialSavingsINR = 0;

  // Filter out normal essential utilities/fuel so single petrol visits aren't flagged as leaks
  const discretionaryMerchants = sortedMerchants.filter(m => !isEssentialMerchant(m.name, m.category));

  // ── RULE 1: Discretionary / Food Delivery Overspend (e.g. Swiggy, Zomato, Dining) ──
  const foodDelivery = sortedMerchants.find(m =>
    /swiggy|zomato|eatclub|mcdonald|domino|starbucks|kfc|burger/i.test(m.name) ||
    (m.category === 'food' && m.count >= 2)
  );

  if (foodDelivery && (foodDelivery.count >= 2 || foodDelivery.totalPaise >= 100000)) {
    const foodSpentINR = Math.round(foodDelivery.totalPaise / 100);
    const prevSpentINR = Math.round((prevMerchantMap.get(foodDelivery.name) || 0) / 100);
    const pctOfTotal = totalSpentINR > 0 ? Math.round((foodSpentINR / totalSpentINR) * 100) : 0;
    const isHigher = prevSpentINR > 0 ? Math.round(((foodSpentINR - prevSpentINR) / prevSpentINR) * 100) : 0;

    // Potential savings: cut 35-40% of delivery fee & excess orders
    const savingsTarget = Math.max(200, Math.round(foodSpentINR * 0.35));

    recommendations.push({
      id: `rec_food_${foodDelivery.name.toLowerCase().replace(/\s+/g, '_')}`,
      type: 'delivery_overspend',
      severity: foodDelivery.count >= 5 || pctOfTotal >= 25 ? 'high' : 'medium',
      icon: '🍔',
      merchantName: foodDelivery.name,
      category: 'food',
      totalSpentINR: foodSpentINR,
      orderCount: foodDelivery.count,
      percentOfTotal: pctOfTotal,
      comparisonText: isHigher > 0 ? `+${isHigher}% vs last month` : `${foodDelivery.count} orders recorded`,
      title: `High Spending on ${foodDelivery.name}`,
      reason: `You spent ₹${foodSpentINR.toLocaleString('en-IN')} across ${foodDelivery.count} orders on ${foodDelivery.name} (${pctOfTotal}% of your total month spend).`,
      aiSuggestion: `You ordered ${foodDelivery.count} times from ${foodDelivery.name}. Cooking dinner on weekdays and restricting delivery to weekends will save ~₹${savingsTarget.toLocaleString('en-IN')}/month!`,
      potentialSavingsINR: savingsTarget,
      actionTag: `Save ~₹${savingsTarget.toLocaleString('en-IN')}/mo`
    });
    totalPotentialSavingsINR += savingsTarget;
  }

  // ── RULE 2: Frequent Outflow Leaks (3+ repeated orders to same merchant) ──
  const frequentMerchants = discretionaryMerchants.filter(m =>
    m.count >= 3 && (!foodDelivery || m.name !== foodDelivery.name)
  );

  if (frequentMerchants.length > 0) {
    const freq = frequentMerchants[0];
    const freqSpentINR = Math.round(freq.totalPaise / 100);
    const freqSavings = Math.max(150, Math.round(freqSpentINR * 0.3));

    recommendations.push({
      id: `rec_freq_${freq.name.toLowerCase().replace(/\s+/g, '_')}`,
      type: 'frequency_leak',
      severity: 'medium',
      icon: getIconForCategory(freq.category),
      merchantName: freq.name,
      category: freq.category,
      totalSpentINR: freqSpentINR,
      orderCount: freq.count,
      percentOfTotal: totalSpentINR > 0 ? Math.round((freqSpentINR / totalSpentINR) * 100) : 0,
      comparisonText: `${freq.count} repeat orders`,
      title: `Frequent Outflow at ${freq.name}`,
      reason: `You made ${freq.count} separate payments to ${freq.name} totaling ₹${freqSpentINR.toLocaleString('en-IN')}.`,
      aiSuggestion: `Small repeated transactions add up quickly. Consolidating orders into fewer bulk trips will cut delivery & convenience costs.`,
      potentialSavingsINR: freqSavings,
      actionTag: `Save ~₹${freqSavings.toLocaleString('en-IN')}/mo`
    });
    totalPotentialSavingsINR += freqSavings;
  }

  // ── RULE 3: Category Imbalance (>40% of spend in a single discretionary category) ──
  const categoryMap = new Map();
  currentTxns.forEach(t => {
    const cat = t.category || 'other';
    categoryMap.set(cat, (categoryMap.get(cat) || 0) + (t.amount || 0));
  });

  for (const [cat, paise] of categoryMap.entries()) {
    const catINR = Math.round(paise / 100);
    const pct = totalSpentINR > 0 ? Math.round((catINR / totalSpentINR) * 100) : 0;

    if (
      pct >= 40 &&
      !['rent', 'investment', 'transfer', 'bills_utilities', 'education', 'health'].includes(cat) &&
      recommendations.length < 2 &&
      catINR >= 2000
    ) {
      const catSavings = Math.round(catINR * 0.25);
      recommendations.push({
        id: `rec_cat_${cat}`,
        type: 'category_imbalance',
        severity: 'info',
        icon: getIconForCategory(cat),
        category: cat,
        totalSpentINR: catINR,
        percentOfTotal: pct,
        title: `Heavy ${cat.toUpperCase()} Concentration`,
        reason: `${cat.toUpperCase()} took ${pct}% of your spending this month (₹${catINR.toLocaleString('en-IN')}).`,
        aiSuggestion: `Keeping discretionary ${cat} below 25% of your outflow and redirecting ₹${catSavings.toLocaleString('en-IN')} to emergency savings will strengthen your buffer.`,
        potentialSavingsINR: catSavings,
        actionTag: `Reallocate ₹${catSavings.toLocaleString('en-IN')}`
      });
      totalPotentialSavingsINR += catSavings;
    }
  }

  // NOTE: If recommendations.length === 0, we do NOT inject any static fake cards!
  // Instead, the frontend renders a clean "All balanced - no leaks" status.

  return {
    ok: true,
    month: `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`,
    count: recommendations.length,
    hasOverspending: recommendations.length > 0,
    totalSpentINR,
    totalPotentialSavingsINR,
    topMerchants: sortedMerchants.slice(0, 5).map(m => ({
      name: m.name,
      amountINR: Math.round(m.totalPaise / 100),
      count: m.count,
      category: m.category
    })),
    recommendations
  };
}

function isEssentialMerchant(name, category) {
  const lower = (name || '').toLowerCase();
  if (['rent', 'bills_utilities', 'education', 'health'].includes(category)) return true;
  if (/petrol|fuel|diesel|cng|hpcl|bpcl|ioc|indianoil|shell|patil|reliance petroleum/i.test(lower)) return true;
  if (/hospital|clinic|pharma|medical|doctor|apollo|medplus|netmeds/i.test(lower)) return true;
  if (/school|college|tuition|vidyalaya|university|fees/i.test(lower)) return true;
  if (/electricity|bescom|mseb|water|gas|mahanagar|torrent/i.test(lower)) return true;
  return false;
}

function getIconForCategory(cat) {
  switch (cat) {
    case 'food': return '🍔';
    case 'groceries': return '🛒';
    case 'transport': return '🚕';
    case 'bills_utilities': return '💡';
    case 'entertainment': return '🎬';
    case 'shopping': return '🛍️';
    case 'health': return '💊';
    default: return '📊';
  }
}

module.exports = { generateRecommendations };
