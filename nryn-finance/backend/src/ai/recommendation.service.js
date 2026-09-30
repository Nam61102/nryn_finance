'use strict';
const Transaction = require('../db/models/Transaction');
const Account = require('../db/models/Account');
const Policy = require('../db/models/Policy');
const { formatINR } = require('../shared/categories');
const { chatJSON } = require('./llm.client');

/**
 * AI Financial Recommendation & Advisory Engine
 * Generates tailored recommendations across:
 * 1. Spending optimization & budget leakage prevention
 * 2. Loan & EMI interest optimization
 * 3. Insurance & protection gap audit
 * 4. Emergency fund & savings health
 */
async function generateRecommendations(userId) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  // 1. Fetch Spending Aggregations
  const [currentMonthSpentAgg] = await Transaction.aggregate([
    {
      $match: {
        userId,
        deletedAt: null,
        isExpense: true,
        direction: 'debit',
        occurredAt: { $gte: startOfMonth }
      }
    },
    { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
  ]);

  const [lastMonthSpentAgg] = await Transaction.aggregate([
    {
      $match: {
        userId,
        deletedAt: null,
        isExpense: true,
        direction: 'debit',
        occurredAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }
      }
    },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);

  const categoryAgg = await Transaction.aggregate([
    {
      $match: {
        userId,
        deletedAt: null,
        isExpense: true,
        direction: 'debit',
        occurredAt: { $gte: startOfMonth }
      }
    },
    { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    { $sort: { total: -1 } }
  ]);

  // 2. Fetch Accounts (Savings & Loans)
  const accounts = await Account.find({ userId }).lean();
  const savingsAccounts = accounts.filter(a => a.type === 'savings' || a.type === 'current');
  const loanAccounts = accounts.filter(a => a.type === 'loan');

  const totalSavingsPaise = savingsAccounts.reduce((sum, a) => sum + (a.balance || 0), 0);
  const totalLoanDebtPaise = loanAccounts.reduce((sum, a) => sum + (a.outstandingAmount || 0), 0);
  const totalMonthlyEmiPaise = loanAccounts.reduce((sum, a) => sum + (a.emiAmount || 0), 0);

  // 3. Fetch Insurance Policies
  const policies = await Policy.find({ userId }).lean();
  const healthPolicies = policies.filter(p => p.type === 'health' || p.type === 'medical');
  const motorPolicies = policies.filter(p => p.type === 'car' || p.type === 'two_wheeler');
  const lifePolicies = policies.filter(p => p.type === 'life' || p.type === 'term');

  const currentSpentPaise = currentMonthSpentAgg?.total || 0;
  const lastSpentPaise = lastMonthSpentAgg?.total || 0;

  const recommendations = [];

  // ── RULE 1: Food & Dining / Discretionary Spend Optimization ──
  const foodSpend = categoryAgg.find(c => c._id === 'food')?.total || 0;
  if (foodSpend > 150000) { // > ₹1,500
    const foodRupees = Math.round(foodSpend / 100);
    const potentialSaving = Math.round(foodRupees * 0.3);
    recommendations.push({
      id: 'rec_food_dining',
      category: 'spend',
      tag: 'SPENDING LEAKAGE',
      tagColor: '#FF6D00',
      icon: '🍔',
      title: 'Food Delivery & Dining Optimization',
      impact: `Save up to ₹${potentialSaving.toLocaleString('en-IN')}/mo`,
      explanation: `You have spent ₹${foodRupees.toLocaleString('en-IN')} on food & dining this month. Reducing 2 weekend orders can save ~₹${potentialSaving.toLocaleString('en-IN')} per month.`,
      actionLabel: 'Set Food Budget',
      actionRoute: '/(tabs)/budgets'
    });
  }

  // ── RULE 2: Loan & EMI Refinancing / High-Interest Debt ──
  const highInterestLoan = loanAccounts.find(l => (l.interestRate || 0) >= 12);
  if (highInterestLoan) {
    const rate = highInterestLoan.interestRate;
    const outstanding = Math.round((highInterestLoan.outstandingAmount || 0) / 100);
    const annualSavings = Math.round(outstanding * 0.035); // 3.5% rate drop
    recommendations.push({
      id: 'rec_loan_refinance',
      category: 'loan',
      tag: 'INTEREST SAVER',
      tagColor: '#FF4757',
      icon: '📉',
      title: `${highInterestLoan.bankName} Loan Refinancing`,
      impact: `Save ~₹${annualSavings.toLocaleString('en-IN')} in interest`,
      explanation: `Your loan interest is ${rate}%. Top lenders currently offer personal/balance transfer loans starting at 10.25%. Refinancing can cut your interest burden.`,
      actionLabel: 'Review Loan Details',
      actionRoute: '/add'
    });
  } else if (loanAccounts.length > 0 && totalMonthlyEmiPaise > 0) {
    const emiRupees = Math.round(totalMonthlyEmiPaise / 100);
    recommendations.push({
      id: 'rec_loan_prepayment',
      category: 'loan',
      tag: 'DEBT STRATEGY',
      tagColor: '#6366F1',
      icon: '💳',
      title: 'Accelerate Debt Freedom via 1 Extra EMI',
      impact: 'Cut loan tenure by up to 2 years',
      explanation: `Your total monthly EMI liability is ₹${emiRupees.toLocaleString('en-IN')}. Paying just 1 extra EMI per year towards principal can shave off significant interest.`,
      actionLabel: 'View Accounts',
      actionRoute: '/add'
    });
  }

  // ── RULE 3: Insurance & Protection Gap Analysis ──
  if (healthPolicies.length === 0 && (savingsAccounts.length > 0 || currentSpentPaise > 0)) {
    recommendations.push({
      id: 'rec_health_gap',
      category: 'insurance',
      tag: 'PROTECTION GAP',
      tagColor: '#FF4757',
      icon: '🛡️',
      title: 'Critical Health Insurance Missing',
      impact: 'Protect up to ₹10 Lakhs in medical emergencies',
      explanation: 'No active health insurance policy found in your vault. A single medical emergency can deplete your liquid savings. Consider a minimum ₹10 Lakhs family cover.',
      actionLabel: 'Upload Health Policy',
      actionRoute: '/add'
    });
  } else if (healthPolicies.length > 0) {
    // Check if any policy expires in next 45 days
    const upcomingExpiry = policies.find(p => {
      if (!p.expiryDate) return false;
      const diffDays = (new Date(p.expiryDate).getTime() - now.getTime()) / (1000 * 3600 * 24);
      return diffDays > 0 && diffDays <= 45;
    });

    if (upcomingExpiry) {
      const daysLeft = Math.ceil((new Date(upcomingExpiry.expiryDate).getTime() - now.getTime()) / (1000 * 3600 * 24));
      recommendations.push({
        id: 'rec_policy_renewal',
        category: 'insurance',
        tag: 'RENEWAL DUE',
        tagColor: '#FF6D00',
        icon: '⏳',
        title: `${upcomingExpiry.title} Renewal Alert`,
        impact: `Expires in ${daysLeft} days — Protect No-Claim-Bonus`,
        explanation: `Your policy with ${upcomingExpiry.provider} expires on ${new Date(upcomingExpiry.expiryDate).toISOString().split('T')[0]}. Renew early to keep your NCB discount and continuous coverage.`,
        actionLabel: 'View Policy Vault',
        actionRoute: '/add'
      });
    }
  }

  // ── RULE 4: Emergency Fund & Cash Flow Health ──
  const monthlyBurn = currentSpentPaise > 0 ? currentSpentPaise : lastSpentPaise;

  if (monthlyBurn > 0) {
    const emergencyCoverageMonths = totalSavingsPaise > 0 ? (totalSavingsPaise / monthlyBurn).toFixed(1) : '0.0';

    if (Number(emergencyCoverageMonths) < 3) {
      const targetBufferRupees = Math.round((monthlyBurn * 3) / 100);
      recommendations.push({
        id: 'rec_emergency_fund',
        category: 'savings',
        tag: 'FINANCIAL SHIELD',
        tagColor: '#10B981',
        icon: '💰',
        title: 'Build 3-Month Emergency Buffer',
        impact: `Target: ₹${targetBufferRupees.toLocaleString('en-IN')}`,
        explanation: `Your liquid savings currently cover ~${emergencyCoverageMonths} months of expenses. Financial experts recommend keeping at least 3 months in high-yield savings or liquid funds.`,
        actionLabel: 'Check Savings Account',
        actionRoute: '/add'
      });
    }
  }

  // ── RULE 5: Month-over-Month Spending Velocity ──
  if (lastSpentPaise > 0 && currentSpentPaise > lastSpentPaise) {
    const diffPaise = currentSpentPaise - lastSpentPaise;
    const diffRupees = Math.round(diffPaise / 100);
    const pctIncrease = Math.round((diffPaise / lastSpentPaise) * 100);
    recommendations.push({
      id: 'rec_spend_velocity',
      category: 'spend',
      tag: 'BUDGET ALERT',
      tagColor: '#FF4757',
      icon: '📈',
      title: 'Spending Pacing Ahead of Last Month',
      impact: `+₹${diffRupees.toLocaleString('en-IN')} (+${pctIncrease}%)`,
      explanation: `You have spent more compared to this time last month. Check your highest transactions on the circular graph to identify discretionary spikes.`,
      actionLabel: 'Inspect Circular Graph',
      actionRoute: '/(tabs)'
    });
  } else if (lastSpentPaise > 0 && currentSpentPaise < lastSpentPaise) {
    const diffPaise = lastSpentPaise - currentSpentPaise;
    const diffRupees = Math.round(diffPaise / 100);
    recommendations.push({
      id: 'rec_savings_trend',
      category: 'savings',
      tag: 'GREAT HABIT',
      tagColor: '#10B981',
      icon: '🎯',
      title: 'Positive Savings Momentum',
      impact: `Saved ₹${diffRupees.toLocaleString('en-IN')} vs last month`,
      explanation: `You are spending less than last month! Allocate this surplus toward emergency funds or loan principal prepayment.`,
      actionLabel: 'Set Savings Goal',
      actionRoute: '/(tabs)/budgets'
    });
  }

  return {
    ok: true,
    count: recommendations.length,
    generatedAt: now.toISOString(),
    recommendations
  };
}

module.exports = {
  generateRecommendations
};
