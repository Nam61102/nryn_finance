'use strict';
const Policy = require('../db/models/Policy');
const Account = require('../db/models/Account');
const Transaction = require('../db/models/Transaction');
const documentService = require('../ai/document.service');

/**
 * Controller for Financial Hub:
 * - Bank Statement analysis & bulk import
 * - Insurance & Policy document upload & management
 * - Savings & Loan Account management
 * - Cash Expense logging
 */

// ── 1. AI Document Analysis ────────────────────────────────────────────────
exports.analyzeDocument = async (req, res, next) => {
  try {
    const { type, text, fileName, fileBase64 } = req.body;
    if (!type) {
      return res.status(400).json({ error: 'type_required', message: 'Document type (statement, insurance, loan, cash_receipt) is required.' });
    }

    const result = await documentService.analyzeDocument({ type, text, fileName, fileBase64 });
    return res.json(result);
  } catch (err) {
    next(err);
  }
};

// ── 2. Bank Statement Import ───────────────────────────────────────────────
exports.importStatementTransactions = async (req, res, next) => {
  try {
    const { transactions, bankName, accountMasked } = req.body;
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ error: 'no_transactions', message: 'No transactions provided for import.' });
    }

    const docs = transactions.map((t) => {
      const isDebit = t.direction === 'debit';
      const occurred = t.occurredAt ? new Date(t.occurredAt) : (t.date ? new Date(t.date) : new Date());

      return {
        userId: req.userId,
        source: 'manual',
        amount: Math.round(t.amountPaise || (t.amount ? t.amount * 100 : 0)),
        direction: isDebit ? 'debit' : 'credit',
        currency: 'INR',
        occurredAt: isNaN(occurred.getTime()) ? new Date() : occurred,
        merchantRaw: t.description || 'Statement Transaction',
        merchantName: t.description || `${bankName || 'Bank'} Transaction`,
        category: t.category || 'other',
        categorySource: 'llm',
        categoryConfidence: 0.9,
        account: {
          bankName: bankName || 'Bank Statement',
          last4: accountMasked ? accountMasked.replace(/\D/g, '').slice(-4) : '',
          type: 'savings'
        },
        method: 'netbanking',
        refId: t.refId || `STMT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        isExpense: isDebit,
        note: `Imported from ${bankName || 'bank'} statement`
      };
    });

    const inserted = await Transaction.insertMany(docs, { ordered: false });
    return res.status(201).json({
      ok: true,
      importedCount: inserted.length,
      message: `Successfully imported ${inserted.length} transactions from ${bankName || 'statement'}.`
    });
  } catch (err) {
    next(err);
  }
};

// ── 3. Insurance & Policies ────────────────────────────────────────────────
exports.listPolicies = async (req, res, next) => {
  try {
    const policies = await Policy.find({ userId: req.userId }).sort({ expiryDate: 1 }).lean();
    return res.json({ policies });
  } catch (err) {
    next(err);
  }
};

exports.createPolicy = async (req, res, next) => {
  try {
    const {
      type,
      title,
      provider,
      policyNumber,
      insuredName,
      sumInsured,
      premiumAmount,
      frequency,
      startDate,
      expiryDate,
      documentUrl,
      documentName,
      status,
      notes
    } = req.body;

    if (!title || !provider) {
      return res.status(400).json({ error: 'missing_fields', message: 'Policy title and provider are required.' });
    }

    const policy = await Policy.create({
      userId: req.userId,
      type: type || 'health',
      title,
      provider,
      policyNumber: policyNumber || '',
      insuredName: insuredName || '',
      sumInsured: sumInsured || 0,
      premiumAmount: premiumAmount || 0,
      frequency: frequency || 'yearly',
      startDate: startDate ? new Date(startDate) : null,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      documentUrl: documentUrl || '',
      documentName: documentName || '',
      status: status || 'active',
      notes: notes || '',
      aiExtracted: Boolean(req.body.aiExtracted)
    });

    return res.status(201).json({ ok: true, policy });
  } catch (err) {
    next(err);
  }
};

exports.deletePolicy = async (req, res, next) => {
  try {
    const deleted = await Policy.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!deleted) return res.status(404).json({ error: 'not_found' });
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

// ── 4. Savings & Loan Accounts ─────────────────────────────────────────────
exports.listAccounts = async (req, res, next) => {
  try {
    const accounts = await Account.find({ userId: req.userId }).sort({ createdAt: -1 }).lean();
    const savings = accounts.filter(a => a.type === 'savings' || a.type === 'current');
    const loans = accounts.filter(a => a.type === 'loan');

    const totalSavingsPaise = savings.reduce((acc, a) => acc + (a.balance || 0), 0);
    const totalLoanDebtPaise = loans.reduce((acc, a) => acc + (a.outstandingAmount || 0), 0);
    const totalMonthlyEmiPaise = loans.reduce((acc, a) => acc + (a.emiAmount || 0), 0);

    return res.json({
      accounts,
      savings,
      loans,
      summary: {
        totalSavingsPaise,
        totalLoanDebtPaise,
        totalMonthlyEmiPaise,
        netBalancePaise: totalSavingsPaise - totalLoanDebtPaise
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.createAccount = async (req, res, next) => {
  try {
    const {
      type,
      bankName,
      accountNumber,
      accountHolder,
      balance,
      loanType,
      principalAmount,
      outstandingAmount,
      emiAmount,
      interestRate,
      emiDueDate,
      tenureMonths,
      notes
    } = req.body;

    if (!bankName) {
      return res.status(400).json({ error: 'bank_name_required', message: 'Bank or lender name is required.' });
    }

    const account = await Account.create({
      userId: req.userId,
      type: type || 'savings',
      bankName,
      accountNumber: accountNumber || '',
      accountHolder: accountHolder || '',
      balance: balance || 0,
      loanType: loanType || null,
      principalAmount: principalAmount || 0,
      outstandingAmount: outstandingAmount || 0,
      emiAmount: emiAmount || 0,
      interestRate: interestRate || 0,
      emiDueDate: emiDueDate || 5,
      tenureMonths: tenureMonths || 0,
      notes: notes || '',
      aiExtracted: Boolean(req.body.aiExtracted)
    });

    return res.status(201).json({ ok: true, account });
  } catch (err) {
    next(err);
  }
};

exports.deleteAccount = async (req, res, next) => {
  try {
    const deleted = await Account.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!deleted) return res.status(404).json({ error: 'not_found' });
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

// ── 5. Cash Expense Fast Entry ─────────────────────────────────────────────
exports.createCashExpense = async (req, res, next) => {
  try {
    const { amount, merchantName, note, category, occurredAt } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'invalid_amount', message: 'Valid expense amount is required.' });
    }

    const paise = Math.round(amount * 100);
    const txn = await Transaction.create({
      userId: req.userId,
      source: 'manual',
      amount: paise,
      currency: 'INR',
      direction: 'debit',
      occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
      merchantRaw: merchantName || 'Cash Expense',
      merchantName: merchantName || 'Cash Expense',
      category: category || 'other',
      categorySource: 'user',
      categoryConfidence: 1.0,
      method: 'manual',
      isExpense: true,
      note: note || 'Cash expense entry',
      refId: `CASH-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
    });

    return res.status(201).json({ ok: true, transaction: txn });
  } catch (err) {
    next(err);
  }
};
