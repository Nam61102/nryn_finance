'use strict';

/**
 * Server-side Deterministic Rich Block Generator for Copilot
 * Builds rich UI blocks strictly from verified database records.
 * NEVER fabricated by LLM.
 */

function buildBlocks(query, context) {
  const {
    safeSpend,
    subs,
    taxRadar,
    accounts = [],
    txns = [],
    foodTxns = [],
    currentMonth,
    askAmt = 0,
  } = context;

  const lower = (query || '').toLowerCase();
  const blocks = [];

  const affordMatch =
    lower.match(/(?:afford|spend|buy|dinner|party|trip|खर्च|करू|सकतो|सकता|घेऊ)\s*(?:of|for|चा|चे|का)?\s*(?:rs\.?|inr|₹|रुपये|रु\.?)?\s*([\d,]+)/i) ||
    lower.match(/([\d,]+)\s*(?:rs\.?|inr|₹|रुपये|रु\.?)?\s*(?:afford|spend|खर्च|परवडेल|करू|सकतो|सकता)/i);
  const parsedAmt = affordMatch ? parseFloat(affordMatch[1].replace(/,/g, '')) : askAmt;

  // 1. Affordability & Safe-to-Spend Queries (English, Marathi, Hindi)
  if (
    parsedAmt > 0 ||
    lower.includes('afford') ||
    lower.includes('safe') ||
    lower.includes('limit') ||
    lower.includes('burn') ||
    lower.includes('खर्च') ||
    lower.includes('परवडेल') ||
    lower.includes('शिल्लक') ||
    lower.includes('बचा')
  ) {
    if (!safeSpend || !safeSpend.hasBudget) {
      blocks.push({
        type: 'verdict',
        status: 'info',
        title: 'No Monthly Budget Configured',
        message: 'Set your monthly budget in the Budgets tab to unlock live daily safe-to-spend limits.',
      });
      blocks.push({
        type: 'actions',
        buttons: [
          { label: 'Set Monthly Budget', action: 'navigate_budgets' },
        ],
      });
    } else {
      const dailyLimit = safeSpend.dailySafeSpendINR || 0;
      const todaySpent = safeSpend.todaySpentINR || 0;
      const todayRemaining = safeSpend.todayRemainingINR || 0;

      if (parsedAmt > 0) {
        if (parsedAmt <= todayRemaining) {
          blocks.push({
            type: 'verdict',
            status: 'approved',
            title: `Safe to Spend ₹${parsedAmt.toLocaleString('en-IN')}`,
            message: `You have ₹${todayRemaining.toLocaleString('en-IN')} remaining in your daily allowance today.`,
          });
        } else if (parsedAmt <= dailyLimit * 2) {
          const excess = parsedAmt - todayRemaining;
          blocks.push({
            type: 'verdict',
            status: 'caution',
            title: 'Proceed with Caution',
            message: `Exceeds today's remaining allowance by ₹${excess.toLocaleString('en-IN')}. Compensate over the next 2 days.`,
          });
        } else {
          blocks.push({
            type: 'verdict',
            status: 'warning',
            title: 'Budget Overrun Risk',
            message: `₹${parsedAmt.toLocaleString('en-IN')} is significantly above your daily safe limit of ₹${dailyLimit.toLocaleString('en-IN')}.`,
          });
        }
      }

      blocks.push({
        type: 'progress',
        label: "Today's Safe Spend Limit",
        current: todaySpent,
        max: Math.max(dailyLimit, todaySpent),
        currentFormatted: `₹${todaySpent.toLocaleString('en-IN')}`,
        maxFormatted: `₹${dailyLimit.toLocaleString('en-IN')}`,
        percent: dailyLimit > 0 ? Math.min(100, Math.round((todaySpent / dailyLimit) * 100)) : 0,
        color: todaySpent > dailyLimit ? '#FF4757' : '#10B981',
      });

      blocks.push({
        type: 'stat',
        label: 'Remaining Safe Today',
        value: `₹${todayRemaining.toLocaleString('en-IN')}`,
        subtitle: `Burn status: ${safeSpend.burnStatus?.toUpperCase() || 'NORMAL'}`,
        trend: todayRemaining > 0 ? 'up' : 'down',
      });
    }
    return blocks;
  }

  // 2. Food & Dining Breakdown Queries (English, Marathi, Hindi)
  if (
    lower.includes('food') ||
    lower.includes('swiggy') ||
    lower.includes('zomato') ||
    lower.includes('dining') ||
    lower.includes('जेवण') ||
    lower.includes('खाण्या') ||
    lower.includes('खाना') ||
    lower.includes('नाश्ता')
  ) {
    const totalFoodINR = Math.round(foodTxns.reduce((s, t) => s + (t.amount || 0), 0) / 100);
    const deliveryTxns = foodTxns.filter((t) =>
      /swiggy|zomato|eatclub|domino|mcdonald/i.test(`${t.merchantName || ''} ${t.merchantRaw || ''}`)
    );
    const deliveryINR = Math.round(deliveryTxns.reduce((s, t) => s + (t.amount || 0), 0) / 100);
    const otherFoodINR = Math.max(0, totalFoodINR - deliveryINR);

    blocks.push({
      type: 'stat',
      label: `Total Food Spend (${currentMonth?.label || 'This Month'})`,
      value: `₹${totalFoodINR.toLocaleString('en-IN')}`,
      subtitle: `${foodTxns.length} transactions recorded`,
    });

    if (totalFoodINR > 0) {
      blocks.push({
        type: 'bar',
        label: 'Food Spend Breakdown',
        items: [
          { label: 'Food Delivery', value: deliveryINR, formatted: `₹${deliveryINR.toLocaleString('en-IN')}`, color: '#FF6D00' },
          { label: 'Groceries & Dining', value: otherFoodINR, formatted: `₹${otherFoodINR.toLocaleString('en-IN')}`, color: '#38BDF8' },
        ],
      });
    }

    if (foodTxns.length > 0) {
      blocks.push({
        type: 'transactions',
        title: 'Recent Food Expenses',
        items: foodTxns.slice(0, 3).map((t) => ({
          id: String(t._id),
          merchant: t.merchantName || t.merchantRaw || 'Food',
          amount: `₹${Math.round((t.amount || 0) / 100).toLocaleString('en-IN')}`,
          category: t.category || 'food',
          date: new Date(t.occurredAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
        })),
      });
    }
    return blocks;
  }

  // 3. Subscriptions & Recurring Charges
  if (
    lower.includes('subscri') ||
    lower.includes('recurring') ||
    lower.includes('zombie') ||
    lower.includes('सबस्क्रिप्शन') ||
    lower.includes('बिल')
  ) {
    if (!subs || subs.empty || subs.count === 0) {
      blocks.push({
        type: 'verdict',
        status: 'info',
        title: 'No Recurring Subscriptions Found',
        message: 'No subscriptions detected yet across consecutive months of bank SMS charges.',
      });
    } else {
      blocks.push({
        type: 'stat',
        label: 'Monthly Subscriptions',
        value: `₹${(subs.totalMonthlyRecurringINR || 0).toLocaleString('en-IN')}/mo`,
        subtitle: `₹${(subs.totalAnnualCostINR || 0).toLocaleString('en-IN')} annualized across ${subs.count} subscriptions`,
      });

      blocks.push({
        type: 'subscriptions',
        count: subs.count,
        totalMonthly: `₹${(subs.totalMonthlyRecurringINR || 0).toLocaleString('en-IN')}`,
        items: (subs.subscriptions || []).map((s) => ({
          name: s.merchantName || 'Subscription',
          amount: `₹${(s.amountINR || 0).toLocaleString('en-IN')}`,
          frequency: s.frequency || 'monthly',
          isZombie: Boolean(s.isZombie),
          alertReason: s.zombieReason || undefined,
        })),
      });
    }
    return blocks;
  }

  // 4. Tax Planning & 80C / 80D Radar (English, Marathi, Hindi)
  if (
    lower.includes('tax') ||
    lower.includes('80c') ||
    lower.includes('80d') ||
    lower.includes('कर बचत') ||
    lower.includes('टॅक्स') ||
    lower.includes('टैक्स')
  ) {
    if (taxRadar?.regimeUnknown) {
      blocks.push({
        type: 'verdict',
        status: 'info',
        title: 'Select Tax Regime',
        message: 'Choose New Regime or Old Regime to calculate applicable Section 80C & 80D tax deductions.',
      });
      blocks.push({
        type: 'actions',
        buttons: [{ label: 'Select Tax Regime', action: 'select_regime' }],
      });
    } else if (taxRadar?.taxRegime === 'new') {
      blocks.push({
        type: 'verdict',
        status: 'info',
        title: `New Tax Regime (${taxRadar.financialYearLabel})`,
        message: 'Section 80C and 80D deductions do not apply under the New Tax Regime (default since FY 2023-24). Standard deduction and lower tax slabs apply.',
      });
    } else if (taxRadar) {
      const u80C = taxRadar.section80C?.utilizedINR || 0;
      const l80C = taxRadar.section80C?.limitINR || 150000;
      const u80D = taxRadar.section80D?.utilizedINR || 0;
      const l80D = taxRadar.section80D?.limitINR || 25000;

      blocks.push({
        type: 'progress',
        label: 'Section 80C (PPF, ELSS, EPF, Life Insurance)',
        current: u80C,
        max: l80C,
        currentFormatted: `₹${u80C.toLocaleString('en-IN')}`,
        maxFormatted: `₹${l80C.toLocaleString('en-IN')}`,
        percent: taxRadar.section80C?.percentage || 0,
        color: '#10B981',
      });

      blocks.push({
        type: 'progress',
        label: 'Section 80D (Health Insurance)',
        current: u80D,
        max: l80D,
        currentFormatted: `₹${u80D.toLocaleString('en-IN')}`,
        maxFormatted: `₹${l80D.toLocaleString('en-IN')}`,
        percent: taxRadar.section80D?.percentage || 0,
        color: '#38BDF8',
      });
    }
    return blocks;
  }

  // 5. Loan & EMI Prepayment (English, Marathi, Hindi)
  if (
    lower.includes('loan') ||
    lower.includes('emi') ||
    lower.includes('prepay') ||
    lower.includes('interest') ||
    lower.includes('कर्ज') ||
    lower.includes('व्याज') ||
    lower.includes('किश्त')
  ) {
    const loanAccounts = accounts.filter((a) => a.type === 'loan');
    if (loanAccounts.length === 0) {
      blocks.push({
        type: 'verdict',
        status: 'info',
        title: 'No Loans Added',
        message: 'Add your home, car, or personal loan in the Financial Hub to simulate EMI prepayment savings.',
      });
      blocks.push({
        type: 'actions',
        buttons: [{ label: 'Add Loan in Hub', action: 'navigate_hub' }],
      });
    } else {
      const firstLoan = loanAccounts[0];
      const principal = Math.round((firstLoan.principalAmount || firstLoan.outstandingAmount || 0) / 100);
      blocks.push({
        type: 'stat',
        label: `${firstLoan.bankName || 'Loan'} Account`,
        value: `₹${principal.toLocaleString('en-IN')}`,
        subtitle: `${firstLoan.interestRate || 9}% interest rate · ${firstLoan.tenureMonths || 0} months tenure`,
      });
      blocks.push({
        type: 'actions',
        buttons: [{ label: 'Open Loan Simulator', action: 'open_loan_simulator' }],
      });
    }
    return blocks;
  }

  // 6. Default Snapshot / Overview
  const debitExpenseTxns = txns.filter((t) => t.direction === 'debit' && t.isExpense);
  const totalSpentINR = Math.round(debitExpenseTxns.reduce((s, t) => s + (t.amount || 0), 0) / 100);

  blocks.push({
    type: 'stat',
    label: `Total Spent (${currentMonth?.label || 'This Month'})`,
    value: `₹${totalSpentINR.toLocaleString('en-IN')}`,
    subtitle: `${debitExpenseTxns.length} expenses recorded`,
  });

  if (safeSpend?.hasBudget) {
    blocks.push({
      type: 'progress',
      label: 'Monthly Budget Used',
      current: totalSpentINR,
      max: safeSpend.totalBudgetINR || totalSpentINR,
      currentFormatted: `₹${totalSpentINR.toLocaleString('en-IN')}`,
      maxFormatted: `₹${(safeSpend.totalBudgetINR || 0).toLocaleString('en-IN')}`,
      percent: safeSpend.totalBudgetINR > 0 ? Math.min(100, Math.round((totalSpentINR / safeSpend.totalBudgetINR) * 100)) : 0,
      color: totalSpentINR > (safeSpend.totalBudgetINR || 0) ? '#FF4757' : '#FF6D00',
    });
  }

  return blocks;
}

module.exports = { buildBlocks };
